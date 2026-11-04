import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def main():
    print("=" * 65)
    print("  SYNAPSE // AI SMART ATTENDANCE & CLASSROOM INTELLIGENCE")
    print("  Initializing Platform Services...")
    print("=" * 65)

    # 1. Check database and seed data
    db_file = ROOT_DIR / "backend" / "storage" / "synapse.db"
    base_db_file = ROOT_DIR / "backend" / "synapse.db"
    
    print("\n[1/3] Verifying database schema and biometric models...")
    try:
        subprocess.run(
            [sys.executable, "-m", "backend.app.seed.seed_data"],
            cwd=str(ROOT_DIR),
            check=True
        )
    except Exception as e:
        print(f"Warning during seed check: {e}")

    # 2. Start Backend API
    print("\n[2/3] Launching FastAPI Backend on http://localhost:8000 ...")
    backend_env = os.environ.copy()
    backend_proc = subprocess.Popen(
        [sys.executable, str(ROOT_DIR / "backend" / "run.py")],
        cwd=str(ROOT_DIR),
        env=backend_env
    )

    # 3. Start Frontend Client
    print("\n[3/3] Launching Vite React Frontend on http://localhost:5173 ...")
    frontend_dir = ROOT_DIR / "frontend"
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(frontend_dir)
    )

    # 4. Wait for servers to spin up
    print("\nWaiting for services to spin up...")
    time.sleep(3)

    # 5. Open Browser
    app_url = "http://localhost:5173"
    print(f"\nOpening SYNAPSE in your browser at {app_url} ...")
    try:
        webbrowser.open(app_url)
    except Exception as e:
        print(f"Could not open browser automatically: {e}")

    print("\n" + "=" * 65)
    print("  SYNAPSE PLATFORM IS NOW ONLINE & OPERATIONAL!")
    print(f"  • Frontend UI:     {app_url}")
    print("  • Backend API:     http://localhost:8000")
    print("  • API Swagger:     http://localhost:8000/docs")
    print("\n  Demo Credentials:")
    print("  • Admin:   admin@synapse.ai   /  Admin@123")
    print("  • Faculty: dr.sharma@synapse.ai / Faculty@123")
    print("=" * 65)
    print("\nPress Ctrl+C to gracefully stop all services.\n")

    try:
        while True:
            time.sleep(1)
            # Check if any process terminated unexpectedly
            if backend_proc.poll() is not None:
                print("Backend process ended.")
                break
            if frontend_proc.poll() is not None:
                print("Frontend process ended.")
                break
    except KeyboardInterrupt:
        print("\nStopping SYNAPSE services...")
    finally:
        if backend_proc.poll() is None:
            backend_proc.terminate()
        if frontend_proc.poll() is None:
            frontend_proc.terminate()
        print("All SYNAPSE services stopped cleanly.")

if __name__ == "__main__":
    main()

