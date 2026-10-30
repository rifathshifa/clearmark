# ClearMark — Neural Photo & Video Watermark Remover

> **"Remove marks. Keep memories."**

A modern, responsive web application for removing watermarks, logos, timestamps, and AI symbols from **both photos and videos** using state-of-the-art **Big-LaMa Deep Convolutional Neural Inpainting**, React, Tailwind CSS with a distinctive **Light Green (Mint/Sage)** design, PostgreSQL persistence, and Python Flask.

---

## ✨ Key Features

- **Dual Modes**: Dedicated **Photo Remover** & **Video Remover**.
- **Supported Photo Formats**: JPG, JPEG, PNG, WEBP (Lossless resolution & detail preserved).
- **Supported Video Formats**: MP4, MOV, WEBM with **1:1 Audio Track Preservation** and anti-flicker temporal smoothing.
- **Deep Neural Inpainting**: Powered by the **Big-LaMa FP32 ONNX** model (reconstructs natural textures, sky, foliage, and patterns rather than blurring or smearing).
- **Fast Optical Fallback**: Dual Telea & Navier-Stokes inpainting engine with edge feathering for instant offline processing.
- **Interactive Canvas Editor**:
  - Freehand **Brush Tool** with custom sizing and circle cursor tracking.
  - **Rectangle Bounding Box Tool** for instant box selections.
  - **Quick Presets**: Bottom-Right (Gemini / TikTok watermark), Bottom-Left, Top-Right, Center Logo.
  - **Eraser**, **Undo**, **Redo**, and **Clear**.
  - **Soft Edge Feathering slider** (0-15px) for seamless gradient blending.
- **Real-Time Video Progress**: Live frame counter, percentage bar, and status stages.
- **Before / After Comparison**:
  - Draggable **Interactive Split Slider**.
  - **Side-by-Side** comparison mode.
  - **Hold to View Original** toggle.
- **PostgreSQL Persistence & History**: Track recently processed media, metrics, and download links in real-time.
- **Database Viewer**: Built-in interactive CLI and graphical database inspector (`view_database.bat` & `view_database.py`).
- **Aesthetics**: Premium **Light Green (Mint & Sage)** glassmorphism, responsive mobile layout, and smooth animations.
- **Security & Privacy**: Strict MIME/extension validation, size caps (50MB photo / 200MB video), and automatic temporary file cleanup.
- **Ethical Use Policy**: Built-in modal and guidelines for authorized media modification only.

---

## 🚀 One-Click Launch (`start.bat`)

Double-click `start.bat` in the project root:

```cmd
start.bat
```

What `start.bat` does automatically:
1. Verifies **Python 3.9+** and **Node.js** in PATH.
2. Checks backend dependencies (`flask`, `cv2`, `onnxruntime`, `imageio-ffmpeg`, `sqlalchemy`, `psycopg2`) and installs them if missing.
3. Checks frontend dependencies and runs `npm install` inside `frontend/` if needed.
4. Starts the **Flask Backend** in a separate terminal on `http://localhost:5000`.
5. Starts the **Vite React Dev Server** in a separate terminal on `http://localhost:5173`.
6. Opens `http://localhost:5173/` in your default browser.

### 🛑 How to Stop the Services
- Simply close the two opened terminal windows:
  - `ClearMark - Backend Server [Port 5000]`
  - `ClearMark - Frontend Client [Port 5173]`
- Or press `Ctrl + C` inside each terminal window.

---

## 🛠 Manual Installation & Startup

### 1. Backend (Python Flask + PostgreSQL)
```bash
cd backend
pip install -r requirements.txt

# Configure PostgreSQL in backend/.env (Optional for local dev, required for PostgreSQL persistence)
# Example:
# DATABASE_URL=postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require

# Verify database connection and create tables
python migrate_db.py

# Start Flask server
python app.py
```
- Server starts on `http://localhost:5000`.
- The Big-LaMa ONNX model weights (`lama_fp32.onnx`, ~208MB) are stored in `backend/models/`.
- All uploads, processed files, processing jobs, and metrics are persistently recorded in PostgreSQL.

### 2. Frontend (React + Vite + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```
- Web interface opens at `http://localhost:5173`.

---

## 📊 PostgreSQL Database Viewer

To inspect database tables, schemas, record counts, and ER diagrams:

```cmd
view_database.bat
```
or
```bash
python view_database.py
```

---

## 🧠 AI Model & Video Architecture

1. **Photo Inpainting**:
   - The user's mask is mapped to high-resolution bounding boxes with dynamic contextual padding.
   - The patch is scaled to 512×512, processed through Big-LaMa ONNX, scaled back, and feathered with Gaussian edge blending.
   - **100% of the untouched image retains its original uncompressed pixels**.

2. **Video Inpainting & Audio Preservation**:
   - Frames are extracted using `cv2.VideoCapture` and `imageio_ffmpeg`.
   - The original audio stream (AAC/M4A) is extracted losslessly via FFmpeg.
   - Each frame is inpainted with temporal consistency to prevent flickering.
   - Frames are remuxed with the original audio stream into high-compatibility H.264 MP4 (`-c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac`).

---

## ⚖️ Authorized Use & Ethical Guidelines

- **Authorized Media Only**: Only remove watermarks from photos or videos that you personally created, own, or have written permission from the copyright holder to edit.
- **Preserve Provenance**: Do not use this tool to remove cryptographic provenance metadata (e.g., C2PA tags) or authenticity badges without authorization.
- **Model Realism Limitations**: Neural inpainting reconstructs backgrounds based on neighboring patterns. While it excels on natural textures (sky, water, foliage, fabric, walls), it cannot hallucinate non-repetitive foreground details like unique human faces or complex text occluded by large watermarks.

---

## 📄 License & Attribution

© 2026 Rifath Shifa M. All Rights Reserved.  
Developed by **Rifath Shifa M**
