import time
import requests
import numpy as np
import cv2
import base64
import subprocess
import imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# 1. Create a 30-frame (1-second) test video with an audio track and a corner watermark
video_filename = "test_input.mp4"
fps = 30
width, height = 480, 320
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter("temp_raw.mp4", fourcc, fps, (width, height))

for i in range(fps):
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    # Moving color hue
    frame[:] = [int(150 + 50 * np.sin(i / 5)), 180, 220]
    # Watermark text at (260, 270)
    cv2.putText(frame, "LOGO_WATERMARK", (240, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    out.write(frame)
out.release()

# Add a 1-second 440Hz test sine audio tone to video using ffmpeg
cmd = [
    ffmpeg_exe, "-y",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    "-i", "temp_raw.mp4",
    "-c:v", "libx264", "-c:a", "aac",
    "-shortest", video_filename
]
subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
print("Synthetic test video created with audio track!")

# 2. Create watermark mask covering (230, 250) to (470, 310)
mask = np.zeros((height, width), dtype=np.uint8)
cv2.rectangle(mask, (230, 250), (470, 310), 255, -1)
_, mask_buf = cv2.imencode('.png', mask)
mask_b64 = 'data:image/png;base64,' + base64.b64encode(mask_buf).decode('utf-8')

# 3. Submit to /api/inpaint/video
print("Submitting video to /api/inpaint/video...")
with open(video_filename, "rb") as vf:
    res = requests.post(
        "http://localhost:5000/api/inpaint/video",
        files={"video": ("test_input.mp4", vf, "video/mp4")},
        data={"mask_base64": mask_b64, "mode": "fast"}  # fast optical mode for quick frame test
    )
data = res.json()
print("Submit response:", data)
task_id = data["task_id"]

# 4. Poll status
for _ in range(30):
    time.sleep(1)
    status_res = requests.get(f"http://localhost:5000/api/inpaint/video/status/{task_id}")
    s = status_res.json()
    print(f"Task status: {s.get('status')}, progress: {s.get('progress')}%, frame: {s.get('current_frame')}/{s.get('total_frames')}")
    if s.get("status") == "completed":
        print("Video inpainting completed successfully! Download url:", s.get("download_url"))
        break
    elif s.get("status") == "failed":
        print("Video inpainting failed:", s.get("error"))
        break
