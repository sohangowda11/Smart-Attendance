import axios from 'axios';
import {
  AuthResponse, User, Student, Department, Classroom, Subject,
  TimetableEntry, Camera, LectureSession, AttendanceRecord,
  VerificationQueueItem, DashboardStats, TrendPoint, ShortageStudent,
  ClassroomOccupancy, NotificationItem, AuditLogItem, SystemSetting
} from './types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('synapse_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token expiry handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('synapse_token');
      localStorage.removeItem('synapse_user');
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  me: async (): Promise<User> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: async () => {
    return api.post('/auth/logout');
  },
};

export const studentsApi = {
  getAll: async (params?: { department_id?: number; semester?: number; section?: string; search?: string }): Promise<Student[]> => {
    const res = await api.get('/students', { params });
    return res.data;
  },
  getDetails: async (id: number) => {
    const res = await api.get(`/students/${id}`);
    return res.data;
  },
  create: async (data: Partial<Student>): Promise<Student> => {
    const res = await api.post('/students', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Student>): Promise<Student> => {
    const res = await api.put(`/students/${id}`, data);
    return res.data;
  },
  delete: async (id: number, permanent = false) => {
    const res = await api.delete(`/students/${id}`, { params: { permanent } });
    return res.data;
  },
  enrollFace: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/students/${id}/enroll-face`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  enrollMultiFrame: async (id: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((f) => {
      formData.append('files', f);
    });
    const res = await api.post(`/students/${id}/enroll-multiframe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export const facultyApi = {
  getAll: async (params?: { department_id?: number; search?: string }): Promise<User[]> => {
    const res = await api.get('/faculty', { params });
    return res.data;
  },
  getDetails: async (id: number) => {
    const res = await api.get(`/faculty/${id}`);
    return res.data;
  },
  create: async (data: any): Promise<User> => {
    const res = await api.post('/faculty', data);
    return res.data;
  },
  update: async (id: number, data: any): Promise<User> => {
    const res = await api.put(`/faculty/${id}`, data);
    return res.data;
  },
  resetPassword: async (id: number, newPassword: string) => {
    const res = await api.post(`/faculty/${id}/reset-password`, { new_password: newPassword });
    return res.data;
  },
  delete: async (id: number, permanent = false) => {
    const res = await api.delete(`/faculty/${id}`, { params: { permanent } });
    return res.data;
  },
};

export const academicApi = {
  getDepartments: async (): Promise<Department[]> => {
    const res = await api.get('/departments');
    return res.data;
  },
  createDepartment: async (data: Partial<Department>): Promise<Department> => {
    const res = await api.post('/departments', data);
    return res.data;
  },
  getClassrooms: async (): Promise<Classroom[]> => {
    const res = await api.get('/classrooms');
    return res.data;
  },
  createClassroom: async (data: Partial<Classroom>): Promise<Classroom> => {
    const res = await api.post('/classrooms', data);
    return res.data;
  },
  getSubjects: async (params?: { department_id?: number; semester?: number; faculty_id?: number }): Promise<Subject[]> => {
    const res = await api.get('/subjects', { params });
    return res.data;
  },
  createSubject: async (data: Partial<Subject>): Promise<Subject> => {
    const res = await api.post('/subjects', data);
    return res.data;
  },
};

export const timetableApi = {
  getAll: async (params?: { day_of_week?: number; faculty_id?: number; classroom_id?: number; semester?: number }): Promise<TimetableEntry[]> => {
    const res = await api.get('/timetable', { params });
    return res.data;
  },
  create: async (data: any): Promise<TimetableEntry> => {
    const res = await api.post('/timetable', data);
    return res.data;
  },
  delete: async (id: number) => {
    return api.delete(`/timetable/${id}`);
  },
  getActiveLecture: async (params?: { classroom_id?: number; faculty_id?: number }) => {
    const res = await api.get('/timetable/active-lecture', { params });
    return res.data;
  },
};

export const camerasApi = {
  getAll: async (params?: { classroom_id?: number }): Promise<Camera[]> => {
    const res = await api.get('/cameras', { params });
    return res.data;
  },
  register: async (data: Partial<Camera>): Promise<Camera> => {
    const res = await api.post('/cameras', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Camera>): Promise<Camera> => {
    const res = await api.put(`/cameras/${id}`, data);
    return res.data;
  },
  delete: async (id: number) => {
    return api.delete(`/cameras/${id}`);
  },
  getHealth: async (id: number) => {
    const res = await api.get(`/cameras/${id}/health`);
    return res.data;
  },
};

export const videoApi = {
  upload: async (file: File, sessionId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sessionId) formData.append('session_id', String(sessionId));
    const res = await api.post('/video/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  startProcess: async (sessionId: number) => {
    const res = await api.post(`/video/process/${sessionId}`);
    return res.data;
  },
  getStatus: async (sessionId: number) => {
    const res = await api.get(`/video/status/${sessionId}`);
    return res.data;
  },
  getReport: async (sessionId: number) => {
    const res = await api.get(`/video/report/${sessionId}`);
    return res.data;
  },
};

export const webcamApi = {
  startSession: async (data: { subject_id: number; classroom_id: number; timetable_id?: number }) => {
    const res = await api.post('/webcam/start', data);
    return res.data;
  },
  processFrame: async (data: { session_id: number; image_base64: string; client_timestamp?: number }) => {
    const res = await api.post('/webcam/process-frame', data);
    return res.data;
  },
  getSessionStatus: async (sessionId: number) => {
    const res = await api.get(`/webcam/session/${sessionId}`);
    return res.data;
  },
  finalizeSession: async (data: { session_id: number; confirm_absentees?: boolean }) => {
    const res = await api.post('/webcam/finalize', data);
    return res.data;
  },
  manualMark: async (data: { session_id: number; student_id: number; status?: string; reason?: string }) => {
    const res = await api.post('/webcam/manual-mark', data);
    return res.data;
  },
};

export const liveApi = {
  getStats: async (cameraId: number) => {
    const res = await api.get(`/live/stats/${cameraId}`);
    return res.data;
  },
};

export const attendanceApi = {
  getSessions: async (params?: { subject_id?: number; faculty_id?: number; classroom_id?: number; status_filter?: string; date_filter?: string }): Promise<LectureSession[]> => {
    const res = await api.get('/attendance/sessions', { params });
    return res.data;
  },
  createSession: async (data: any): Promise<LectureSession> => {
    const res = await api.post('/attendance/sessions', data);
    return res.data;
  },
  getSessionDetails: async (id: number) => {
    const res = await api.get(`/attendance/sessions/${id}`);
    return res.data;
  },
  correctRecord: async (recordId: number, data: { new_status: string; reason: string }) => {
    const res = await api.put(`/attendance/records/${recordId}/correct`, data);
    return res.data;
  },
  finalizeSession: async (sessionId: number) => {
    const res = await api.post(`/attendance/sessions/${sessionId}/finalize`);
    return res.data;
  },
};

export const verificationApi = {
  getQueue: async (params?: { session_id?: number; status_filter?: string }): Promise<VerificationQueueItem[]> => {
    const res = await api.get('/verification/queue', { params });
    return res.data;
  },
  actOnItem: async (itemId: number, data: { action: string; reassigned_student_id?: number; review_notes?: string }) => {
    const res = await api.post(`/verification/${itemId}/action`, data);
    return res.data;
  },
};

export const analyticsApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/analytics/dashboard');
    return res.data;
  },
  getFacultyStats: async () => {
    const res = await api.get('/analytics/faculty-dashboard');
    return res.data;
  },
  getTrends: async (days: number = 10): Promise<TrendPoint[]> => {
    const res = await api.get('/analytics/trends', { params: { days } });
    return res.data;
  },
  getShortage: async (params?: { department_id?: number; threshold?: number }): Promise<ShortageStudent[]> => {
    const res = await api.get('/analytics/shortage', { params });
    return res.data;
  },
  getOccupancy: async (): Promise<ClassroomOccupancy[]> => {
    const res = await api.get('/analytics/occupancy');
    return res.data;
  },
};

export const reportsApi = {
  generatePdf: async (data: any) => {
    const res = await api.post('/reports/generate-pdf', data);
    return res.data;
  },
  generateExcel: async (data: any) => {
    const res = await api.post('/reports/generate-excel', data);
    return res.data;
  },
};

export const notificationsApi = {
  getAll: async (): Promise<NotificationItem[]> => {
    const res = await api.get('/notifications');
    return res.data;
  },
  markRead: async (id: number) => {
    return api.put(`/notifications/${id}/read`);
  },
  markAllRead: async () => {
    return api.put('/notifications/mark-all-read');
  },
};

export const auditApi = {
  getLogs: async (params?: { limit?: number; action?: string }): Promise<AuditLogItem[]> => {
    const res = await api.get('/audit/logs', { params });
    return res.data;
  },
};

export const settingsApi = {
  getAll: async (): Promise<SystemSetting[]> => {
    const res = await api.get('/settings');
    return res.data;
  },
  update: async (key: string, value: string) => {
    const res = await api.put(`/settings/${key}`, { value });
    return res.data;
  },
};

export default api;

