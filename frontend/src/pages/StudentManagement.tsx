import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  GraduationCap, Search, Plus, Filter,
  CheckCircle2, AlertTriangle, Upload, Eye,
  Shield, UserCheck, ArrowUpRight,
  Camera, RefreshCw, Check, X, RotateCcw, Sparkles,
  Edit3, Trash2, UserX, Play, Square, Video, ShieldAlert
} from 'lucide-react';
import { studentsApi, academicApi } from '../services/api';
import { Student, Department } from '../services/types';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | undefined>();
  const [selectedSem, setSelectedSem] = useState<number | undefined>();

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEnrollFaceOpen, setIsEnrollFaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);

  // Form states
  const [newStudent, setNewStudent] = useState({
    usn: '',
    full_name: '',
    email: '',
    phone: '',
    department_id: 1,
    semester: 6,
    section: 'A',
    consent_status: true,
  });

  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Biometric Enrollment State: Live Webcam vs Upload
  const [enrollMode, setEnrollMode] = useState<'camera' | 'upload'>('camera');
  const [enrollStream, setEnrollStream] = useState<MediaStream | null>(null);
  const [isPhotoCaptured, setIsPhotoCaptured] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [availableCams, setAvailableCams] = useState<MediaDeviceInfo[]>([]);
  const [selectedEnrollCamId, setSelectedEnrollCamId] = useState<string>('');

  // Multi-frame video enrollment state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState(5);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [multiFrameResult, setMultiFrameResult] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [faceFeedbackMsg, setFaceFeedbackMsg] = useState<string>('Position your face inside the guide.');
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [canExtend, setCanExtend] = useState<boolean>(true);

  const recordingTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const previewCheckTimerRef = useRef<any>(null);
  const totalDurationRef = useRef<number>(5000);
  const elapsedMsRef = useRef<number>(0);
  const collectedFramesRef = useRef<File[]>([]);

  // Admin Management: Edit Student State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Admin Management: Safe Deactivate / Delete Student State
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [studentToDeactivate, setStudentToDeactivate] = useState<Student | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const enrollVideoRef = useRef<HTMLVideoElement | null>(null);
  const enrollCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      stopEnrollCamera();
    };
  }, []);

  const listEnrollCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCams(videoDevices);
      if (videoDevices.length > 0 && !selectedEnrollCamId) {
        setSelectedEnrollCamId(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.error('Error listing cameras:', e);
    }
  };

  const startEnrollCamera = async (deviceId?: string) => {
    stopEnrollCamera();
    setCameraError(null);
    setIsPhotoCaptured(false);
    setCapturedPreview(null);
    setQualityWarning(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setEnrollStream(stream);

      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream;
        enrollVideoRef.current.play();
      }
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Webcam permission denied. Please allow camera access in browser permissions.'
          : err.name === 'NotFoundError'
          ? 'No webcam detected on your laptop or computer.'
          : `Webcam error: ${err.message || err.name}`;
      setCameraError(msg);
    }
  };

  const stopEnrollCamera = () => {
    if (enrollStream) {
      enrollStream.getTracks().forEach((track) => track.stop());
      setEnrollStream(null);
    }
    if (enrollVideoRef.current) {
      enrollVideoRef.current.srcObject = null;
    }
  };

  const handleCaptureWebcamPhoto = () => {
    if (!enrollVideoRef.current || !enrollCanvasRef.current) return;
    const video = enrollVideoRef.current;
    const canvas = enrollCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Quick lighting sanity check
    try {
      const imgData = ctx.getImageData(
        Math.floor(canvas.width / 4),
        Math.floor(canvas.height / 4),
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2)
      );
      let sum = 0;
      for (let i = 0; i < imgData.data.length; i += 4) {
        sum += (0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2]);
      }
      const avgBrightness = sum / (imgData.data.length / 4);
      if (avgBrightness < 45) {
        setQualityWarning('Lighting is dark. Make sure the face is illuminated from the front.');
      } else if (avgBrightness > 225) {
        setQualityWarning('Lighting is very bright or overexposed. Adjust angle to reduce glare.');
      } else {
        setQualityWarning(null);
      }
    } catch (e) {
      // Ignore
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File(
          [blob],
          `student_enroll_${activeStudent?.id || 'new'}_${Date.now()}.jpg`,
          { type: 'image/jpeg' }
        );
        setFaceFile(file);
        setCapturedPreview(URL.createObjectURL(blob));
        setIsPhotoCaptured(true);
      }
    }, 'image/jpeg', 0.95);
  };

  const handleRetakePhoto = () => {
    setIsPhotoCaptured(false);
    setCapturedPreview(null);
    setFaceFile(null);
    setMultiFrameResult(null);
    setQualityWarning(null);
    setCountdown(null);
    setCanExtend(true);
    setFaceFeedbackMsg('Position your face inside the guide.');
    if (enrollVideoRef.current && enrollStream) {
      enrollVideoRef.current.play();
    }
  };

  // Continuous lightweight face/lighting check during camera preview
  useEffect(() => {
    if (isRecording || isAnalyzing || isPhotoCaptured || !enrollStream || enrollMode !== 'camera') {
      if (previewCheckTimerRef.current) {
        clearInterval(previewCheckTimerRef.current);
        previewCheckTimerRef.current = null;
      }
      return;
    }

    previewCheckTimerRef.current = setInterval(() => {
      if (!enrollVideoRef.current || !enrollCanvasRef.current) return;
      const video = enrollVideoRef.current;
      if (!video.videoWidth || video.videoWidth === 0) return;

      const canvas = enrollCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, 160, 120);

      try {
        const imgData = ctx.getImageData(40, 30, 80, 60);
        let sum = 0;
        let count = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          sum += (0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2]);
          count++;
        }
        const avgB = sum / count;
        if (avgB < 30) {
          setFaceFeedbackMsg('Lighting is dim. Face a light source.');
          setFaceDetected(false);
        } else if (avgB > 235) {
          setFaceFeedbackMsg('Lighting is very bright. Avoid direct glare.');
          setFaceDetected(false);
        } else {
          setFaceFeedbackMsg('Face detected inside guide. Ready to record.');
          setFaceDetected(true);
        }
      } catch (e) {
        // Fallback
        setFaceFeedbackMsg('Position your face inside the guide.');
      }
    }, 450);

    return () => {
      if (previewCheckTimerRef.current) {
        clearInterval(previewCheckTimerRef.current);
        previewCheckTimerRef.current = null;
      }
    };
  }, [enrollStream, isRecording, isAnalyzing, isPhotoCaptured, enrollMode]);

  const handleStartMultiFrameRecording = (skipCountdown = false) => {
    if (!enrollVideoRef.current || !enrollCanvasRef.current || !activeStudent) return;
    
    // Clear any active timers
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    setEnrollMsg(null);
    setMultiFrameResult(null);
    setIsPhotoCaptured(false);
    setCanExtend(true);

    if (!skipCountdown) {
      setCountdown(3);
      setFaceFeedbackMsg('Hold still for a moment... Recording starting');
      let count = 3;
      countdownTimerRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
        } else {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setCountdown(null);
          startActualRecording();
        }
      }, 700);
    } else {
      setCountdown(null);
      startActualRecording();
    }
  };

  const startActualRecording = () => {
    if (!enrollVideoRef.current || !enrollCanvasRef.current || !activeStudent) return;
    const video = enrollVideoRef.current;
    const canvas = enrollCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRecording(true);
    totalDurationRef.current = 5000;
    elapsedMsRef.current = 0;
    collectedFramesRef.current = [];
    setRecordingSecondsLeft(5);
    setRecordingProgress(0);
    setFaceFeedbackMsg('Capturing biometric data... Hold still');

    const sampleIntervalMs = 200; // ~25 candidate frames over 5 seconds

    recordingTimerRef.current = setInterval(() => {
      elapsedMsRef.current += sampleIntervalMs;
      const totalMs = totalDurationRef.current;
      const secondsLeft = Math.max(0, Math.ceil((totalMs - elapsedMsRef.current) / 1000));
      setRecordingSecondsLeft(secondsLeft);
      setRecordingProgress(Math.min(100, Math.round((elapsedMsRef.current / totalMs) * 100)));

      if (secondsLeft > 3) {
        setFaceFeedbackMsg('Capturing frontal biometric reference...');
      } else if (secondsLeft > 1) {
        setFaceFeedbackMsg('Hold steady... validating facial landmarks');
      } else {
        setFaceFeedbackMsg('Finalizing candidate frames...');
      }

      // Snapshot candidate frame
      try {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            const frameFile = new File(
              [blob],
              `frame_${activeStudent.id}_${Date.now()}_${collectedFramesRef.current.length + 1}.jpg`,
              { type: 'image/jpeg' }
            );
            collectedFramesRef.current.push(frameFile);
          }
        }, 'image/jpeg', 0.92);
      } catch (e) {
        console.warn('Frame capture error:', e);
      }

      // Check if finished
      if (elapsedMsRef.current >= totalDurationRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        setIsRecording(false);
        setIsAnalyzing(true);
        setFaceFeedbackMsg('Building your biometric profile...');

        // Wait a brief moment for final canvas toBlob callback
        setTimeout(async () => {
          try {
            const framesToSend = [...collectedFramesRef.current];
            if (framesToSend.length < 3) {
              throw new Error('Not enough candidate frames captured. Please ensure webcam is transmitting video.');
            }
            const res = await studentsApi.enrollMultiFrame(activeStudent.id, framesToSend);
            setMultiFrameResult(res);
            setIsPhotoCaptured(true);
            setCapturedPreview(res.photo_url || null);
            setFaceFeedbackMsg('Enrollment successful.');
            setEnrollMsg({
              type: 'success',
              text: `Biometric Profile Created! ${res.accepted_frames} best frames selected from ${res.total_frames_extracted} candidates. Quality: ${(res.quality_score * 100).toFixed(1)}%`,
            });
            loadData();
          } catch (err: any) {
            const errorMsg = err.response?.data?.detail || err.message || 'Enrollment failed. Please ensure frontal lighting and retry.';
            setFaceFeedbackMsg('Enrollment failed. Please adjust position.');
            setEnrollMsg({
              type: 'error',
              text: errorMsg,
            });
          } finally {
            setIsAnalyzing(false);
          }
        }, 350);
      }
    }, sampleIntervalMs);
  };

  const handleExtendRecording = () => {
    totalDurationRef.current += 3000; // Add 3 seconds
    setCanExtend(false); // Only allow 1 extension per session to keep it fast
    setFaceFeedbackMsg('Extended recording by +3 seconds. Hold steady.');
  };

  const handleCancelRecording = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setIsAnalyzing(false);
    setCountdown(null);
    setRecordingProgress(0);
    setRecordingSecondsLeft(5);
    setFaceFeedbackMsg('Position your face inside the guide.');
  };

  // Admin Management Handlers
  const handleOpenEdit = (st: Student) => {
    setEditingStudent({
      id: st.id,
      usn: st.usn,
      full_name: st.full_name,
      email: st.email || '',
      phone: st.phone || '',
      department_id: st.department_id || 1,
      semester: st.semester,
      section: st.section,
      is_active: st.is_active,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditLoading(true);
    try {
      await studentsApi.update(editingStudent.id, editingStudent);
      setIsEditOpen(false);
      setEditingStudent(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update student profile');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenDeactivate = (st: Student) => {
    setStudentToDeactivate(st);
    setIsDeactivateOpen(true);
  };

  const handleConfirmDeactivate = async (permanent = false) => {
    if (!studentToDeactivate) return;
    setDeactivateLoading(true);
    try {
      await studentsApi.delete(studentToDeactivate.id, permanent);
      setIsDeactivateOpen(false);
      setStudentToDeactivate(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update student status');
    } finally {
      setDeactivateLoading(false);
    }
  };

  const handleSwitchEnrollMode = (mode: 'camera' | 'upload') => {
    setEnrollMode(mode);
    setEnrollMsg(null);
    setQualityWarning(null);
    if (mode === 'camera') {
      setIsPhotoCaptured(false);
      setCapturedPreview(null);
      setFaceFile(null);
      setTimeout(() => {
        startEnrollCamera(selectedEnrollCamId);
      }, 50);
    } else {
      stopEnrollCamera();
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedSem]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studData, deptData] = await Promise.all([
        studentsApi.getAll({
          department_id: selectedDept,
          semester: selectedSem,
          search: search || undefined,
        }),
        academicApi.getDepartments(),
      ]);
      setStudents(studData);
      setDepartments(deptData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await studentsApi.create(newStudent);
      setIsRegisterOpen(false);
      setNewStudent({
        usn: '',
        full_name: '',
        email: '',
        phone: '',
        department_id: 1,
        semester: 6,
        section: 'A',
        consent_status: true,
      });
      loadData();
      // Prompt face biometric enrollment immediately upon student creation
      if (created) {
        handleOpenEnrollFace(created);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create student');
    }
  };

  const handleOpenEnrollFace = (st: Student) => {
    setActiveStudent(st);
    setFaceFile(null);
    setFacePreview(null);
    setCapturedPreview(null);
    setIsPhotoCaptured(false);
    setMultiFrameResult(null);
    setEnrollMsg(null);
    setQualityWarning(null);
    setCountdown(null);
    setFaceFeedbackMsg('Position your face inside the guide.');
    setFaceDetected(false);
    setCanExtend(true);
    setEnrollMode('camera');
    setIsEnrollFaceOpen(true);
    listEnrollCameras();
    setTimeout(() => {
      startEnrollCamera();
    }, 100);
  };

  const handleCloseEnrollModal = () => {
    handleCancelRecording();
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (previewCheckTimerRef.current) {
      clearInterval(previewCheckTimerRef.current);
      previewCheckTimerRef.current = null;
    }
    stopEnrollCamera();
    setIsEnrollFaceOpen(false);
    setFaceFile(null);
    setFacePreview(null);
    setCapturedPreview(null);
    setIsPhotoCaptured(false);
    setMultiFrameResult(null);
    setEnrollMsg(null);
    setQualityWarning(null);
    setCountdown(null);
  };

  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFaceFile(f);
      setFacePreview(URL.createObjectURL(f));
    }
  };

  const handleUploadFace = async () => {
    if (!activeStudent || !faceFile) return;
    setEnrollLoading(true);
    setEnrollMsg(null);
    try {
      const res = await studentsApi.enrollFace(activeStudent.id, faceFile);
      setEnrollMsg({
        type: 'success',
        text: `Face Biometrics Enrolled! Quality Score: ${(res.quality_score * 100).toFixed(1)}%`,
      });
      stopEnrollCamera();
      loadData();
      setTimeout(() => {
        setIsEnrollFaceOpen(false);
      }, 1500);
    } catch (err: any) {
      setEnrollMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Face enrollment failed. Ensure a clear frontal photo.',
      });
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleViewProfile = async (st: Student) => {
    setActiveStudent(st);
    try {
      const det = await studentsApi.getDetails(st.id);
      setStudentDetails(det);
      setIsProfileOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Student Roster & Face Biometrics" breadcrumbs={['Roster', 'Students']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              BIOMETRIC ENROLLMENT DATABASE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Student Directory
            </h1>
          </div>

          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Student</span>
          </button>
        </div>

        {/* Filters & Search Bar */}
        <div className="p-4 bg-synapse-surface border border-synapse-border flex flex-wrap items-center gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
            <input
              type="text"
              placeholder="Search by student name or USN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-synapse-elevated border border-synapse-border pl-10 pr-4 py-2 text-xs text-white placeholder-synapse-muted font-mono focus:border-synapse-pink focus:outline-none"
            />
            <Search className="w-4 h-4 text-synapse-muted absolute left-3.5 top-2.5" />
          </form>

          <div className="flex items-center gap-3">
            <select
              value={selectedDept || ''}
              onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedSem || ''}
              onChange={(e) => setSelectedSem(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Table */}
        <div className="bg-synapse-surface border border-synapse-border relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-synapse-border text-synapse-secondary font-mono uppercase text-[11px] bg-synapse-deep">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">USN / ID</th>
                  <th className="py-3 px-4">Dept / Sem</th>
                  <th className="py-3 px-4 text-center">Biometrics</th>
                  <th className="py-3 px-4 text-center">Attendance Rate</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-synapse-border/40 font-mono">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-synapse-muted">
                      No student records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr
                      key={st.id}
                      className="hover:bg-synapse-elevated/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={st.photo_url || '/placeholder_student.jpg'}
                            alt={st.full_name}
                            onError={(e: any) => {
                              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%231C1C1C"/><circle cx="20" cy="16" r="8" fill="%2371717A"/><path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="%2371717A"/></svg>';
                            }}
                            className="w-9 h-9 object-cover border border-synapse-border rounded-none"
                          />
                          <div>
                            <p className="font-sans font-bold text-white text-xs">{st.full_name}</p>
                            <p className="text-[10px] text-synapse-muted">{st.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-synapse-pink">{st.usn}</td>
                      <td className="py-3 px-4 text-zinc-300">
                        {st.department_code || 'AIML'} • Sem {st.semester} ({st.section})
                      </td>

                      <td className="py-3 px-4 text-center">
                        {st.has_biometric ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 128-D ENROLLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-synapse-yellow font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> PENDING
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-bold ${
                            (st.attendance_percentage ?? 100) < 75
                              ? 'text-rose-400'
                              : 'text-white'
                          }`}
                        >
                          {st.attendance_percentage ?? 100}%
                        </span>
                        <span className="text-synapse-muted text-[10px] ml-1">
                          ({st.attended_lectures ?? 0}/{st.total_lectures ?? 0})
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEnrollFace(st)}
                            title="Enroll / Update Face Biometrics"
                            className="px-2.5 py-1 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-[11px] text-synapse-yellow hover:border-synapse-yellow transition-colors flex items-center gap-1"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Biometrics</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(st)}
                            title="Edit Student Information"
                            className="px-2 py-1 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-[11px] text-synapse-secondary hover:text-white transition-colors flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3 text-synapse-pink" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleViewProfile(st)}
                            title="View Student Intelligence Dossier"
                            className="px-2.5 py-1 bg-synapse-pink/10 hover:bg-synapse-pink hover:text-white border border-synapse-pink/30 text-synapse-pink text-[11px] transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Profile</span>
                          </button>

                          <button
                            onClick={() => handleOpenDeactivate(st)}
                            title="Deactivate / Delete Student"
                            className="p-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink" />
        </div>
      </main>

      {/* Modal: Register Student */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register Enrolled Student"
        subtitle="Add student details into institutional academic database"
      >
        <form onSubmit={handleRegisterStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                University Seat Number (USN) *
              </label>
              <input
                type="text"
                required
                value={newStudent.usn}
                onChange={(e) => setNewStudent({ ...newStudent, usn: e.target.value })}
                placeholder="1RV21AI021"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newStudent.full_name}
                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                placeholder="Student Full Name"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                placeholder="student@synapse.edu"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={newStudent.phone}
                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                placeholder="+91 99800 12345"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Department
              </label>
              <select
                value={newStudent.department_id}
                onChange={(e) => setNewStudent({ ...newStudent, department_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Semester
              </label>
              <select
                value={newStudent.semester}
                onChange={(e) => setNewStudent({ ...newStudent, semester: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Sem {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Section
              </label>
              <input
                type="text"
                value={newStudent.section}
                onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-synapse-elevated border border-synapse-border/80 text-[11px] font-mono text-synapse-secondary flex items-center gap-2">
            <Shield className="w-4 h-4 text-synapse-pink shrink-0" />
            <span>Biometric consent acknowledged for AI attendance matching.</span>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 border border-synapse-border text-xs font-mono uppercase text-synapse-secondary hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-synapse-softpink"
            >
              Register Student
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Enroll Face Biometrics */}
      <Modal
        isOpen={isEnrollFaceOpen}
        onClose={handleCloseEnrollModal}
        title="Biometric Face Enrollment"
        subtitle={`Generate 128-d face embedding for ${activeStudent?.full_name} (${activeStudent?.usn})`}
        maxWidth="lg"
      >
        <div className="space-y-5">
          {/* Dual-Mode Selector Tabs */}
          <div className="flex border-b border-synapse-border">
            <button
              type="button"
              onClick={() => handleSwitchEnrollMode('camera')}
              className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-[1px] ${
                enrollMode === 'camera'
                  ? 'border-synapse-pink text-synapse-pink bg-synapse-pink/10'
                  : 'border-transparent text-synapse-secondary hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              Capture Using Camera
            </button>
            <button
              type="button"
              onClick={() => handleSwitchEnrollMode('upload')}
              className={`flex items-center gap-2 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-[1px] ${
                enrollMode === 'upload'
                  ? 'border-synapse-pink text-synapse-pink bg-synapse-pink/10'
                  : 'border-transparent text-synapse-secondary hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload Photo File
            </button>
          </div>

          {/* Camera Mode */}
          {enrollMode === 'camera' && (
            <div className="space-y-4">
              {/* Camera selection & status bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-synapse-elevated border border-synapse-border text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white font-bold">WEBCAM INTERFACE:</span>
                  {availableCams.length > 1 ? (
                    <select
                      value={selectedEnrollCamId}
                      onChange={(e) => {
                        setSelectedEnrollCamId(e.target.value);
                        startEnrollCamera(e.target.value);
                      }}
                      className="bg-black/80 border border-synapse-border px-2 py-1 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
                    >
                      {availableCams.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-synapse-secondary">Default Laptop / USB Camera</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEnrollCamera(selectedEnrollCamId)}
                  className="px-2 py-1 border border-synapse-border text-synapse-secondary hover:text-white flex items-center gap-1 text-[11px]"
                  title="Reconnect Camera Stream"
                >
                  <RefreshCw className="w-3 h-3" />
                  Restart Stream
                </button>
              </div>

              {/* Re-enrollment Notice if student already has biometric profile */}
              {activeStudent?.has_biometric && (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/40 text-blue-300 text-xs font-mono flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Existing Biometric Profile Enrolled. Recording will update reference embeddings.</span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold border border-blue-500/40 px-1.5 py-0.5">
                    UPDATE MODE
                  </span>
                </div>
              )}

              {cameraError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Viewport: Live Stream vs Captured Snapshot */}
              <div className="relative w-full aspect-video max-h-[380px] bg-black border border-synapse-border overflow-hidden flex items-center justify-center">
                {!isPhotoCaptured ? (
                  <>
                    <video
                      ref={enrollVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Live Guidance Status Badge */}
                    <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none z-10">
                      <div className={`px-3 py-1 bg-black/80 backdrop-blur-sm border text-xs font-mono font-bold flex items-center gap-2 tracking-wide transition-all ${
                        isRecording
                          ? 'border-synapse-yellow text-synapse-yellow shadow-[0_0_15px_rgba(239,255,0,0.3)]'
                          : faceDetected
                          ? 'border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.25)]'
                          : 'border-synapse-pink/60 text-white'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          isRecording ? 'bg-synapse-yellow animate-ping' : faceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-synapse-pink'
                        }`} />
                        <span>{faceFeedbackMsg}</span>
                      </div>
                    </div>

                    {/* Centering Face Outline Guide */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className={`w-44 h-56 border-2 border-dashed rounded-full relative flex items-center justify-center transition-all ${
                        isRecording
                          ? 'border-synapse-yellow shadow-[0_0_30px_rgba(239,255,0,0.45)]'
                          : faceDetected
                          ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.35)]'
                          : 'border-synapse-pink/80 shadow-[0_0_20px_rgba(255,22,139,0.25)]'
                      }`}>
                        {/* Crosshairs & Guide Reticles */}
                        <div className="absolute w-6 h-[1px] bg-synapse-pink/70 top-1/2 left-0 -translate-x-full" />
                        <div className="absolute w-6 h-[1px] bg-synapse-pink/70 top-1/2 right-0 translate-x-full" />
                        <div className="absolute h-6 w-[1px] bg-synapse-pink/70 top-0 left-1/2 -translate-y-full" />
                        <div className="absolute h-6 w-[1px] bg-synapse-pink/70 bottom-0 left-1/2 translate-y-full" />

                        {/* Countdown Indicator in Center */}
                        {countdown !== null ? (
                          <div className="flex flex-col items-center justify-center animate-pulse">
                            <span className="text-6xl font-mono font-black text-synapse-yellow drop-shadow-[0_0_25px_rgba(239,255,0,0.8)]">
                              {countdown}
                            </span>
                            <span className="text-[10px] font-mono text-white tracking-widest uppercase font-bold mt-1">
                              GET READY...
                            </span>
                          </div>
                        ) : (
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded tracking-wider uppercase font-bold ${
                            isRecording
                              ? 'bg-black/80 text-synapse-yellow border border-synapse-yellow/50'
                              : faceDetected
                              ? 'bg-black/80 text-emerald-400 border border-emerald-400/50'
                              : 'bg-black/60 text-synapse-pink/90'
                          }`}>
                            {isRecording ? 'RECORDING BIOMETRICS' : faceDetected ? 'FACE POSITION OK' : 'ALIGN FACE HERE'}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 bg-black/75 px-3 py-1 border border-synapse-pink/40 text-[10px] font-mono text-white tracking-widest uppercase">
                        Center face • Look directly at camera • Keep natural expression
                      </div>
                    </div>

                    {/* Live Recording HUD overlay */}
                    {isRecording && (
                      <div className="absolute inset-0 bg-black/30 flex flex-col justify-between p-4 pointer-events-none">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 bg-red-600/95 text-white px-3 py-1 font-mono text-xs font-bold tracking-wider uppercase animate-pulse">
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                            <span>RECORDING 5-SEC VIDEO: {recordingSecondsLeft}s REMAINING</span>
                          </div>
                          <span className="bg-black/80 text-synapse-yellow border border-synapse-yellow/50 px-2 py-0.5 font-mono text-xs font-bold">
                            SAMPLING ~25 CANDIDATE FRAMES
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-black/80 h-2 border border-synapse-border">
                          <div
                            className="h-full bg-gradient-to-r from-synapse-pink to-synapse-yellow transition-all duration-300"
                            style={{ width: `${recordingProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Analyzing Loader Overlay */}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 p-6 text-center z-20">
                        <RefreshCw className="w-10 h-10 text-synapse-yellow animate-spin" />
                        <p className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                          SYNAPSE AI BIOMETRIC CONSOLIDATION
                        </p>
                        <p className="text-xs font-mono text-synapse-secondary max-w-sm">
                          Tracking primary face, filtering motion blur, verifying identity consistency & generating 128-D consensus embedding...
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    {capturedPreview && (
                      <img
                        src={capturedPreview}
                        alt="Captured biometric frame"
                        className="w-full h-full object-contain"
                      />
                    )}
                    <div className="absolute top-3 left-3 bg-black/85 border border-synapse-pink px-2.5 py-1 text-[11px] font-mono font-bold text-synapse-pink flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      {multiFrameResult ? 'CONSOLIDATED PROFILE ENROLLED' : 'SNAPSHOT CAPTURED'}
                    </div>

                    {multiFrameResult && (
                      <div className="absolute bottom-3 inset-x-3 bg-black/90 border border-synapse-border p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                            {multiFrameResult.accepted_frames}/{multiFrameResult.total_frames_extracted} FRAMES ACCEPTED
                          </span>
                          {multiFrameResult.rejected_frames > 0 && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {multiFrameResult.rejected_frames} OUTLIERS FILTERED
                            </span>
                          )}
                        </div>
                        <span className="text-synapse-yellow font-bold">
                          QUALITY: {(multiFrameResult.quality_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quality Advisory if lighting issues */}
              {qualityWarning && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{qualityWarning}</span>
                </div>
              )}

              {/* Hidden Canvas used for raster capture */}
              <canvas ref={enrollCanvasRef} className="hidden" />

              {/* Camera Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="text-[11px] font-mono text-synapse-secondary">
                  {!isPhotoCaptured
                    ? 'Adaptive Video Pipeline: 5s continuous recording with automated frame selection & outlier filtering.'
                    : 'Consolidated biometric profile saved. Student is ready for live webcam attendance.'}
                </div>

                <div className="flex items-center gap-3">
                  {!isPhotoCaptured ? (
                    <>
                      {isRecording ? (
                        <>
                          {canExtend && (
                            <button
                              type="button"
                              onClick={handleExtendRecording}
                              className="px-3.5 py-2 border border-synapse-yellow/60 text-synapse-yellow hover:bg-synapse-yellow/10 font-mono text-xs uppercase flex items-center gap-1.5"
                              title="Add 3 extra seconds to recording"
                            >
                              <span>+3s Extend</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleCancelRecording}
                            className="px-4 py-2 border border-rose-500/50 text-rose-300 font-mono text-xs uppercase hover:bg-rose-500/20 flex items-center gap-1.5"
                          >
                            <Square className="w-3.5 h-3.5" />
                            Cancel Recording
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleCaptureWebcamPhoto}
                            disabled={!!cameraError || isAnalyzing || countdown !== null}
                            className="px-3.5 py-2 bg-synapse-surface border border-synapse-border hover:border-synapse-pink text-zinc-300 hover:text-white font-mono text-xs uppercase flex items-center gap-1.5 disabled:opacity-50"
                            title="Single frame snapshot"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Single Photo
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartMultiFrameRecording(false)}
                            disabled={!!cameraError || isAnalyzing || countdown !== null}
                            className="px-6 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink flex items-center gap-2 disabled:opacity-50 transition-all"
                          >
                            <Video className="w-4 h-4" />
                            <span>Start Face Enrollment</span>
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleRetakePhoto}
                        disabled={enrollLoading}
                        className="px-4 py-2 border border-synapse-border text-xs font-mono uppercase text-synapse-secondary hover:text-white flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Recapture Video
                      </button>

                      {!multiFrameResult && (
                        <button
                          type="button"
                          onClick={handleUploadFace}
                          disabled={enrollLoading || !faceFile}
                          className="px-6 py-2.5 bg-synapse-yellow text-black font-mono text-xs uppercase font-bold tracking-wider hover:bg-yellow-300 flex items-center gap-2 disabled:opacity-50"
                        >
                          {enrollLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {enrollLoading ? 'Extracting 128-D Embedding...' : 'Confirm & Enroll Biometrics'}
                        </button>
                      )}

                      {multiFrameResult && (
                        <button
                          type="button"
                          onClick={handleCloseEnrollModal}
                          className="px-6 py-2.5 bg-emerald-500 text-black font-mono text-xs uppercase font-bold hover:bg-emerald-400 flex items-center gap-1.5 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
                        >
                          <Check className="w-4 h-4" />
                          Done & Enrolled
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Upload File Mode */}
          {enrollMode === 'upload' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-synapse-border bg-synapse-elevated">
                {facePreview ? (
                  <div className="relative">
                    <img
                      src={facePreview}
                      alt="Face preview"
                      className="w-48 h-48 object-cover border-2 border-synapse-pink"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-synapse-pink font-bold">
                      READY FOR CV ANALYSIS
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-10 h-10 text-synapse-pink mx-auto mb-2 animate-bounce" />
                    <p className="text-xs font-mono text-white uppercase font-bold">
                      Upload Student Portrait Photograph
                    </p>
                    <p className="text-[11px] text-synapse-secondary mt-1">
                      Supported formats: JPG, PNG. High frontal lighting recommended.
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={handleFaceFileChange}
                  className="mt-4 text-xs font-mono text-synapse-secondary file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-mono file:bg-synapse-pink file:text-white hover:file:bg-synapse-softpink cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleUploadFace}
                  disabled={!faceFile || enrollLoading}
                  className="px-6 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-synapse-softpink disabled:opacity-50 flex items-center gap-2"
                >
                  {enrollLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {enrollLoading ? 'Processing Biometrics...' : 'Extract & Store Embedding'}
                </button>
              </div>
            </div>
          )}

          {/* Enrollment Feedback Message */}
          {enrollMsg && (
            <div
              className={`p-3 text-xs font-mono border flex items-center gap-2 ${
                enrollMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              }`}
            >
              {enrollMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{enrollMsg.text}</span>
            </div>
          )}

          {/* Footer close button */}
          <div className="flex justify-end gap-3 border-t border-synapse-border pt-4">
            <button
              type="button"
              onClick={handleCloseEnrollModal}
              className="px-4 py-2 border border-synapse-border text-xs font-mono uppercase text-synapse-secondary hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Student Detailed Profile */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="Student Intelligence Dossier"
        subtitle={activeStudent?.usn || ''}
        maxWidth="xl"
      >
        {studentDetails && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-start gap-6 p-4 bg-synapse-elevated border border-synapse-border">
              <img
                src={studentDetails.student.photo_url || '/placeholder_student.jpg'}
                alt={studentDetails.student.full_name}
                onError={(e: any) => {
                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 40 40"><rect width="40" height="40" fill="%231C1C1C"/><circle cx="20" cy="16" r="8" fill="%2371717A"/></svg>';
                }}
                className="w-24 h-24 object-cover border-2 border-synapse-pink"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold font-display text-white">
                    {studentDetails.student.full_name}
                  </h3>
                  <Badge
                    label={studentDetails.stats.is_shortage ? 'SHORTAGE ALERT' : 'ATTENDANCE SAFE'}
                    variant={studentDetails.stats.is_shortage ? 'red' : 'green'}
                    size="sm"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-synapse-secondary">
                  <div>Department: <strong className="text-white">{studentDetails.student.department_code}</strong></div>
                  <div>Semester: <strong className="text-white">{studentDetails.student.semester} ({studentDetails.student.section})</strong></div>
                  <div>Biometrics: <strong className="text-emerald-400">128-D Active</strong></div>
                  <div>Email: <strong className="text-white">{studentDetails.student.email}</strong></div>
                  <div>Phone: <strong className="text-white">{studentDetails.student.phone}</strong></div>
                </div>
              </div>
            </div>

            {/* Subject Attendance Breakdown */}
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-synapse-pink font-semibold mb-3">
                Subject-Wise Attendance Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentDetails.subject_breakdown.map((sb: any) => (
                  <div key={sb.subject_id} className="p-3 bg-synapse-elevated border border-synapse-border">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-white">{sb.subject_code}</span>
                      <span className={sb.is_shortage ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {sb.attendance_percentage}%
                      </span>
                    </div>
                    <p className="text-[11px] text-synapse-secondary mt-0.5 truncate">{sb.subject_name}</p>
                    <div className="w-full bg-zinc-800 h-1.5 mt-2">
                      <div
                        className={`h-full ${sb.is_shortage ? 'bg-rose-500' : 'bg-emerald-400'}`}
                        style={{ width: `${sb.attendance_percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Modal: Edit Student Information */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingStudent(null);
        }}
        title="Edit Student Information"
        subtitle={`Update academic & contact details for ${editingStudent?.usn}`}
        maxWidth="lg"
      >
        {editingStudent && (
          <form onSubmit={handleSaveEdit} className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-synapse-secondary uppercase mb-1">
                  University Seat Number (USN) *
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.usn}
                  onChange={(e) => setEditingStudent({ ...editingStudent, usn: e.target.value })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-synapse-secondary uppercase mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.full_name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-synapse-secondary uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-synapse-secondary uppercase mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingStudent.phone}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-synapse-secondary uppercase mb-1">Department</label>
                <select
                  value={editingStudent.department_id}
                  onChange={(e) => setEditingStudent({ ...editingStudent, department_id: Number(e.target.value) })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-synapse-secondary uppercase mb-1">Semester</label>
                <select
                  value={editingStudent.semester}
                  onChange={(e) => setEditingStudent({ ...editingStudent, semester: Number(e.target.value) })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-synapse-secondary uppercase mb-1">Section</label>
                <input
                  type="text"
                  value={editingStudent.section}
                  onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                  className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono focus:border-synapse-pink focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-synapse-elevated border border-synapse-border">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={editingStudent.is_active}
                onChange={(e) => setEditingStudent({ ...editingStudent, is_active: e.target.checked })}
                className="w-4 h-4 accent-synapse-pink cursor-pointer"
              />
              <label htmlFor="edit_is_active" className="text-white cursor-pointer">
                Student Account Active (Eligible for attendance recognition)
              </label>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-synapse-border">
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingStudent(null);
                }}
                className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold tracking-wider hover:bg-synapse-softpink flex items-center gap-1.5"
              >
                {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Safe Deactivate / Delete Student */}
      <Modal
        isOpen={isDeactivateOpen}
        onClose={() => {
          setIsDeactivateOpen(false);
          setStudentToDeactivate(null);
        }}
        title="Student Status & Safe Deactivation"
        subtitle={`Admin action for ${studentToDeactivate?.full_name} (${studentToDeactivate?.usn})`}
        maxWidth="md"
      >
        {studentToDeactivate && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-white">Historical Attendance Protection</p>
                <p className="mt-1 text-[11px] text-zinc-300">
                  Deactivating this student preserves all existing lecture attendance logs, biometrics, and audit entries. The student will be excluded from future attendance rosters without deleting historical institutional records.
                </p>
              </div>
            </div>

            <div className="p-3 bg-synapse-elevated border border-synapse-border space-y-1">
              <div className="flex justify-between">
                <span className="text-synapse-secondary">Student Name:</span>
                <span className="text-white font-bold">{studentToDeactivate.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-synapse-secondary">USN:</span>
                <span className="text-synapse-pink font-bold">{studentToDeactivate.usn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-synapse-secondary">Current Status:</span>
                <span className={studentToDeactivate.is_active ? 'text-emerald-400' : 'text-rose-400'}>
                  {studentToDeactivate.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-synapse-border">
              <button
                type="button"
                onClick={() => {
                  setIsDeactivateOpen(false);
                  setStudentToDeactivate(null);
                }}
                className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white uppercase"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deactivateLoading}
                onClick={() => handleConfirmDeactivate(false)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                {deactivateLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Deactivate Student</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

