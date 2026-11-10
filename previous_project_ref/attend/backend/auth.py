import hashlib
import json
import base64
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse

# Simple hardcoded Admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD_HASH = hashlib.sha256("password123".encode()).hexdigest()

def verify_password(plain_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == ADMIN_PASSWORD_HASH

def create_session_token(username: str) -> str:
    # A simple mock session token. In production, use JWT.
    payload = json.dumps({"sub": username, "role": "admin"})
    return base64.b64encode(payload.encode()).decode()

def verify_session(request: Request) -> bool:
    token = request.cookies.get("admin_session")
    if not token:
        return False
    try:
        decoded = base64.b64decode(token).decode()
        data = json.loads(decoded)
        return data.get("role") == "admin"
    except Exception:
        return False

def require_admin(request: Request):
    if not verify_session(request):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True
