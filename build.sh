#!/usr/bin/env bash
# Exit on any error
set -o errexit

echo "=========================================="
echo "    ClearMark - Render Build Process     "
echo "=========================================="

echo "[1/3] Upgrading pip and installing Python dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "[2/3] Preparing frontend production assets..."
# Render's native Python environment does not include Node.js/npm.
# If npm is not found, dynamically install a standalone Node.js portable binary.
if ! command -v npm &> /dev/null; then
  echo "Node.js / npm not found in Python environment. Downloading portable Node.js..."
  NODE_VERSION="v20.18.0"
  NODE_DIR="$HOME/.nodejs"
  mkdir -p "$NODE_DIR"
  if curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz" | tar -xz -C "$NODE_DIR" --strip-components=1 2>/dev/null; then
    export PATH="$NODE_DIR/bin:$PATH"
    echo "Portable Node.js ($(${NODE_DIR}/bin/node --version)) and npm ($(${NODE_DIR}/bin/npm --version)) installed successfully."
  else
    echo "Notice: Could not download standalone Node.js."
  fi
fi

# Build frontend if npm is available
if command -v npm &> /dev/null; then
  echo "Installing frontend dependencies and compiling assets..."
  npm --prefix frontend install
  npm --prefix frontend run build
  echo "Frontend build completed successfully."
else
  if [ -d "frontend/dist" ] && [ -f "frontend/dist/index.html" ]; then
    echo "Using pre-built frontend production assets in frontend/dist."
  else
    echo "Error: Neither npm is available nor frontend/dist exists."
    exit 1
  fi
fi

# Also sync build to backend/dist for dual-path frontend fallback serving
mkdir -p backend/dist
cp -r frontend/dist/* backend/dist/ 2>/dev/null || true

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

if [ -f "frontend/dist/index.html" ]; then
  echo "[OK] Frontend dist/index.html verified"
fi

echo "=========================================="
echo "      Build Completed Successfully!       "
echo "=========================================="
