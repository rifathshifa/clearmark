#!/usr/bin/env bash
# Exit on any error
set -o errexit

echo "=========================================="
echo "    ClearMark - Render Build Process     "
echo "=========================================="

echo "[1/3] Upgrading pip and installing Python dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "[2/3] Installing frontend dependencies and building production assets..."
npm --prefix frontend install
npm --prefix frontend run build

# Optional: Download LaMa neural model weights if DOWNLOAD_MODEL=true
if [ "$DOWNLOAD_MODEL" = "true" ] || [ "$DOWNLOAD_MODEL" = "1" ]; then
  echo "[Optional] Downloading Big-LaMa ONNX model weights..."
  mkdir -p backend/models
  if [ ! -f backend/models/lama_fp32.onnx ]; then
    curl -L -o backend/models/lama_fp32.onnx "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx"
  fi
fi

echo "[3/3] Verifying backend and frontend build..."
python -c "import flask, cv2, onnxruntime, imageio_ffmpeg, sqlalchemy, psycopg2; print('[OK] Python backend dependencies verified')"

echo "=========================================="
echo "      Build Completed Successfully!       "
echo "=========================================="
