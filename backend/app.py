import os
import time
import uuid
import threading
import base64
import io
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image
import numpy as np
import cv2

from inpainter import InpaintingEngine, HAS_ONNX, FFMPEG_EXE
from database import (
    get_db,
    check_connection as check_db_connection,
    File as DBFile,
    ProcessedFile as DBProcessedFile,
    ProcessingJob as DBProcessingJob,
    User as DBUser,
    is_database_ready
)

# Initialize Flask App
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "outputs")
TEMP_FOLDER = os.path.join(BASE_DIR, "temp")

for d in [UPLOAD_FOLDER, OUTPUT_FOLDER, TEMP_FOLDER]:
    os.makedirs(d, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["OUTPUT_FOLDER"] = OUTPUT_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200MB max upload

ALLOWED_PHOTO_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_VIDEO_EXTENSIONS = {"mp4", "mov", "mkv", "webm"}

# Initialize Inpainting Engine
engine = InpaintingEngine()

# In-memory video task tracker for low-latency progress streaming
video_tasks = {}

def allowed_file(filename, allowed_set):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_set

def cleanup_old_files():
    """Removes uploads and outputs older than 2 hours to prevent disk bloating."""
    now = time.time()
    for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, TEMP_FOLDER]:
        try:
            for fname in os.listdir(folder):
                fpath = os.path.join(folder, fname)
                if os.path.isfile(fpath) and (now - os.path.getmtime(fpath)) > 7200:
                    try:
                        os.remove(fpath)
                    except Exception:
                        pass
        except Exception:
            pass

# Run cleanup in background every 30 minutes
def schedule_cleanup():
    while True:
        time.sleep(1800)
        cleanup_old_files()

cleanup_thread = threading.Thread(target=schedule_cleanup, daemon=True)
cleanup_thread.start()


@app.route("/api/status", methods=["GET"])
def get_status():
    db_status = check_db_connection()
    return jsonify({
        "status": "online",
        "ai_engine": "LaMa Deep Neural Network (ONNX)" if engine.is_ai_available() else "Fast Optical Inpainter (Telea/NS)",
        "ai_available": engine.is_ai_available(),
        "onnx_installed": HAS_ONNX,
        "ffmpeg_path": FFMPEG_EXE,
        "database": db_status,
        "allowed_photo": list(ALLOWED_PHOTO_EXTENSIONS),
        "allowed_video": list(ALLOWED_VIDEO_EXTENSIONS),
    })


@app.route("/api/db/status", methods=["GET"])
def get_db_status():
    """Detailed health check and table record counts in PostgreSQL."""
    db_status = check_db_connection()
    counts = {"files": 0, "processed_files": 0, "jobs": 0}

    with get_db() as session:
        if session:
            try:
                counts["files"] = session.query(DBFile).count()
                counts["processed_files"] = session.query(DBProcessedFile).count()
                counts["jobs"] = session.query(DBProcessingJob).count()
            except Exception as e:
                db_status["query_error"] = str(e)

    return jsonify({
        "database": db_status,
        "counts": counts,
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/inpaint/photo", methods=["POST"])
def inpaint_photo():
    import traceback
    start_time = time.time()
    file_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    try:
        cleanup_old_files()

        if "image" not in request.files:
            return jsonify({"error": "No image file provided"}), 400

        img_file = request.files["image"]
        if not img_file or img_file.filename == "":
            return jsonify({"error": "Selected image is invalid"}), 400

        ext = img_file.filename.rsplit(".", 1)[-1].lower()
        if ext not in ALLOWED_PHOTO_EXTENSIONS:
            return jsonify({"error": f"Unsupported image format: .{ext}. Allowed: {list(ALLOWED_PHOTO_EXTENSIONS)}"}), 400

        # Read image using PIL to preserve orientation and format
        try:
            img_bytes = img_file.read()
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            orig_w, orig_h = int(pil_img.size[0]), int(pil_img.size[1])
            img_np = np.array(pil_img)
            file_size = len(img_bytes)
        except Exception as e:
            return jsonify({"error": f"Failed to parse image file: {str(e)}"}), 400

        mime = "image/png" if ext == "png" else ("image/webp" if ext == "webp" else "image/jpeg")
        mode = request.form.get("mode", "auto")
        feather = int(request.form.get("feather", 5))

        # 1. Persist initial uploaded file & processing job in PostgreSQL
        with get_db() as session:
            if session:
                try:
                    db_file = DBFile(
                        id=file_id,
                        original_filename=secure_filename(img_file.filename),
                        file_type="image",
                        mime_type=mime,
                        file_size=file_size,
                        storage_provider="local",
                        storage_key="",
                        file_status="processing",
                        width=orig_w,
                        height=orig_h
                    )
                    session.add(db_file)

                    db_job = DBProcessingJob(
                        id=job_id,
                        file_id=file_id,
                        job_type="photo_inpaint",
                        status="processing",
                        progress=30,
                        mode=mode
                    )
                    session.add(db_job)
                except Exception as db_err:
                    print(f"[DB Warning] Could not record initial upload: {db_err}")

        # Read mask (either from file or from base64 string)
        mask_np = None
        if "mask" in request.files and request.files["mask"].filename != "":
            try:
                mask_file = request.files["mask"]
                mask_pil = Image.open(io.BytesIO(mask_file.read())).convert("L")
                if mask_pil.size != (orig_w, orig_h):
                    mask_pil = mask_pil.resize((orig_w, orig_h), Image.NEAREST)
                mask_np = np.array(mask_pil)
            except Exception as e:
                return jsonify({"error": f"Failed to parse mask file: {str(e)}"}), 400
        elif "mask_base64" in request.form and request.form["mask_base64"]:
            try:
                raw_b64 = request.form["mask_base64"]
                if "," in raw_b64:
                    raw_b64 = raw_b64.split(",", 1)[1]
                mask_bytes = base64.b64decode(raw_b64)
                mask_pil = Image.open(io.BytesIO(mask_bytes)).convert("L")
                if mask_pil.size != (orig_w, orig_h):
                    mask_pil = mask_pil.resize((orig_w, orig_h), Image.NEAREST)
                mask_np = np.array(mask_pil)
            except Exception as e:
                return jsonify({"error": f"Failed to decode mask base64: {str(e)}"}), 400

        if mask_np is None:
            return jsonify({"error": "Watermark mask must be provided"}), 400

        # Perform inpainting
        result_np = engine.inpaint_image(img_np, mask_np, mode=mode, feather_radius=feather)

        # Save output file with unique name
        out_id = uuid.uuid4().hex[:12]
        out_ext = "png" if ext == "png" else "jpg"
        out_filename = f"inpainted_{out_id}.{out_ext}"
        out_path = os.path.join(OUTPUT_FOLDER, out_filename)

        out_pil = Image.fromarray(result_np)
        if out_ext == "jpg":
            out_pil.save(out_path, format="JPEG", quality=98, subsampling=0)
        else:
            out_pil.save(out_path, format="PNG")

        # Encode result to base64 for immediate reactive preview in frontend
        buffered = io.BytesIO()
        if out_ext == "jpg":
            out_pil.save(buffered, format="JPEG", quality=95)
            out_mime = "image/jpeg"
        else:
            out_pil.save(buffered, format="PNG")
            out_mime = "image/png"

        b64_result = f"data:{out_mime};base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")
        proc_time = float(round(time.time() - start_time, 2))
        quality_info = engine.assess_reconstruction_quality(mask_np)
        model_name = "LaMa Deep Neural Net" if (engine.is_ai_available() and mode != "fast") else "Optical Inpainter"
        out_file_size = os.path.getsize(out_path) if os.path.exists(out_path) else len(buffered.getvalue())

        # 2. Persist processed file record & update job status in PostgreSQL
        proc_file_id = str(uuid.uuid4())
        with get_db() as session:
            if session:
                try:
                    proc_file = DBProcessedFile(
                        id=proc_file_id,
                        original_file_id=file_id,
                        storage_provider="local",
                        storage_key=out_path,
                        output_filename=out_filename,
                        mime_type=out_mime,
                        file_size=out_file_size,
                        width=orig_w,
                        height=orig_h,
                        processing_time_sec=proc_time,
                        model_used=model_name
                    )
                    session.add(proc_file)

                    job = session.query(DBProcessingJob).filter_by(id=job_id).first()
                    if job:
                        job.status = "completed"
                        job.progress = 100
                        job.completed_at = datetime.utcnow()

                    f = session.query(DBFile).filter_by(id=file_id).first()
                    if f:
                        f.file_status = "completed"
                        f.storage_key = out_path
                except Exception as db_err:
                    print(f"[DB Warning] Could not persist processed file output: {db_err}")

        return jsonify({
            "success": True,
            "file_id": file_id,
            "job_id": job_id,
            "processed_file_id": proc_file_id,
            "width": orig_w,
            "height": orig_h,
            "processing_time_sec": proc_time,
            "download_url": f"/api/download/{out_filename}",
            "filename": out_filename,
            "image_data": b64_result,
            "model_used": model_name,
            "quality_assessment": quality_info
        })
    except Exception as e:
        traceback.print_exc()
        # Update job as failed in DB
        with get_db() as session:
            if session:
                try:
                    job = session.query(DBProcessingJob).filter_by(id=job_id).first()
                    if job:
                        job.status = "failed"
                        job.error_message = str(e)
                        job.completed_at = datetime.utcnow()
                    f = session.query(DBFile).filter_by(id=file_id).first()
                    if f:
                        f.file_status = "failed"
                except Exception:
                    pass
        return jsonify({"error": f"Internal inpainting error: {str(e)}"}), 500


def run_video_task(task_id, file_id, in_path, mask_np, out_path, mode):
    def update_progress(pct, cur_frame, total, msg):
        video_tasks[task_id]["progress"] = pct
        video_tasks[task_id]["current_frame"] = cur_frame
        video_tasks[task_id]["total_frames"] = total
        video_tasks[task_id]["message"] = msg

        # Periodically update progress in PostgreSQL for long videos
        if pct % 20 == 0:
            with get_db() as session:
                if session:
                    try:
                        job = session.query(DBProcessingJob).filter_by(id=task_id).first()
                        if job:
                            job.progress = pct
                    except Exception:
                        pass

    try:
        engine.inpaint_video(
            video_path=in_path,
            mask_np=mask_np,
            output_path=out_path,
            mode=mode,
            progress_callback=update_progress
        )
        video_tasks[task_id]["status"] = "completed"
        video_tasks[task_id]["progress"] = 100
        video_tasks[task_id]["download_url"] = f"/api/download/{os.path.basename(out_path)}"
        video_tasks[task_id]["filename"] = os.path.basename(out_path)

        # Persist completion and processed file in PostgreSQL
        out_size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
        proc_file_id = str(uuid.uuid4())
        with get_db() as session:
            if session:
                try:
                    proc_file = DBProcessedFile(
                        id=proc_file_id,
                        original_file_id=file_id,
                        storage_provider="local",
                        storage_key=out_path,
                        output_filename=os.path.basename(out_path),
                        mime_type="video/mp4",
                        file_size=out_size,
                        model_used="LaMa + Optical Video Inpainter"
                    )
                    session.add(proc_file)

                    job = session.query(DBProcessingJob).filter_by(id=task_id).first()
                    if job:
                        job.status = "completed"
                        job.progress = 100
                        job.completed_at = datetime.utcnow()

                    f = session.query(DBFile).filter_by(id=file_id).first()
                    if f:
                        f.file_status = "completed"
                        f.storage_key = out_path
                except Exception as db_err:
                    print(f"[DB Warning] Could not persist video completion: {db_err}")

    except Exception as e:
        print(f"[VideoTask Error] {e}")
        video_tasks[task_id]["status"] = "failed"
        video_tasks[task_id]["error"] = str(e)

        # Update failure in PostgreSQL
        with get_db() as session:
            if session:
                try:
                    job = session.query(DBProcessingJob).filter_by(id=task_id).first()
                    if job:
                        job.status = "failed"
                        job.error_message = str(e)
                        job.completed_at = datetime.utcnow()
                    f = session.query(DBFile).filter_by(id=file_id).first()
                    if f:
                        f.file_status = "failed"
                except Exception:
                    pass
    finally:
        # Cleanup uploaded source file
        if os.path.exists(in_path):
            try:
                os.remove(in_path)
            except Exception:
                pass


@app.route("/api/inpaint/video", methods=["POST"])
def inpaint_video_endpoint():
    cleanup_old_files()

    if "video" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    vid_file = request.files["video"]
    if not vid_file or vid_file.filename == "":
        return jsonify({"error": "Selected video is invalid"}), 400

    ext = vid_file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        return jsonify({"error": f"Unsupported video format: .{ext}. Allowed: {list(ALLOWED_VIDEO_EXTENSIONS)}"}), 400

    # Save uploaded video to uploads folder
    task_id = uuid.uuid4().hex[:12]
    file_id = str(uuid.uuid4())
    in_filename = f"upload_{task_id}.{ext}"
    in_path = os.path.join(UPLOAD_FOLDER, in_filename)
    vid_file.save(in_path)
    file_size = os.path.getsize(in_path) if os.path.exists(in_path) else 0

    # Read mask
    mask_np = None
    if "mask" in request.files and request.files["mask"].filename != "":
        try:
            m_file = request.files["mask"]
            m_pil = Image.open(m_file.stream).convert("L")
            mask_np = np.array(m_pil)
        except Exception as e:
            return jsonify({"error": f"Failed to read mask file: {str(e)}"}), 400
    elif "mask_base64" in request.form and request.form["mask_base64"]:
        try:
            raw_b64 = request.form["mask_base64"]
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            m_bytes = base64.b64decode(raw_b64)
            m_pil = Image.open(io.BytesIO(m_bytes)).convert("L")
            mask_np = np.array(m_pil)
        except Exception as e:
            return jsonify({"error": f"Failed to decode mask: {str(e)}"}), 400

    if mask_np is None:
        return jsonify({"error": "A watermark mask selection is required"}), 400

    mode = request.form.get("mode", "auto")
    out_filename = f"inpainted_{task_id}.mp4"
    out_path = os.path.join(OUTPUT_FOLDER, out_filename)

    # Persist file and job record in PostgreSQL
    with get_db() as session:
        if session:
            try:
                db_file = DBFile(
                    id=file_id,
                    original_filename=secure_filename(vid_file.filename),
                    file_type="video",
                    mime_type=f"video/{ext}",
                    file_size=file_size,
                    storage_provider="local",
                    storage_key=in_path,
                    file_status="processing"
                )
                session.add(db_file)

                db_job = DBProcessingJob(
                    id=task_id,
                    file_id=file_id,
                    job_type="video_inpaint",
                    status="processing",
                    progress=0,
                    mode=mode
                )
                session.add(db_job)
            except Exception as db_err:
                print(f"[DB Warning] Could not persist video file record: {db_err}")

    # Initialize task state in memory
    video_tasks[task_id] = {
        "status": "processing",
        "progress": 0,
        "current_frame": 0,
        "total_frames": 0,
        "message": "Initializing video processing...",
        "start_time": time.time(),
        "download_url": None,
        "filename": None,
        "error": None,
        "file_id": file_id
    }

    # Start processing in background thread
    t = threading.Thread(
        target=run_video_task,
        args=(task_id, file_id, in_path, mask_np, out_path, mode),
        daemon=True
    )
    t.start()

    return jsonify({
        "success": True,
        "task_id": task_id,
        "file_id": file_id,
        "status": "processing"
    })


@app.route("/api/inpaint/video/status/<task_id>", methods=["GET"])
def get_video_status(task_id):
    # 1. Return in-memory status if active
    if task_id in video_tasks:
        return jsonify(video_tasks[task_id])

    # 2. Check PostgreSQL if not found in memory (e.g. server restart)
    with get_db() as session:
        if session:
            job = session.query(DBProcessingJob).filter_by(id=task_id).first()
            if job:
                resp = {
                    "status": job.status,
                    "progress": job.progress,
                    "download_url": None,
                    "filename": None,
                    "error": job.error_message
                }
                if job.file_id:
                    proc = session.query(DBProcessedFile).filter_by(original_file_id=job.file_id).first()
                    if proc:
                        resp["filename"] = proc.output_filename
                        resp["download_url"] = f"/api/download/{proc.output_filename}"
                return jsonify(resp)

    return jsonify({"error": "Task not found"}), 404


@app.route("/api/download/<filename>", methods=["GET"])
def download_file(filename):
    safe_name = secure_filename(filename)
    return send_from_directory(OUTPUT_FOLDER, safe_name, as_attachment=True)


@app.route("/api/history", methods=["GET"])
def get_history():
    """Returns recent files and their processing details from PostgreSQL."""
    limit = min(int(request.args.get("limit", 20)), 100)
    history = []

    with get_db() as session:
        if session:
            try:
                files = session.query(DBFile).order_by(DBFile.created_at.desc()).limit(limit).all()
                for f in files:
                    file_dict = f.to_dict()
                    file_dict["processed_files"] = [p.to_dict() for p in f.processed_files]
                    file_dict["jobs"] = [j.to_dict() for j in f.jobs]
                    history.append(file_dict)
            except Exception as e:
                return jsonify({"error": f"Failed to fetch history: {str(e)}"}), 500

    return jsonify({
        "count": len(history),
        "files": history
    })


@app.route("/api/files/<file_id>", methods=["GET"])
def get_file_details(file_id):
    """Retrieve detailed metadata for a specific file from PostgreSQL."""
    with get_db() as session:
        if session:
            f = session.query(DBFile).filter_by(id=file_id).first()
            if not f:
                return jsonify({"error": "File not found"}), 404
            data = f.to_dict()
            data["processed_files"] = [p.to_dict() for p in f.processed_files]
            data["jobs"] = [j.to_dict() for j in f.jobs]
            return jsonify(data)

    return jsonify({"error": "Database not connected"}), 503


@app.route("/api/files/<file_id>", methods=["DELETE"])
def delete_file_record(file_id):
    """Deletes file metadata from PostgreSQL and cleans up local output files."""
    deleted_files = []
    with get_db() as session:
        if session:
            f = session.query(DBFile).filter_by(id=file_id).first()
            if not f:
                return jsonify({"error": "File not found"}), 404

            # Remove associated processed physical files
            for p in f.processed_files:
                if p.output_filename:
                    p_path = os.path.join(OUTPUT_FOLDER, p.output_filename)
                    if os.path.exists(p_path):
                        try:
                            os.remove(p_path)
                            deleted_files.append(p.output_filename)
                        except Exception:
                            pass

            session.delete(f)
            return jsonify({
                "success": True,
                "deleted_file_id": file_id,
                "cleaned_files": deleted_files
            })

    return jsonify({"error": "Database not connected"}), 503


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"=== Starting AuraMark AI Server on http://localhost:{port} ===")
    app.run(host="0.0.0.0", port=port, debug=False)
