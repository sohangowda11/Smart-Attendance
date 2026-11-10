import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Camera, Video, Play, Square, CheckCircle2,
  AlertTriangle, Users, UserCheck, UserX, Clock,
  ShieldCheck, RefreshCw, Sparkles, Check, X,
  Download, Eye, AlertCircle, FileText, ChevronRight,
  FlipHorizontal
} from 'lucide-react';
import { academicApi, timetableApi, webcamApi } from '../services/api';
import { Subject, Classroom } from '../services/types';
import { useAuth } from '../context/AuthContext';

interface DetectedFace {
  bbox: [number, number, number, number]; // [x, y, w, h]
  status: 'RECOGNIZED' | 'UNKNOWN' | 'VERIFY' | 'OTHER_CLASS' | 'AMBIGUOUS';
  label: string;
  sub_label?: string;
  confidence: number;
  student_id?: number;
  track_id?: string;
}

interface RenderTrack {
  id: string;
  student_id?: number;
  label: string;
  sub_label?: string;
  confidence: number;
  status: 'RECOGNIZED' | 'UNKNOWN' | 'VERIFY' | 'OTHER_CLASS' | 'AMBIGUOUS';
  currX: number;
  currY: number;
  currW: number;
  currH: number;
  targetX: number;
  targetY: number;
  targetW: number;
  targetH: number;
  opacity: number;
  targetOpacity: number;
  lastSeen: number;
}

interface RosterStudent {
  id: number;
  full_name: string;
  usn: string;
  photo_url?: string;
  semester?: number;
  section?: string;
  status: 'PRESENT' | 'PENDING' | 'LATE' | 'ABSENT';
  confidence: number;
  marked_at?: string;
}

interface RecognitionLog {
  id: string;
  student_name: string;
  usn: string;
  confidence: number;
  timestamp: string;
  status: string;
}

export const LiveWebcamAttendance: React.FC = () => {
  const { user } = useAuth();

  // Academic Configuration State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null);

  // Active Live Session State
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [activeFaces, setActiveFaces] = useState<DetectedFace[]>([]);
  const [recognitionLogs, setRecognitionLogs] = useState<RecognitionLog[]>([]);

  // 5-Metric Classroom Intelligence State
  const [metrics, setMetrics] = useState({
    total_roster: 0,
    total_visible_people: 0,
    recognized_students: 0,
    attendance_marked: 0,
    unknown_individuals: 0,
    remaining_students: 0,
  });

  // Camera & Device State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Processing Loop State
  const [isProcessingLoop, setIsProcessingLoop] = useState(false);
  const processingRef = useRef(false);
  const sendLoopRef = useRef<any>(null);

  // Performance Telemetry & Mirroring State
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const isMirroredRef = useRef<boolean>(true);
  const [displayFps, setDisplayFps] = useState<number>(30);
  const [backendLatency, setBackendLatency] = useState<number>(0);
  const fpsCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());

  // 60 FPS Animation & Smooth Tracking Refs
  const animFrameRef = useRef<number | null>(null);
  const activeTracksRef = useRef<Map<string, RenderTrack>>(new Map());
  const captureLoopActiveRef = useRef<boolean>(false);
  const isRequestInFlightRef = useRef<boolean>(false);
  const captureTimeoutRef = useRef<any>(null);

  // Review & Finalization Modal State
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalSummary, setFinalSummary] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);

  // Manual mark confirmation modal
  const [manualMarkStudent, setManualMarkStudent] = useState<RosterStudent | null>(null);

  // Load initial subjects & classrooms
  useEffect(() => {
    isMirroredRef.current = isMirrored;
  }, [isMirrored]);

  useEffect(() => {
    loadPrerequisites();
    listCameras();
    return () => {
      stopCameraStream();
      captureLoopActiveRef.current = false;
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (sendLoopRef.current) clearInterval(sendLoopRef.current);
      activeTracksRef.current.clear();
    };
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [subjData, roomData] = await Promise.all([
        academicApi.getSubjects(),
        academicApi.getClassrooms(),
      ]);
      setSubjects(subjData);
      setClassrooms(roomData);

      if (subjData.length > 0) setSelectedSubjectId(subjData[0].id);
      if (roomData.length > 0) setSelectedClassroomId(roomData[0].id);

      // Auto-detect active lecture from timetable if ongoing
      try {
        const activeLect = await timetableApi.getActiveLecture();
        if (activeLect?.has_active && activeLect.active_lecture) {
          setSelectedSubjectId(activeLect.active_lecture.subject_id);
          setSelectedClassroomId(activeLect.active_lecture.classroom_id);
        }
      } catch (err) {
        // Fallback to manual selection
      }
    } catch (e) {
      console.error('Error loading academic data:', e);
    }
  };

  const listCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.error('Error enumerating devices:', e);
    }
  };

  // Start Laptop Camera Stream
  const startCameraStream = async (deviceId?: string) => {
    setCameraError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      return stream;
    } catch (err: any) {
      const msg =
        err.name === 'NotAllowedError'
          ? 'Webcam permission was denied by the browser. Please allow camera access in browser permissions.'
          : err.name === 'NotFoundError'
          ? 'No laptop webcam or video input device was detected on your machine.'
          : `Failed to access laptop webcam: ${err.message || err.name}`;
      setCameraError(msg);
      throw err;
    }
  };

  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    // Clear overlay canvas
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  // Toggle Mirroring with Instant Coordinate Reconciliation
  const toggleMirroring = () => {
    setIsMirrored((prev) => {
      const next = !prev;
      isMirroredRef.current = next;
      // Invert current track positions immediately on canvas so there is zero transition jump
      const canvas = overlayCanvasRef.current;
      if (canvas && canvas.width > 0) {
        const cw = canvas.width;
        activeTracksRef.current.forEach((track) => {
          const newCurrX = cw - track.currX - track.currW;
          const newTargetX = cw - track.targetX - track.targetW;
          track.currX = newCurrX;
          track.targetX = newTargetX;
        });
      }
      return next;
    });
  };

  // Start Session Workflow
  const handleStartAttendance = async () => {
    if (!selectedSubjectId || !selectedClassroomId) {
      alert('Please select both a Subject and Classroom to start the attendance session.');
      return;
    }

    try {
      // 1. Initialize camera stream first
      await startCameraStream(selectedDeviceId);

      // 2. Initialize backend live attendance session
      const res = await webcamApi.startSession({
        subject_id: selectedSubjectId,
        classroom_id: selectedClassroomId,
      });

      setSessionId(res.session_id);
      setRoster(res.roster || []);
      setMetrics(res.metrics);
      setIsSessionActive(true);
      setRecognitionLogs([]);
      setCompletedSuccess(false);

      // 3. Start high-performance non-overlapping capture & 60 FPS tracking loops
      processingRef.current = true;
      setIsProcessingLoop(true);
      startFrameCaptureLoop(res.session_id);
    } catch (err: any) {
      console.error(err);
      if (!cameraError) {
        alert(err.response?.data?.detail || err.message || 'Failed to start live attendance session');
      }
    }
  };

  // 60 FPS Animation & Smooth Bounding-Box Interpolation Loop
  const startOverlayAnimationLoop = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const animate = () => {
      const canvas = overlayCanvasRef.current;
      const video = videoRef.current;

      // Telemetry: measure real displayed FPS
      fpsCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setDisplayFps(Math.round((fpsCountRef.current * 1000) / (now - lastFpsTimeRef.current)));
        fpsCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      if (canvas && video && video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const vW = video.videoWidth || 640;
          const vH = video.videoHeight || 480;

          if (canvas.width !== vW || canvas.height !== vH) {
            canvas.width = vW;
            canvas.height = vH;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Exponential moving average smoothing constant (36% per 16.6ms frame = snappy, fluid glide)
          const alpha = 0.36;
          const tracks = activeTracksRef.current;
          const deadTrackIds: string[] = [];

          tracks.forEach((track, id) => {
            // Smoothly interpolate position towards target box
            track.currX += (track.targetX - track.currX) * alpha;
            track.currY += (track.targetY - track.currY) * alpha;
            track.currW += (track.targetW - track.currW) * alpha;
            track.currH += (track.targetH - track.currH) * alpha;

            // Stale detection decay: fade out smoothly if not detected recently
            if (now - track.lastSeen > 480) {
              track.targetOpacity = 0.0;
            }
            track.opacity += (track.targetOpacity - track.opacity) * 0.22;

            if (track.opacity < 0.03 && track.targetOpacity === 0.0) {
              deadTrackIds.push(id);
              return;
            }

            // Render crisp, high-tech HUD box
            renderHUDBox(ctx, track);
          });

          // Cleanup decayed tracks
          deadTrackIds.forEach((id) => tracks.delete(id));
        }
      }

      if (captureLoopActiveRef.current) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  // Render Cyberpunk HUD Box on Canvas (Reads left-to-right on mirrored face)
  const renderHUDBox = (ctx: CanvasRenderingContext2D, track: RenderTrack) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, track.opacity));

    const x = track.currX;
    const y = track.currY;
    const w = track.currW;
    const h = track.currH;

    // Color scheme
    let strokeColor = '#FF168B'; // Default Hot Pink (Unknown)
    if (track.status === 'RECOGNIZED') {
      strokeColor = '#EFFF00'; // Electric Yellow
    } else if (track.status === 'VERIFY' || track.status === 'AMBIGUOUS') {
      strokeColor = '#F59E0B'; // Amber / Verification needed
    } else if (track.status === 'OTHER_CLASS') {
      strokeColor = '#38BDF8'; // Sky Blue
    }

    // 1. Subtle Outer Glow and Bounding Box
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 8;
    ctx.strokeRect(x, y, w, h);
    ctx.shadowBlur = 0; // Reset for crisp brackets and text

    // 2. High-Tech Corner Brackets (All 4 corners)
    const cLen = Math.min(18, w / 4, h / 4);
    ctx.lineWidth = 4;
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(x, y + cLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cLen, y);
    // Top-Right
    ctx.moveTo(x + w - cLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cLen);
    // Bottom-Left
    ctx.moveTo(x, y + h - cLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cLen, y + h);
    // Bottom-Right
    ctx.moveTo(x + w - cLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cLen);
    ctx.stroke();

    // 3. Crisp Identity Badge Pill
    const confText = track.confidence > 0 ? ` [${Math.round(track.confidence)}%]` : '';
    const mainLabel = `${track.label}${confText}`;

    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(mainLabel).width;
    const badgeW = textWidth + 24;
    const badgeH = 24;
    const badgeY = y > (badgeH + 8) ? (y - badgeH - 6) : (y + 6);

    // Pill background
    ctx.fillStyle = 'rgba(10, 10, 10, 0.92)';
    ctx.fillRect(x, badgeY, badgeW, badgeH);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, badgeY, badgeW, badgeH);

    // Status indicator dot
    ctx.fillStyle = strokeColor;
    ctx.beginPath();
    ctx.arc(x + 10, badgeY + 12, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Main Label text (always readable left-to-right)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(mainLabel, x + 18, badgeY + 16);

    // Secondary Tag (USN or status sub-label)
    if (track.sub_label && track.sub_label !== 'Not Registered') {
      ctx.font = '500 10px "JetBrains Mono", monospace';
      const subW = ctx.measureText(track.sub_label).width + 12;
      const subH = 18;
      const subY = badgeY + badgeH + 2;
      ctx.fillStyle = 'rgba(16, 16, 16, 0.90)';
      ctx.fillRect(x, subY, subW, subH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(x, subY, subW, subH);
      ctx.fillStyle = strokeColor;
      ctx.fillText(track.sub_label, x + 6, subY + 13);
    }

    ctx.restore();
  };

  // Reconcile Incoming Detections with Active Tracks (Mirrored & Smoothed)
  const reconcileDetectedFaces = (
    detectedFaces: DetectedFace[],
    canvasW: number,
    canvasH: number,
    sourceW: number,
    sourceH: number
  ) => {
    const now = performance.now();
    const scaleX = canvasW / sourceW;
    const scaleY = canvasH / sourceH;
    const isMirr = isMirroredRef.current;
    const tracks = activeTracksRef.current;
    const matchedTrackIds = new Set<string>();

    detectedFaces.forEach((face, idx) => {
      const [fx, fy, fw, fh] = face.bbox;

      // Scale coordinates from 640px processing space to canvas display space
      const unmirrX = fx * scaleX;
      const unmirrY = fy * scaleY;
      const boxW = fw * scaleX;
      const boxH = fh * scaleY;

      // Apply horizontal mirror formula: x_mirrored = CanvasWidth - x - width
      const targetX = isMirr ? (canvasW - unmirrX - boxW) : unmirrX;
      const targetY = unmirrY;
      const targetW = boxW;
      const targetH = boxH;

      // Primary key: track_id from backend or student_id
      let trackId = face.track_id || (face.student_id ? `st_${face.student_id}` : `face_${idx}`);
      let matchedTrack = tracks.get(trackId);

      // Fallback: match by centroid proximity if identity was updated
      if (!matchedTrack) {
        let bestDist = 120; // 120px max spatial proximity
        let bestCandidateId: string | null = null;
        const newCx = targetX + targetW / 2;
        const newCy = targetY + targetH / 2;

        tracks.forEach((cand, cId) => {
          if (matchedTrackIds.has(cId)) return;
          const candCx = cand.targetX + cand.targetW / 2;
          const candCy = cand.targetY + cand.targetH / 2;
          const d = Math.hypot(newCx - candCx, newCy - candCy);
          if (d < bestDist) {
            bestDist = d;
            bestCandidateId = cId;
          }
        });

        if (bestCandidateId) {
          matchedTrack = tracks.get(bestCandidateId);
          trackId = bestCandidateId;
        }
      }

      if (matchedTrack) {
        // Update existing track target position and data
        matchedTrack.targetX = targetX;
        matchedTrack.targetY = targetY;
        matchedTrack.targetW = targetW;
        matchedTrack.targetH = targetH;
        matchedTrack.label = face.label;
        matchedTrack.sub_label = face.sub_label;
        matchedTrack.confidence = face.confidence;
        matchedTrack.status = face.status;
        matchedTrack.student_id = face.student_id;
        matchedTrack.targetOpacity = 1.0;
        matchedTrack.lastSeen = now;
        matchedTrackIds.add(trackId);
      } else {
        // Create new smoothly fading-in track
        const newTrack: RenderTrack = {
          id: trackId,
          student_id: face.student_id,
          label: face.label,
          sub_label: face.sub_label,
          confidence: face.confidence,
          status: face.status,
          currX: targetX,
          currY: targetY,
          currW: targetW,
          currH: targetH,
          targetX: targetX,
          targetY: targetY,
          targetW: targetW,
          targetH: targetH,
          opacity: 0.25,
          targetOpacity: 1.0,
          lastSeen: now,
        };
        tracks.set(trackId, newTrack);
        matchedTrackIds.add(trackId);
      }
    });

    // Mark any tracks missing in this cycle for graceful fade out
    tracks.forEach((track, id) => {
      if (!matchedTrackIds.has(id)) {
        if (now - track.lastSeen > 350) {
          track.targetOpacity = 0.0;
        }
      }
    });
  };

  // High-Performance Latest-Frame Non-Overlapping Detection Loop
  const startFrameCaptureLoop = (activeSessionId: number) => {
    captureLoopActiveRef.current = true;
    isRequestInFlightRef.current = false;

    // Start 60 FPS animation render loop
    startOverlayAnimationLoop();

    const runCycle = async () => {
      if (!captureLoopActiveRef.current) return;

      if (!isRequestInFlightRef.current && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        if (video.readyState >= 2 && !video.paused && !video.ended) {
          isRequestInFlightRef.current = true;

          const vW = video.videoWidth || 640;
          const vH = video.videoHeight || 480;

          // Capture at optimized 640px processing width (4x faster dlib HOG inference)
          const procW = 640;
          const procH = Math.round((vH / vW) * procW);

          const canvas = canvasRef.current;
          canvas.width = procW;
          canvas.height = procH;
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.drawImage(video, 0, 0, procW, procH);
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.75); // fast ~35KB payload

            const t0 = performance.now();
            try {
              const result = await webcamApi.processFrame({
                session_id: activeSessionId,
                image_base64: imageBase64,
                client_timestamp: Date.now() / 1000,
              });

              const roundtrip = Math.round(performance.now() - t0);
              setBackendLatency(roundtrip);

              if (result) {
                if (result.metrics) setMetrics(result.metrics);
                if (result.faces) {
                  setActiveFaces(result.faces);
                  const overlayCanvas = overlayCanvasRef.current;
                  const dispW = overlayCanvas?.width || vW;
                  const dispH = overlayCanvas?.height || vH;
                  reconcileDetectedFaces(result.faces, dispW, dispH, procW, procH);
                }

                // Handle newly marked students
                if (result.newly_marked && result.newly_marked.length > 0) {
                  setRoster((prevRoster) =>
                    prevRoster.map((st) => {
                      const mark = result.newly_marked.find((m: any) => m.student_id === st.id);
                      if (mark) {
                        return {
                          ...st,
                          status: 'PRESENT',
                          confidence: mark.confidence / 100,
                          marked_at: mark.timestamp,
                        };
                      }
                      return st;
                    })
                  );

                  const newEntries: RecognitionLog[] = result.newly_marked.map((m: any) => ({
                    id: `${m.student_id}-${Date.now()}`,
                    student_name: m.full_name,
                    usn: m.usn,
                    confidence: m.confidence,
                    timestamp: m.timestamp,
                    status: 'PRESENT',
                  }));
                  setRecognitionLogs((prev) => [...newEntries, ...prev].slice(0, 30));
                }
              }
            } catch (e) {
              console.warn('Frame processing glitch:', e);
            } finally {
              isRequestInFlightRef.current = false;
            }
          } else {
            isRequestInFlightRef.current = false;
          }
        }
      }

      // Adaptive throttle: 90ms pause before capturing the next freshest frame (prevents queue buildup)
      if (captureLoopActiveRef.current) {
        captureTimeoutRef.current = setTimeout(runCycle, 90);
      }
    };

    runCycle();
  };

  // Stop & Review Attendance
  const handleStopAttendance = () => {
    processingRef.current = false;
    setIsProcessingLoop(false);
    captureLoopActiveRef.current = false;
    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (sendLoopRef.current) clearInterval(sendLoopRef.current);
    activeTracksRef.current.clear();
    stopCameraStream();

    // Open review modal
    setIsFinalizeModalOpen(true);
  };

  // Manual Mark Student Action
  const handleConfirmManualMark = async (student: RosterStudent) => {
    if (!sessionId) return;
    try {
      await webcamApi.manualMark({
        session_id: sessionId,
        student_id: student.id,
        status: 'PRESENT',
        reason: 'Faculty manual face verification in classroom',
      });

      // Update local state
      setRoster((prev) =>
        prev.map((s) =>
          s.id === student.id
            ? { ...s, status: 'PRESENT', confidence: 1.0, marked_at: new Date().toLocaleTimeString() }
            : s
        )
      );

      setMetrics((prev) => ({
        ...prev,
        attendance_marked: prev.attendance_marked + (student.status !== 'PRESENT' ? 1 : 0),
        recognized_students: prev.recognized_students + (student.status !== 'PRESENT' ? 1 : 0),
        remaining_students: Math.max(0, prev.remaining_students - (student.status !== 'PRESENT' ? 1 : 0)),
      }));

      setManualMarkStudent(null);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to manually mark student');
    }
  };

  // Finalize Session in Database
  const handleFinalizeAttendanceSession = async () => {
    if (!sessionId) return;
    setIsFinalizing(true);
    try {
      const summary = await webcamApi.finalizeSession({
        session_id: sessionId,
        confirm_absentees: true,
      });
      setFinalSummary(summary);
      setCompletedSuccess(true);
      setIsSessionActive(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to finalize attendance records');
    } finally {
      setIsFinalizing(false);
    }
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header
        pageTitle="Live Laptop Webcam Attendance"
        breadcrumbs={['Attendance', 'Webcam Biometrics']}
      />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              REAL-TIME BIOMETRIC ATTENDANCE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Live Webcam Attendance Studio
            </h1>
            <p className="text-xs text-synapse-secondary mt-1">
              Take attendance directly through your laptop webcam using real-time facial recognition and duplicate-prevention tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-synapse-surface border border-synapse-border font-mono text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSessionActive ? 'bg-synapse-yellow animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className={isSessionActive ? 'text-synapse-yellow font-bold' : 'text-synapse-secondary'}>
                {isSessionActive ? 'WEBCAM ACTIVE [2.5 FPS BIOMETRICS]' : 'WEBCAM STANDBY'}
              </span>
            </div>
          </div>
        </div>

        {/* 5-Metric Classroom Intelligence Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Total Visible People */}
          <div className="p-4 bg-synapse-surface border border-synapse-border relative">
            <span className="text-[10px] font-mono uppercase text-synapse-secondary block">
              A. Total Visible People
            </span>
            <p className="text-2xl font-black font-display text-white mt-1">
              {metrics.total_visible_people}
            </p>
            <span className="text-[10px] font-mono text-synapse-muted block mt-0.5">
              Distinct people in view
            </span>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink" />
          </div>

          {/* 2. Recognised Students */}
          <div className="p-4 bg-synapse-surface border border-synapse-border relative">
            <span className="text-[10px] font-mono uppercase text-synapse-secondary block">
              B. Recognised Students
            </span>
            <p className="text-2xl font-black font-display text-synapse-yellow mt-1">
              {metrics.recognized_students}
            </p>
            <span className="text-[10px] font-mono text-synapse-muted block mt-0.5">
              Unique enrolled matches
            </span>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-yellow" />
          </div>

          {/* 3. Attendance Marked */}
          <div className="p-4 bg-synapse-surface border border-synapse-border relative">
            <span className="text-[10px] font-mono uppercase text-synapse-secondary block">
              C. Attendance Marked
            </span>
            <p className="text-2xl font-black font-display text-emerald-400 mt-1">
              {metrics.attendance_marked}
            </p>
            <span className="text-[10px] font-mono text-synapse-muted block mt-0.5">
              Confirmed PRESENT
            </span>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-emerald-400" />
          </div>

          {/* 4. Unknown Individuals */}
          <div className="p-4 bg-synapse-surface border border-synapse-border relative">
            <span className="text-[10px] font-mono uppercase text-synapse-secondary block">
              D. Unknown Individuals
            </span>
            <p className="text-2xl font-black font-display text-synapse-pink mt-1">
              {metrics.unknown_individuals}
            </p>
            <span className="text-[10px] font-mono text-synapse-muted block mt-0.5">
              Unregistered visitors
            </span>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink" />
          </div>

          {/* 5. Remaining Students */}
          <div className="p-4 bg-synapse-surface border border-synapse-border relative col-span-2 sm:col-span-1">
            <span className="text-[10px] font-mono uppercase text-synapse-secondary block">
              E. Remaining Students
            </span>
            <p className="text-2xl font-black font-display text-zinc-400 mt-1">
              {metrics.remaining_students}
            </p>
            <span className="text-[10px] font-mono text-synapse-muted block mt-0.5">
              Not yet detected (of {metrics.total_roster})
            </span>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-500" />
          </div>
        </div>

        {/* STEP 1: Academic Lecture Configuration Bar */}
        <div className="p-5 bg-synapse-surface border border-synapse-border">
          <div className="flex items-center justify-between pb-3 border-b border-synapse-border mb-4">
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              STEP 1: SELECT ACADEMIC SESSION & CAMERA
            </span>
            <span className="text-[11px] font-mono text-synapse-muted">
              Instructor: {user?.full_name}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase text-synapse-secondary mb-1">
                Curriculum Subject
              </label>
              <select
                disabled={isSessionActive}
                value={selectedSubjectId || ''}
                onChange={(e) => setSelectedSubjectId(Number(e.target.value))}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none disabled:opacity-50"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} (Sem {s.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-synapse-secondary mb-1">
                Classroom / Room
              </label>
              <select
                disabled={isSessionActive}
                value={selectedClassroomId || ''}
                onChange={(e) => setSelectedClassroomId(Number(e.target.value))}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none disabled:opacity-50"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    Room {c.room_number} ({c.building || 'Lecture Hall'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-synapse-secondary mb-1">
                Camera Source Device
              </label>
              <select
                disabled={isSessionActive}
                value={selectedDeviceId}
                onChange={(e) => {
                  setSelectedDeviceId(e.target.value);
                  if (cameraStream) startCameraStream(e.target.value);
                }}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none disabled:opacity-50"
              >
                {availableDevices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1} (Built-in / USB)`}
                  </option>
                ))}
                {availableDevices.length === 0 && (
                  <option value="">Default Laptop Webcam</option>
                )}
              </select>
            </div>

            <div className="flex items-end">
              {!isSessionActive ? (
                <button
                  type="button"
                  onClick={handleStartAttendance}
                  className="w-full py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Attendance</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopAttendance}
                  className="w-full py-2.5 bg-red-600 text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-red-500 transition-all flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop & Review Attendance</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Camera Permission or Hardware Error Alert */}
        {cameraError && (
          <div className="p-4 bg-red-950/40 border border-red-500/50 flex items-start gap-3 text-red-200 text-xs font-mono">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider text-red-400">Camera Access Error</p>
              <p className="mt-1">{cameraError}</p>
              <button
                onClick={() => startCameraStream(selectedDeviceId)}
                className="mt-3 px-3 py-1 bg-red-500 text-black font-bold uppercase text-[10px] hover:bg-red-400"
              >
                Retry Camera Access
              </button>
            </div>
          </div>
        )}

        {/* MAIN SPLIT: Live Video Preview + Roster / Intelligence Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Live Webcam Viewport with Overlays (7 cols) */}
          <div className="lg:col-span-7 bg-synapse-surface border border-synapse-border p-5 relative flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-synapse-border mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-widest text-synapse-yellow font-semibold">
                    STEP 2: LIVE LAPTOP WEBCAM FEED
                  </span>
                  {isSessionActive && (
                    <Badge label="AI DETECTION LIVE" variant="yellow" size="sm" pulse />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleMirroring}
                    className={`flex items-center gap-1.5 px-2.5 py-1 bg-synapse-elevated border transition-all text-[10px] font-mono cursor-pointer ${
                      isMirrored
                        ? 'border-synapse-yellow text-synapse-yellow hover:bg-synapse-yellow/10'
                        : 'border-synapse-border text-synapse-secondary hover:text-white'
                    }`}
                    title="Toggle Camera Horizontal Mirroring"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    <span>{isMirrored ? 'ORIENTATION: MIRRORED (SELFIE VIEW)' : 'ORIENTATION: TRUE CAMERA (DIRECTOR)'}</span>
                  </button>

                  <span className="text-[11px] font-mono text-synapse-muted">
                    {selectedSubject?.code} • {selectedClassroom?.room_number}
                  </span>
                </div>
              </div>

              {/* Viewport Frame */}
              <div className="relative bg-black w-full aspect-video border border-synapse-border overflow-hidden flex items-center justify-center">
                {/* Standard HTML5 Video element with mirrored or natural orientation */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-transform duration-300 ${
                    isMirrored ? 'scale-x-[-1]' : ''
                  }`}
                />

                {/* Canvas Overlay for Cyberpunk HUD bounding boxes */}
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* Hidden canvas for grabbing frames to send to backend */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Standby Placeholder */}
                {!isSessionActive && !cameraStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-synapse-muted bg-synapse-deep/90">
                    <Camera className="w-12 h-12 text-synapse-pink mb-3 animate-pulse" />
                    <p className="text-sm font-mono font-bold text-white uppercase">
                      Laptop Webcam In Standby
                    </p>
                    <p className="text-xs font-mono text-synapse-secondary mt-1 max-w-sm">
                      Select your class and click <strong>"Start Attendance"</strong> to activate the camera and begin real-time face biometrics.
                    </p>
                  </div>
                )}

                {/* Top Overlay Banner when live with Telemetry */}
                {isSessionActive && (
                  <div className="absolute top-2 left-2 right-2 bg-black/85 backdrop-blur-md border border-synapse-border/80 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-white font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>LIVE HUD</span>
                      </div>
                      <span className="text-zinc-600 hidden sm:inline">|</span>
                      <span className="text-emerald-400 hidden sm:inline">
                        HUD: <strong className="text-white">{displayFps} FPS</strong>
                      </span>
                      <span className="text-zinc-600 hidden sm:inline">|</span>
                      <span className="text-synapse-yellow">
                        AI: <strong className="text-white">{backendLatency > 0 ? `${backendLatency}ms` : 'Ready'}</strong>
                      </span>
                      <span className="text-zinc-600 hidden sm:inline">|</span>
                      <span className="text-synapse-pink">
                        TRACKED: <strong className="text-white">{activeFaces.length}</strong>
                      </span>
                    </div>
                    <div className="text-synapse-yellow font-bold tracking-wider">
                      VERIFIED: {metrics.attendance_marked} / {metrics.total_roster}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Camera Info & Instructions */}
            <div className="mt-4 pt-3 border-t border-synapse-border text-[11px] font-mono text-synapse-secondary flex items-center justify-between">
              <span>Position webcam to capture students entering or seated in front.</span>
              <span className="text-synapse-pink font-bold">FOV: Wide Desktop Angle</span>
            </div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-yellow" />
          </div>

          {/* RIGHT: Live Class Roster & Activity Feed (5 cols) */}
          <div className="lg:col-span-5 bg-synapse-surface border border-synapse-border p-5 relative flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-synapse-border mb-3">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
                  STEP 3: CLASS ATTENDANCE ROSTER
                </span>
                <span className="text-[11px] font-mono text-synapse-secondary block mt-0.5">
                  Real-time presence verification ({metrics.attendance_marked}/{metrics.total_roster})
                </span>
              </div>
              <Badge
                label={`${metrics.remaining_students} Pending`}
                variant={metrics.remaining_students === 0 ? 'green' : 'gray'}
                size="sm"
              />
            </div>

            {/* Roster Table / List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1 custom-scrollbar">
              {roster.map((student) => {
                const isPresent = student.status === 'PRESENT';
                return (
                  <div
                    key={student.id}
                    className={`p-2.5 border transition-all flex items-center justify-between ${
                      isPresent
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-white'
                        : 'bg-synapse-elevated border-synapse-border/60 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar / Photo thumbnail */}
                      <div className="w-8 h-8 rounded-sm bg-zinc-800 border border-synapse-border flex items-center justify-center shrink-0 overflow-hidden">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={student.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-mono text-zinc-400">
                            {student.full_name[0]}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 truncate">
                        <p className="text-xs font-bold font-mono text-white truncate">
                          {student.full_name}
                        </p>
                        <p className="text-[10px] font-mono text-synapse-secondary">
                          {student.usn} {student.marked_at && `• ${student.marked_at}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isPresent ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>PRESENT</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">
                            Pending
                          </span>
                          {isSessionActive && (
                            <button
                              onClick={() => setManualMarkStudent(student)}
                              title="Manually verify student"
                              className="px-2 py-0.5 bg-synapse-surface border border-synapse-border hover:border-synapse-pink text-[10px] font-mono text-synapse-secondary hover:text-white"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {roster.length === 0 && (
                <div className="p-8 text-center text-xs font-mono text-synapse-muted">
                  No enrolled students found for the selected subject and classroom.
                </div>
              )}
            </div>

            {/* Bottom Stream / Recognition Ticker */}
            <div className="mt-4 pt-3 border-t border-synapse-border">
              <span className="text-[10px] font-mono uppercase text-synapse-secondary tracking-wider block mb-1.5">
                Live Recognition Activity Log
              </span>
              <div className="bg-synapse-elevated p-2 border border-synapse-border max-h-24 overflow-y-auto font-mono text-[11px] space-y-1">
                {recognitionLogs.length > 0 ? (
                  recognitionLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-zinc-300">
                      <span className="text-emerald-400 truncate">
                        [✓] {log.student_name} ({log.usn})
                      </span>
                      <span className="text-synapse-muted shrink-0 text-[10px]">
                        {log.timestamp} • {log.confidence}% match
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-synapse-muted text-[10px]">
                    {isSessionActive
                      ? 'Waiting for students to appear in front of camera...'
                      : 'Session standby. Click "Start Attendance" above.'}
                  </span>
                )}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink" />
          </div>
        </div>
      </main>

      {/* FINALIZATION & REVIEW MODAL */}
      <Modal
        isOpen={isFinalizeModalOpen}
        onClose={() => setIsFinalizeModalOpen(false)}
        title="REVIEW & FINALIZE LECTURE ATTENDANCE"
        maxWidth="lg"
      >
        <div className="space-y-5">
          {!completedSuccess ? (
            <>
              <div className="p-4 bg-synapse-surface border border-synapse-border">
                <span className="text-xs font-mono uppercase text-synapse-secondary">
                  Session Summary Overview
                </span>
                <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                  <div className="p-3 bg-synapse-elevated border border-synapse-border">
                    <span className="text-[10px] font-mono text-synapse-secondary uppercase">
                      Total Enrolled
                    </span>
                    <p className="text-2xl font-bold font-display text-white mt-1">
                      {metrics.total_roster}
                    </p>
                  </div>
                  <div className="p-3 bg-synapse-elevated border border-emerald-500/40">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">
                      Confirmed Present
                    </span>
                    <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
                      {metrics.attendance_marked}
                    </p>
                  </div>
                  <div className="p-3 bg-synapse-elevated border border-red-500/40">
                    <span className="text-[10px] font-mono text-red-400 uppercase">
                      Marked Absent
                    </span>
                    <p className="text-2xl font-bold font-display text-red-400 mt-1">
                      {metrics.remaining_students}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-mono text-synapse-secondary mb-2">
                  Review the roster below. Any students remaining in "Pending" will be automatically recorded as <strong>ABSENT</strong> upon confirmation.
                </p>

                <div className="max-h-60 overflow-y-auto border border-synapse-border divide-y divide-synapse-border text-xs font-mono">
                  {roster.map((st) => (
                    <div key={st.id} className="p-2.5 flex items-center justify-between bg-synapse-elevated">
                      <div>
                        <span className="font-bold text-white">{st.full_name}</span>
                        <span className="text-synapse-muted ml-2">({st.usn})</span>
                      </div>
                      <div>
                        {st.status === 'PRESENT' ? (
                          <span className="text-emerald-400 font-bold">PRESENT (Verified)</span>
                        ) : (
                          <span className="text-red-400">ABSENT (Not Detected)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-synapse-border">
                <button
                  type="button"
                  onClick={() => setIsFinalizeModalOpen(false)}
                  className="px-4 py-2 bg-synapse-surface border border-synapse-border text-white font-mono text-xs uppercase hover:bg-synapse-elevated"
                >
                  Return to Live Camera
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeAttendanceSession}
                  disabled={isFinalizing}
                  className="px-6 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2"
                >
                  {isFinalizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Finalizing Attendance Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Save Attendance</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500 mx-auto flex items-center justify-center text-emerald-400">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold font-display text-white uppercase tracking-tight">
                Attendance Finalized & Logged
              </h3>
              <p className="text-xs font-mono text-synapse-secondary max-w-md mx-auto">
                Official attendance records for {selectedSubject?.code} have been saved to the permanent academic database.
              </p>

              <div className="p-4 bg-synapse-elevated border border-synapse-border max-w-sm mx-auto font-mono text-xs text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-synapse-secondary">Present:</span>
                  <span className="text-emerald-400 font-bold">{finalSummary?.present_count} students</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-synapse-secondary">Absent:</span>
                  <span className="text-red-400 font-bold">{finalSummary?.absent_count} students</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-synapse-secondary">Attendance Rate:</span>
                  <span className="text-synapse-yellow font-bold">{finalSummary?.attendance_rate}%</span>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={() => setIsFinalizeModalOpen(false)}
                  className="px-6 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold hover:bg-synapse-softpink"
                >
                  Close & Done
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MANUAL VERIFICATION CONFIRMATION MODAL */}
      {manualMarkStudent && (
        <Modal
          isOpen={true}
          onClose={() => setManualMarkStudent(null)}
          title="MANUAL STUDENT VERIFICATION"
          maxWidth="sm"
        >
          <div className="space-y-4 font-mono text-xs">
            <p className="text-zinc-300">
              Confirm manual presence verification for:
            </p>
            <div className="p-3 bg-synapse-elevated border border-synapse-border">
              <p className="font-bold text-white text-sm">{manualMarkStudent.full_name}</p>
              <p className="text-synapse-secondary text-xs mt-0.5">{manualMarkStudent.usn}</p>
            </div>
            <p className="text-[11px] text-synapse-muted">
              This action will be logged in the permanent institutional audit trail under your faculty credentials.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-synapse-border">
              <button
                onClick={() => setManualMarkStudent(null)}
                className="px-3 py-1.5 bg-synapse-surface border border-synapse-border text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmManualMark(manualMarkStudent)}
                className="px-4 py-1.5 bg-synapse-pink text-white font-bold"
              >
                Mark Present
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
