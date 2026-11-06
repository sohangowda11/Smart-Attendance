import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.database import SessionLocal
from app.services.video_processor import video_processor
from app.models.timetable import LectureSession

def test_ai_pipeline():
    db = SessionLocal()
    session = db.query(LectureSession).first()
    if not session:
        print("[ERROR] No lecture session found in database.")
        db.close()
        return

    print(f"[TEST] Running SYNAPSE AI Upgraded Pipeline on Session #{session.id}...")
    
    # Check for real CCTV video
    cctv_path = "backend/storage/uploads/cctv_upload_0_school-class-room-video-by-ip-3mp-cctv-camera-2-way-audio-ytmp4.savetube.vip.mp4"
    if not os.path.exists(cctv_path):
        cctv_path = "backend/storage/uploads/sample_classroom_cctv.mp4"

    print(f"[TEST] Using classroom footage: {cctv_path}")
    res = video_processor.process_video_file(db, session.id, cctv_path)
    
    print("\n--- SYNAPSE CCTV AI ANALYSIS RESULTS ---")
    print(f"Status: {res.get('status')}")
    print(f"Output Annotated Video: {res.get('annotated_video')}")
    print(f"Total Frames: {res.get('total_frames')}")
    print(f"Peak Simultaneous Occupancy: {res.get('max_occupancy')} students")
    print(f"Average Occupancy: {res.get('avg_occupancy')} students")
    print(f"Minimum Occupancy: {res.get('min_occupancy')} students")
    print(f"Unique Tracked Individuals: {res.get('unique_tracks')} students")
    print(f"Recognized Students: {res.get('total_recognized')} students")
    print(f"Timeline Sample Points: {len(res.get('frame_occupancy_timeline', []))}")
    print("----------------------------------------\n")
    
    db.close()

if __name__ == "__main__":
    test_ai_pipeline()
