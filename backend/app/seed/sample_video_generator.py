import os
import cv2
import numpy as np
from pathlib import Path
from sklearn.datasets import fetch_olivetti_faces
from ..config import STORAGE_DIR, ENROLLMENTS_DIR, UPLOADS_DIR

def generate_classroom_footage_and_enrollments():
    """
    Generates reference biometric enrollment photos for students
    and creates a real classroom CCTV video footage for testing.
    """
    print("Preparing face database and sample CCTV video...")
    data_home = str(STORAGE_DIR / "sklearn_data")
    data = fetch_olivetti_faces(data_home=data_home)
    
    # Save individual reference photos for students (Subject 0 to 19)
    student_photos = {}
    for i in range(20):
        # Image 0 of each subject is the enrolled reference portrait
        raw_img = (data.images[i * 10] * 255).astype(np.uint8)
        resized = cv2.resize(raw_img, (220, 220))
        bgr = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
        
        # Add subtle portrait border
        cv2.rectangle(bgr, (0, 0), (219, 219), (40, 40, 40), 1)
        
        photo_filename = f"student_ref_{i + 1}.jpg"
        photo_path = ENROLLMENTS_DIR / photo_filename
        cv2.imwrite(str(photo_path), bgr)
        student_photos[i + 1] = str(photo_path)

    # Now create sample classroom CCTV video
    sample_video_path = UPLOADS_DIR / "sample_classroom_cctv.mp4"
    if sample_video_path.exists():
        print(f"Sample classroom video already exists at {sample_video_path}")
        return student_photos, str(sample_video_path)

    width, height = 1280, 720
    fps = 20.0
    total_frames = 100 # 5 seconds of footage
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(str(sample_video_path), fourcc, fps, (width, height))

    # We will position 5 students in classroom desk positions
    # Student 1: x=220, y=280
    # Student 2: x=520, y=280
    # Student 3: x=820, y=280
    # Student 4: x=360, y=460
    # Student 5: x=680, y=460
    students_in_room = [
        {"subject_idx": 0, "base_x": 240, "base_y": 260, "face_size": 130},
        {"subject_idx": 1, "base_x": 560, "base_y": 250, "face_size": 135},
        {"subject_idx": 2, "base_x": 880, "base_y": 260, "face_size": 125},
        {"subject_idx": 3, "base_x": 380, "base_y": 440, "face_size": 150},
        {"subject_idx": 4, "base_x": 720, "base_y": 430, "face_size": 155},
    ]

    for f_idx in range(total_frames):
        # Base classroom background (lecture hall ambient: dark wood benches, whiteboard top)
        frame = np.full((height, width, 3), (28, 25, 23), dtype=np.uint8)
        
        # Whiteboard at top
        cv2.rectangle(frame, (100, 40), (1180, 180), (220, 225, 228), -1)
        cv2.rectangle(frame, (96, 36), (1184, 184), (90, 95, 100), 4)
        cv2.putText(frame, "ADVANCED COMPUTER VISION & DEEP LEARNING (CS601)", (140, 110),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (40, 40, 50), 2, cv2.LINE_AA)
        cv2.putText(frame, "Topic: Real-time Multi-Object Tracking & ArcFace Biometrics", (140, 150),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (80, 80, 90), 1, cv2.LINE_AA)

        # Classroom Desks
        # Row 1 desk
        cv2.rectangle(frame, (120, 360), (1160, 400), (45, 52, 60), -1)
        cv2.line(frame, (120, 360), (1160, 360), (80, 90, 100), 2)
        # Row 2 desk
        cv2.rectangle(frame, (160, 560), (1120, 620), (38, 44, 50), -1)
        cv2.line(frame, (160, 560), (1120, 560), (70, 80, 90), 2)

        # Camera timecode timestamp in top right
        tc = f"CCTV-LH101 [CAM 01]  2026-11-04  10:14:{12 + f_idx//20:02d}.{f_idx%20 * 5:02d}"
        cv2.putText(frame, tc, (width - 450, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (160, 170, 180), 1, cv2.LINE_AA)

        # Draw students with slight realistic oscillation (motion)
        for st in students_in_room:
            s_idx = st["subject_idx"]
            # Pick one of the subject's 10 images with subtle changes
            img_variant = (f_idx // 15) % 10
            raw_face = (data.images[s_idx * 10 + img_variant] * 255).astype(np.uint8)
            
            f_size = st["face_size"]
            resized_face = cv2.resize(raw_face, (f_size, f_size))
            face_bgr = cv2.cvtColor(resized_face, cv2.COLOR_GRAY2BGR)

            # Apply subtle motion
            dx = int(np.sin(f_idx * 0.15 + s_idx) * 3)
            dy = int(np.cos(f_idx * 0.12 + s_idx) * 2)
            
            fx = st["base_x"] + dx
            fy = st["base_y"] + dy

            # Student body/torso
            body_w = int(f_size * 1.6)
            body_h = int(f_size * 1.4)
            bx = fx - int((body_w - f_size) / 2)
            by = fy + f_size - 10
            
            # Shirt color
            shirt_color = [(90, 60, 40), (40, 70, 90), (45, 80, 50), (75, 45, 80), (60, 60, 60)][s_idx % 5]
            cv2.ellipse(frame, (bx + body_w // 2, by + body_h // 2), (body_w // 2, body_h // 2), 0, 0, 180, shirt_color, -1)

            # Paste face into frame
            if 0 <= fy and fy + f_size <= height and 0 <= fx and fx + f_size <= width:
                # Feathered circular mask for realistic look
                frame[fy:fy + f_size, fx:fx + f_size] = face_bgr

        out.write(frame)

    out.release()
    print(f"Sample classroom CCTV video generated at: {sample_video_path}")
    return student_photos, str(sample_video_path)

