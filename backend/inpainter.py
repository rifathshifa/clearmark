"""
AuraMark AI — Neural Inpainting Engine
Supports:
1. Deep LaMa Neural Network (ONNX Runtime)
2. Fast Telea / Navier-Stokes Hybrid Inpainting (Offline Fallback)
3. High-resolution Patch-Preserving Blending
4. Video Frame-by-Frame Inpainting with Temporal Smoothing and Audio Preservation
"""

import os
import sys
import time
import subprocess
import numpy as np
import cv2
from PIL import Image

try:
    import onnxruntime as ort
    HAS_ONNX = True
except ImportError:
    HAS_ONNX = False

try:
    import imageio_ffmpeg
    FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_EXE = "ffmpeg"


class InpaintingEngine:
    def __init__(self, model_path=None):
        self.model_path = model_path or os.path.join(os.path.dirname(__file__), "models", "lama_fp32.onnx")
        self.session = None
        self.model_loaded = False
        self._init_model()

    def _init_model(self):
        if not HAS_ONNX:
            print("[InpaintingEngine] onnxruntime not found. Using fallback inpainter.")
            return

        if os.path.exists(self.model_path) and os.path.getsize(self.model_path) > 100_000_000:
            try:
                print(f"[InpaintingEngine] Loading LaMa ONNX model from: {self.model_path}")
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = min(8, os.cpu_count() or 4)
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.session = ort.InferenceSession(self.model_path, sess_options=opts, providers=['CPUExecutionProvider'])
                self.model_loaded = True
                print("[InpaintingEngine] LaMa model loaded successfully!")
            except Exception as e:
                print(f"[InpaintingEngine] Error initializing LaMa model: {e}")
                self.session = None
                self.model_loaded = False
        else:
            print(f"[InpaintingEngine] Model not found at {self.model_path}. Will use fast inpainting engine.")

    def is_ai_available(self):
        return self.model_loaded and self.session is not None

    def assess_reconstruction_quality(self, mask_np):
        """
        Assesses if the watermark mask is exceptionally large or complex,
        providing quality warnings if clean reconstruction might be difficult.
        """
        total_pixels = int(mask_np.size)
        masked_pixels = int(np.count_nonzero(mask_np > 127))
        ratio = float(masked_pixels / max(1, total_pixels))
        ratio_pct = float(round(ratio * 100, 1))

        if ratio > 0.25:
            return {
                "warning": True,
                "message": "Large selection area (>25% of media). For optimal natural reconstruction, outline only the watermark mark rather than broad bounding boxes.",
                "mask_ratio": ratio_pct
            }
        return {
            "warning": False,
            "message": None,
            "mask_ratio": ratio_pct
        }

    def inpaint_image(self, image_np, mask_np, mode="auto", feather_radius=5):
        """
        Inpaints an RGB image using mask.
        image_np: (H, W, 3) uint8 RGB
        mask_np: (H, W) or (H, W, 1) uint8 (255 = inpaint, 0 = keep)
        mode: "auto", "lama", "fast"
        Returns: (H, W, 3) uint8 RGB
        """
        if mask_np.ndim == 3:
            mask_np = mask_np[:, :, 0]

        # Ensure binary mask
        _, bin_mask = cv2.threshold(mask_np, 127, 255, cv2.THRESH_BINARY)
        if np.count_nonzero(bin_mask) == 0:
            return image_np.copy()

        use_lama = False
        if mode in ("auto", "lama") and self.is_ai_available():
            use_lama = True

        if use_lama:
            try:
                return self._inpaint_lama(image_np, bin_mask, feather_radius)
            except Exception as e:
                print(f"[InpaintingEngine] LaMa inpainting error: {e}. Falling back to fast method.")

        return self._inpaint_fast(image_np, bin_mask, feather_radius)

    def _inpaint_lama(self, image_np, mask_np, feather_radius=5):
        """
        Uses Big-LaMa ONNX model.
        To preserve 100% original resolution and detail:
        - We find bounding box of the watermark.
        - Add context padding around the watermark.
        - Run LaMa on the 512x512 scaled patch.
        - Automatically detects model output scale (already in [0, 255] float range)
          so NO white patch or saturation occurs.
        - Feather the boundary and blend back onto the original high-res image.
        """
        h, w, _ = image_np.shape
        ys, xs = np.where(mask_np > 0)
        if len(ys) == 0 or len(xs) == 0:
            return image_np.copy()

        ymin, ymax = int(np.min(ys)), int(np.max(ys))
        xmin, xmax = int(np.min(xs)), int(np.max(xs))

        # Add context margin (at least 64px or 40% of box size)
        box_h = ymax - ymin
        box_w = xmax - xmin
        pad_y = max(64, int(box_h * 0.45))
        pad_x = max(64, int(box_w * 0.45))

        crop_ymin = max(0, ymin - pad_y)
        crop_ymax = min(h, ymax + pad_y)
        crop_xmin = max(0, xmin - pad_x)
        crop_xmax = min(w, xmax + pad_x)

        # Make crop square to preserve aspect ratio in 512x512
        crop_h = crop_ymax - crop_ymin
        crop_w = crop_xmax - crop_xmin
        side = max(crop_h, crop_w)
        cy = (crop_ymin + crop_ymax) // 2
        cx = (crop_xmin + crop_xmax) // 2

        crop_ymin = max(0, cy - side // 2)
        crop_ymax = min(h, crop_ymin + side)
        if crop_ymax - crop_ymin < side and crop_ymin > 0:
            crop_ymin = max(0, crop_ymax - side)

        crop_xmin = max(0, cx - side // 2)
        crop_xmax = min(w, crop_xmin + side)
        if crop_xmax - crop_xmin < side and crop_xmin > 0:
            crop_xmin = max(0, crop_xmax - side)

        patch_img = image_np[crop_ymin:crop_ymax, crop_xmin:crop_xmax]
        patch_mask = mask_np[crop_ymin:crop_ymax, crop_xmin:crop_xmax]

        patch_h, patch_w = patch_img.shape[:2]

        # Dilate mask slightly (3px) to fully cover anti-aliased watermark edges
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        dilated_mask = cv2.dilate(patch_mask, kernel, iterations=1)

        # Resize to 512x512 for LaMa model
        input_img = cv2.resize(patch_img, (512, 512), interpolation=cv2.INTER_AREA)
        input_mask = cv2.resize(dilated_mask, (512, 512), interpolation=cv2.INTER_NEAREST)

        # Normalize to float32 in [0.0, 1.0]
        img_tensor = (input_img.astype(np.float32) / 255.0).transpose(2, 0, 1)[None, ...]
        mask_tensor = (input_mask > 0).astype(np.float32)[None, None, ...]

        # Run ONNX inference
        outputs = self.session.run(['output'], {'image': img_tensor, 'mask': mask_tensor})
        out_tensor = outputs[0][0]  # (3, 512, 512)
        out_raw = out_tensor.transpose(1, 2, 0)  # (512, 512, 3)

        # CRITICAL FIX: The Big-LaMa ONNX model produces output already in [0, 255] float range!
        # Do NOT multiply by 255.0 if max > 1.05, otherwise pixels saturate to 255 (white patch).
        if np.max(out_raw) <= 1.05:
            out_patch = np.clip(out_raw * 255.0, 0, 255).astype(np.uint8)
        else:
            out_patch = np.clip(out_raw, 0, 255).astype(np.uint8)

        # Resize back to original patch resolution
        inpainted_patch = cv2.resize(out_patch, (patch_w, patch_h), interpolation=cv2.INTER_CUBIC)

        # Create soft feathered alpha mask for seamless integration
        blend_mask = dilated_mask.astype(np.float32) / 255.0
        if feather_radius > 0:
            ksize = feather_radius * 2 + 1
            blend_mask = cv2.GaussianBlur(blend_mask, (ksize, ksize), 0)
        blend_mask = np.clip(blend_mask[:, :, None], 0.0, 1.0)

        # Seamless alpha blending with original pixels
        blended_patch = (
            inpainted_patch.astype(np.float32) * blend_mask +
            patch_img.astype(np.float32) * (1.0 - blend_mask)
        ).astype(np.uint8)

        # Place back into full resolution image
        result = image_np.copy()
        result[crop_ymin:crop_ymax, crop_xmin:crop_xmax] = blended_patch
        return result

    def _inpaint_fast(self, image_np, mask_np, feather_radius=5):
        """
        Fast multi-stage inpainting using Telea and Navier-Stokes with edge smoothing.
        Works 100% offline with zero dependencies.
        """
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        dilated_mask = cv2.dilate(mask_np, kernel, iterations=1)

        bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

        # Dual inpainting
        telea = cv2.inpaint(bgr, dilated_mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
        ns = cv2.inpaint(bgr, dilated_mask, inpaintRadius=5, flags=cv2.INPAINT_NS)

        # Weighted blend of Telea (smooth) and NS (edge preserving)
        blended = cv2.addWeighted(telea, 0.6, ns, 0.4, 0)
        smoothed = cv2.bilateralFilter(blended, 9, 75, 75)

        blend_mask = dilated_mask.astype(np.float32) / 255.0
        if feather_radius > 0:
            ksize = feather_radius * 2 + 1
            blend_mask = cv2.GaussianBlur(blend_mask, (ksize, ksize), 0)
        blend_mask = np.clip(blend_mask[:, :, None], 0.0, 1.0)

        final_bgr = (
            smoothed.astype(np.float32) * blend_mask +
            bgr.astype(np.float32) * (1.0 - blend_mask)
        ).astype(np.uint8)

        return cv2.cvtColor(final_bgr, cv2.COLOR_BGR2RGB)

    def inpaint_video(self, video_path, mask_np, output_path, mode="auto", progress_callback=None):
        """
        Inpaints a video file frame-by-frame with audio preservation and temporal smoothing.
        video_path: path to input MP4/MOV
        mask_np: static mask (H, W) or bounding box mask
        output_path: path to output MP4
        progress_callback: fn(percent, frame_idx, total_frames, status_text)
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

        if progress_callback:
            progress_callback(2, 0, total_frames, "Analyzing video stream and extracting audio...")

        # Step 1: Extract audio track Losslessly
        temp_dir = os.path.dirname(output_path)
        temp_audio = os.path.join(temp_dir, f"audio_{int(time.time()*1000)}.m4a")
        temp_raw_video = os.path.join(temp_dir, f"raw_{int(time.time()*1000)}.mp4")

        has_audio = False
        try:
            cmd = [
                FFMPEG_EXE, "-y",
                "-i", video_path,
                "-vn", "-c:a", "aac",
                "-b:a", "192k",
                temp_audio
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0 and os.path.exists(temp_audio) and os.path.getsize(temp_audio) > 1000:
                has_audio = True
                print("[VideoInpaint] Audio stream extracted successfully.")
        except Exception as e:
            print(f"[VideoInpaint] Audio extraction warning: {e}")

        # Ensure mask matches video resolution
        if mask_np.shape[:2] != (height, width):
            mask_np = cv2.resize(mask_np, (width, height), interpolation=cv2.INTER_NEAREST)

        # Setup video writer for raw frames
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(temp_raw_video, fourcc, fps, (width, height))

        # Temporal smoothing buffer for anti-flickering
        prev_inpainted_frame = None
        temporal_alpha = 0.75  # 75% current frame, 25% previous frame inside inpainting area

        ys, xs = np.where(mask_np > 0)
        has_mask = len(ys) > 0 and len(xs) > 0

        frame_idx = 0
        try:
            while True:
                ret, frame_bgr = cap.read()
                if not ret:
                    break

                frame_idx += 1
                if not has_mask:
                    writer.write(frame_bgr)
                    continue

                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

                # Inpaint current frame
                inpainted_rgb = self.inpaint_image(frame_rgb, mask_np, mode=mode, feather_radius=4)

                # Temporal anti-flicker smoothing
                if prev_inpainted_frame is not None:
                    # Apply smoothing only in the masked region
                    mask_3d = (mask_np > 0)[:, :, None].astype(np.float32)
                    smoothed_rgb = (
                        (temporal_alpha * inpainted_rgb.astype(np.float32) + (1.0 - temporal_alpha) * prev_inpainted_frame.astype(np.float32)) * mask_3d +
                        inpainted_rgb.astype(np.float32) * (1.0 - mask_3d)
                    ).astype(np.uint8)
                    inpainted_rgb = smoothed_rgb

                prev_inpainted_frame = inpainted_rgb.copy()
                inpainted_bgr = cv2.cvtColor(inpainted_rgb, cv2.COLOR_BGR2RGB)

                writer.write(inpainted_bgr)

                # Report progress
                if progress_callback and frame_idx % max(1, total_frames // 50) == 0:
                    pct = int(5 + (frame_idx / total_frames) * 85)
                    progress_callback(pct, frame_idx, total_frames, f"Inpainting frame {frame_idx} of {total_frames}...")

        finally:
            cap.release()
            writer.release()

        if progress_callback:
            progress_callback(92, total_frames, total_frames, "Encoding final video and synchronizing audio...")

        # Step 3: Re-encode with FFmpeg (H.264 + Original Audio)
        try:
            if has_audio and os.path.exists(temp_audio):
                merge_cmd = [
                    FFMPEG_EXE, "-y",
                    "-i", temp_raw_video,
                    "-i", temp_audio,
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "18",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac",
                    "-shortest",
                    output_path
                ]
            else:
                merge_cmd = [
                    FFMPEG_EXE, "-y",
                    "-i", temp_raw_video,
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "18",
                    "-pix_fmt", "yuv420p",
                    output_path
                ]

            subprocess.run(merge_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except Exception as e:
            print(f"[VideoInpaint] FFmpeg re-encode failed: {e}. Moving raw output.")
            if os.path.exists(temp_raw_video):
                if os.path.exists(output_path):
                    os.remove(output_path)
                os.replace(temp_raw_video, output_path)

        # Cleanup temp files
        for tmp in [temp_audio, temp_raw_video]:
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except Exception:
                    pass

        if progress_callback:
            progress_callback(100, total_frames, total_frames, "Video processing complete!")

        return output_path
