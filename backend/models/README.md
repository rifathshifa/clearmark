# ClearMark AI Models Directory

Place the Big-LaMa ONNX model weights in this directory:
- Filename: `lama_fp32.onnx`
- Default Location: `backend/models/lama_fp32.onnx`

When `lama_fp32.onnx` is present, ClearMark automatically enables the deep neural reconstruction engine. If absent, ClearMark seamlessly falls back to the high-performance optical inpainting engine.
