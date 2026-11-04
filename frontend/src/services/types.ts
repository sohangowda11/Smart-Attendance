export type UserRole = 'ADMIN' | 'FACULTY';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  department_id?: number | null;
  department_name?: string | null;
  designation?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Student {
  id: number;
  usn: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  department_id?: number | null;
  department_code?: string | null;
  department_name?: string | null;
  semester: number;
  section: string;
  photo_url?: string | null;
  consent_status: boolean;
  is_active: boolean;
  has_biometric: boolean;
  attendance_percentage?: number;
  total_lectures?: number;
  attended_lectures?: number;
  created_at: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface Classroom {
  id: number;
  room_number: string;
  building: string;
  floor: number;
  capacity: number;
  has_cctv: boolean;
  created_at: string;
}

export interface Subject {
  id: number;
  code: string;
  name: string;
  department_id: number;
  department_code?: string | null;
  semester: number;
  credits: number;
  faculty_id?: number | null;
  faculty_name?: string | null;
  created_at: string;
}

export interface TimetableEntry {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject_id: number;
  subject_code?: string | null;
  subject_name?: string | null;
  faculty_id: number;
  faculty_name?: string | null;
  classroom_id: number;
  room_number?: string | null;
  building?: string | null;
  semester: number;
  section: string;
  created_at: string;
}

export interface Camera {
  id: number;
  camera_name: string;
  camera_code: string;
  classroom_id?: number | null;
  classroom_name?: string | null;
  location_desc?: string | null;
  stream_url: string;
  stream_type: 'RTSP' | 'WEBCAM' | 'SIMULATED';
  resolution: string;
  fps: number;
  status: 'ONLINE' | 'OFFLINE' | 'PROCESSING' | 'ERROR';
  is_active: boolean;
  health_score: number;
  last_frame_time?: string | null;
  created_at: string;
}

export interface LectureSession {
  id: number;
  timetable_id?: number | null;
  subject_id: number;
  subject_name?: string | null;
  subject_code?: string | null;
  faculty_id: number;
  faculty_name?: string | null;
  classroom_id: number;
  room_number?: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  status: 'SCHEDULED' | 'READY' | 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  video_source_type: string;
  video_filename?: string | null;
  annotated_video_path?: string | null;
  total_frames: number;
  total_detected: number;
  total_unique_tracks: number;
  total_recognized: number;
  created_at: string;
  completed_at?: string | null;
}

export interface AttendanceRecord {
  id: number;
  session_id: number;
  student_id: number;
  student_name?: string | null;
  student_usn?: string | null;
  student_photo?: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'PENDING_VERIFICATION' | 'EXCUSED';
  confidence_score: number;
  first_detected_at?: string | null;
  last_detected_at?: string | null;
  observations_count: number;
  duration_minutes: number;
  is_late: boolean;
  is_early_departure: boolean;
  manual_correction: boolean;
  correction_reason?: string | null;
  marked_at: string;
}

export interface VerificationQueueItem {
  id: number;
  session_id: number;
  candidate_student_id?: number | null;
  candidate_name?: string | null;
  candidate_usn?: string | null;
  frame_snapshot_path?: string | null;
  confidence: number;
  track_id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REASSIGNED';
  detected_at: string;
}

export interface DashboardStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  overall_attendance_pct: number;
  active_classrooms: number;
  connected_cameras: number;
  ongoing_lectures: number;
  completed_sessions: number;
}

export interface TrendPoint {
  date: string;
  attendance_rate: number;
  present_count: number;
  total_count: number;
}

export interface ShortageStudent {
  student_id: number;
  name: string;
  usn: string;
  department: string;
  semester: number;
  section: string;
  attendance_pct: number;
  attended_lectures: number;
  total_lectures: number;
  critical_status: 'CRITICAL' | 'WARNING' | 'SAFE';
}

export interface ClassroomOccupancy {
  room_number: string;
  capacity: number;
  current_occupancy: number;
  tracked_unique: number;
  recognized_students: number;
  occupancy_pct: number;
  camera_status: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  user_email: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  timestamp: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string | null;
  category: string;
}

