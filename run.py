#!/usr/bin/env python3
"""
VMC Road Management System — Quick start script.
Run from the project root: python run.py
"""
import subprocess, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def main():
    env_file = ROOT / ".env"
    if not env_file.exists():
        import shutil
        shutil.copy(ROOT / ".env.example", env_file)
        print("Created .env from .env.example — please update MONGODB_URI before running!")

    # Create outputs directory
    (ROOT / "outputs").mkdir(exist_ok=True)

    print("=" * 60)
    print("  VMC Road Management System")
    print("  http://localhost:8000")
    print("=" * 60)
    print()

    os.chdir(ROOT)
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload",
        "--reload-dir", "app",
    ], cwd=str(ROOT))

if __name__ == "__main__":
    main()
