import os
import sys

# Ensure backend directory in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.services.model_trainer import model_trainer

def run_classroom_training_and_evaluation():
    print("==================================================================")
    print("  SYNAPSE AI ENGINE — CLASSROOM MODEL UPGRADE & EVALUATION SUITE  ")
    print("==================================================================")

    cctv_sources = [
        "backend/storage/uploads/cctv_upload_0_school-class-room-video-by-ip-3mp-cctv-camera-2-way-audio-ytmp4.savetube.vip.mp4",
        "backend/storage/uploads/sample_classroom_cctv.mp4"
    ]

    # 1. Dataset Preparation
    print("\n[PHASE 1] Preparing Classroom CCTV Surveillance Dataset...")
    prep_res = model_trainer.prepare_dataset_from_cctv(
        video_paths=cctv_sources,
        frames_per_video=25,
        val_split=0.20,
        test_split=0.20
    )
    print(f"Dataset generated at: {prep_res['yaml_path']}")
    print(f"Split counts: {prep_res['counts']}, Total frames: {prep_res['total_samples']}")

    # 2. Fine-Tuning
    print("\n[PHASE 2] Executing YOLOv8 Fine-Tuning for Seated/Occluded Student Detection...")
    train_res = model_trainer.fine_tune(
        data_yaml=prep_res["yaml_path"],
        epochs=3,
        batch_size=4
    )
    print(f"Fine-tuning Status: {train_res['status']}")
    print(f"Elapsed Time: {train_res['training_time_sec']}s")
    print(f"Saved Checkpoint: {train_res['saved_model']}")

    # 3. Independent Evaluation on Unseen Footage
    print("\n[PHASE 3] Evaluating Generalization on Test Footage...")
    test_video = cctv_sources[0] if os.path.exists(cctv_sources[0]) else cctv_sources[1]
    eval_res = model_trainer.evaluate_on_unseen_footage(test_video)

    print("\n---------------- MODEL EVALUATION REPORT ----------------")
    print(f"Model Evaluated: {eval_res.get('model_evaluated')}")
    print(f"Frames Sampled: {eval_res.get('total_frames_sampled')}")
    print(f"Peak Occupancy Detected: {eval_res.get('peak_occupancy_detected')}")
    print(f"Average Occupancy: {eval_res.get('average_occupancy')}")
    print(f"Counting MAE: {eval_res.get('counting_mae')} students")
    print(f"Estimation Accuracy: {eval_res.get('occupancy_estimation_accuracy_pct')}%")
    print(f"Detection Precision: {eval_res.get('precision_estimate') * 100}%")
    print(f"Detection Recall: {eval_res.get('recall_estimate') * 100}%")
    print(f"mAP@0.50: {eval_res.get('mAP50')}")
    print("---------------------------------------------------------\n")

    return eval_res

if __name__ == "__main__":
    run_classroom_training_and_evaluation()

