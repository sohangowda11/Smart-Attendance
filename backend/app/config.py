import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
ENROLLMENTS_DIR = STORAGE_DIR / "enrollments"
UPLOADS_DIR = STORAGE_DIR / "uploads"
PROCESSED_DIR = STORAGE_DIR / "processed"
REPORTS_DIR = STORAGE_DIR / "reports"

for directory in [STORAGE_DIR, ENROLLMENTS_DIR, UPLOADS_DIR, PROCESSED_DIR, REPORTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

class Settings:
    PROJECT_NAME: str = "SYNAPSE"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "synapse-super-secret-key-3b61c3e7-2638-4a9e-8cef-8e96bc49689c")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'synapse.db'}")
    
    # AI Engine Thresholds
    FACE_RECOGNITION_TOLERANCE: float = 0.52 # lower = stricter distance
    HIGH_CONFIDENCE_THRESHOLD: float = 0.65  # normalized confidence (1 - distance)
    MEDIUM_CONFIDENCE_THRESHOLD: float = 0.48
    MIN_OBSERVATION_COUNT: int = 2 # require at least 2 consistent frame detections
    LATE_GRACE_PERIOD_MINUTES: int = 10
    MIN_ATTENDANCE_PERCENTAGE: float = 75.0
    
    # Video processing
    FRAME_SAMPLE_RATE: int = 4 # process every 4th frame for high FPS + thorough accuracy
    MAX_UPLOAD_SIZE_MB: int = 250

settings = Settings()
