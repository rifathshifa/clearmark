import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app as application
app = application

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
