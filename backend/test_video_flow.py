import os
import time
import io
import base64
import subprocess
import numpy as np
import cv2
import imageio_ffmpeg

from app import app

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# 1. Create a 30-frame (1-second) test video with an audio track and a corner watermark
video_filename = os.path.join(os.path.dirname(__file__), "test_input.mp4")
temp_raw = os.path.join(os.path.dirname(__file__), "temp_raw.mp4")
fps = 30
width, height = 480, 320
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(temp_raw, fourcc, fps, (width, height))

for i in range(fps):
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    frame[:] = [int(150 + 50 * np.sin(i / 5)), 180, 220]
    cv2.putText(frame, "LOGO_WATERMARK", (240, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    out.write(frame)
out.release()

# Add a 1-second 440Hz test sine audio tone to video using ffmpeg
cmd = [
    ffmpeg_exe, "-y",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    "-i", temp_raw,
    "-c:v", "libx264", "-c:a", "aac",
    "-shortest", video_filename
]
subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
print("[OK] Synthetic test video created with audio track!")

# 2. Create watermark mask covering (230, 250) to (470, 310)
mask = np.zeros((height, width), dtype=np.uint8)
cv2.rectangle(mask, (230, 250), (470, 310), 255, -1)
_, mask_buf = cv2.imencode('.png', mask)
mask_b64 = 'data:image/png;base64,' + base64.b64encode(mask_buf).decode('utf-8')

# 3. Submit to /api/inpaint/video using Flask test client
client = app.test_client()
print("Submitting video to /api/inpaint/video via test client...")
with open(video_filename, "rb") as vf:
    res = client.post(
        "/api/inpaint/video",
        data={
            "video": (vf, "test_input.mp4"),
            "mask_base64": mask_b64,
            "mode": "fast"
        },
        content_type="multipart/form-data"
    )

data = res.get_json()
print("Submit response:", data)
assert res.status_code == 200, f"Submit failed: {data}"
assert data.get("success") is True
task_id = data["task_id"]

# 4. Poll status
completed = False
for _ in range(45):
    time.sleep(1)
    status_res = client.get(f"/api/inpaint/video/status/{task_id}")
    s = status_res.get_json()
    print(f"Task status: {s.get('status')}, progress: {s.get('progress')}%, frame: {s.get('current_frame')}/{s.get('total_frames')}")
    if s.get("status") == "completed":
        print("[OK] Video inpainting completed successfully! Download url:", s.get("download_url"))
        completed = True
        break
    elif s.get("status") == "failed":
        print("Video inpainting failed:", s.get("error"))
        break

# Clean up temp test files
for p in [temp_raw, video_filename]:
    if os.path.exists(p):
        try:
            os.remove(p)
        except Exception:
            pass

assert completed, "Video processing did not complete successfully"
print("[OK] Video watermark removal end-to-end test passed successfully!")
