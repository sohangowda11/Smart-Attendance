import os
import sys
import time
import subprocess
import webbrowser
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def free_port(port: int):
    """Kills any orphaned processes occupying the required port on Windows."""
    if sys.platform != "win32":
        return
    try:
        cmd = f"netstat -ano | findstr :{port}"
        output = subprocess.check_output(cmd, shell=True, text=True, errors="ignore")
        for line in output.strip().splitlines():
            parts = line.split()
            if len(parts) >= 5 and "LISTENING" in parts:
                pid = parts[-1]
                if pid.isdigit() and int(pid) != os.getpid():
                    print(f"  [PORT {port}] Clearing lingering process PID {pid}...")
                    subprocess.run(f"taskkill /F /T /PID {pid}", shell=True, capture_output=True)
    except Exception:
        pass

def wait_for_service(url: str, label: str, max_retries: int = 30) -> bool:
    """Polls an HTTP endpoint until it answers with HTTP 200/304."""
    for i in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SynapseHealthCheck/1.0"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status in (200, 304):
                    return True
        except Exception:
            pass
        time.sleep(1)
        if (i + 1) % 5 == 0:
            print(f"  Waiting for {label}... ({i + 1}s)")
    return False

def kill_process_tree(proc: subprocess.Popen):
    """Safely kills the entire process tree including child processes on Windows."""
    if proc is None:
        return
    try:
        if sys.platform == "win32":
            subprocess.run(f"taskkill /F /T /PID {proc.pid}", shell=True, capture_output=True)
        else:
            proc.terminate()
    except Exception:
        pass

def main():
    print("=" * 68)
    print("  SYNAPSE // AI SMART ATTENDANCE & CLASSROOM INTELLIGENCE PLATFORM")
    print("  Initializing Platform Engine & Services...")
    print("=" * 68)

    # 1. Clean up lingering processes from any previous runs
    print("\n[1/5] Ensuring communication ports 8000 and 5173 are free...")
    free_port(8000)
    free_port(5173)

    # 2. Verify database schema and seed data
    print("\n[2/5] Verifying database schema and biometric models...")
    try:
        subprocess.run(
            [sys.executable, "-m", "backend.app.seed.seed_data"],
            cwd=str(ROOT_DIR),
            check=True
        )
    except Exception as e:
        print(f"  Notice during seed check: {e}")

    # 3. Start Backend API Server
    print("\n[3/5] Launching FastAPI Backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, str(ROOT_DIR / "backend" / "run.py")],
        cwd=str(ROOT_DIR)
    )

    # 4. Start Frontend Client
    print("\n[4/5] Launching Vite React Frontend on http://localhost:5173 ...")
    frontend_dir = ROOT_DIR / "frontend"
    # Clean lingering temporary Vite lock directories to avoid EPERM file locking
    vite_dir = frontend_dir / "node_modules" / ".vite"
    if vite_dir.exists():
        for temp_p in vite_dir.glob("deps_temp*"):
            try:
                import shutil
                shutil.rmtree(temp_p, ignore_errors=True)
            except Exception:
                pass
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(frontend_dir),
        shell=(sys.platform == "win32")
    )

    # 5. Wait for both services to be verified healthy
    print("\n[5/5] Performing health verification on all platform endpoints...")
    backend_ready = wait_for_service("http://127.0.0.1:8000/", "FastAPI Backend", max_retries=25)
    frontend_ready = wait_for_service("http://127.0.0.1:5173/", "Vite Frontend", max_retries=20)

    app_url = "http://localhost:5173"

    if backend_ready and frontend_ready:
        print("\n" + "=" * 68)
        print("  SYNAPSE PLATFORM IS FULLY OPERATIONAL!")
        print(f"  • Frontend UI:     {app_url}")
        print("  • Backend API:     http://localhost:8000")
        print("  • API Swagger:     http://localhost:8000/docs")
        print("\n  Demo Credentials:")
        print("  • Admin:   admin@synapse.ai   /  Admin@123")
        print("  • Faculty: dr.sharma@synapse.ai / Faculty@123")
        print("=" * 68)
        print(f"\nOpening SYNAPSE in your browser at {app_url} ...\n")
        try:
            webbrowser.open(app_url)
        except Exception as e:
            print(f"Could not open browser automatically: {e}")
    else:
        print("\n[WARNING] One or more services took longer to initialize:")
        print(f"  • Backend Ready:  {backend_ready}")
        print(f"  • Frontend Ready: {frontend_ready}")
        print(f"  You can still manually access {app_url}")

    print("Press Ctrl+C to stop all SYNAPSE services cleanly.\n")

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("\n[Notice] Backend process ended.")
                break
            if frontend_proc.poll() is not None:
                print("\n[Notice] Frontend process ended.")
                break
    except KeyboardInterrupt:
        print("\nStopping SYNAPSE services...")
    finally:
        print("Stopping backend and frontend process trees...")
        kill_process_tree(backend_proc)
        kill_process_tree(frontend_proc)
        free_port(8000)
        free_port(5173)
        print("All SYNAPSE services stopped cleanly. Ports released.")

if __name__ == "__main__":
    main()
