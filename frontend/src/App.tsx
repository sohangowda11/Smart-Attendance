import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/common/Sidebar';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { FacultyDashboard } from './pages/FacultyDashboard';
import { StudentManagement } from './pages/StudentManagement';
import { FacultyManagement } from './pages/FacultyManagement';
import { AcademicManagement } from './pages/AcademicManagement';
import { TimetableManagement } from './pages/TimetableManagement';
import { VideoUploadProcessing } from './pages/VideoUploadProcessing';
import { LiveWebcamAttendance } from './pages/LiveWebcamAttendance';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { AttendanceSessions } from './pages/AttendanceSessions';
import { AttendanceVerification } from './pages/AttendanceVerification';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { CameraManagement } from './pages/CameraManagement';
import { NotificationCenter } from './pages/NotificationCenter';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { isAuthenticated, isAdmin, isFaculty, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('/');

  // Sync internal state when unauthenticated so history state doesn't hold protected routes
  // (All hooks MUST be called before any early return)
  useEffect(() => {
    if (!isAuthenticated && currentPath !== '/' && currentPath !== '/login') {
      setCurrentPath('/');
    }
  }, [isAuthenticated, currentPath]);

  if (loading) {
    return (
      <div className="min-h-screen bg-synapse-jet flex items-center justify-center font-mono text-sm text-synapse-secondary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-sm border-2 border-synapse-pink border-t-transparent animate-spin" />
          <span className="tracking-widest uppercase text-xs text-white">SYNAPSE AI INITIALIZING...</span>
        </div>
      </div>
    );
  }

  // Route Guard: If unauthenticated, only '/' (public landing) and '/login' are allowed.
  // Any protected path automatically falls back to the public landing page.
  // When starting the app, '/' always renders the Landing Page without auto-redirecting.
  const effectivePath = !isAuthenticated
    ? (currentPath === '/login' ? '/login' : '/')
    : (currentPath === '/login' ? (isAdmin ? '/admin-dashboard' : '/faculty-dashboard') : currentPath);

  // Landing page view (shown on startup for both guests and authenticated users)
  if (effectivePath === '/') {
    return (
      <LandingPage
        onLoginClick={() => setCurrentPath('/login')}
        onDashboardClick={() =>
          setCurrentPath(isAdmin ? '/admin-dashboard' : '/faculty-dashboard')
        }
      />
    );
  }

  if (effectivePath === '/login' && !isAuthenticated) {
    return (
      <LoginPage
        onSuccess={() => {
          const saved = localStorage.getItem('synapse_user');
          let role = 'ADMIN';
          try {
            if (saved) role = JSON.parse(saved).role;
          } catch {}
          setCurrentPath(role === 'ADMIN' ? '/admin-dashboard' : '/faculty-dashboard');
        }}
        onBackToHome={() => setCurrentPath('/')}
      />
    );
  }

  // Protected App Shell with Sidebar
  return (
    <div className="flex h-screen bg-synapse-jet overflow-hidden text-white">
      <Sidebar
        currentPath={effectivePath}
        onNavigate={(path) => setCurrentPath(path)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {effectivePath === '/admin-dashboard' && (
          <AdminDashboard onNavigate={(p) => setCurrentPath(p)} />
        )}
        {effectivePath === '/faculty-dashboard' && (
          <FacultyDashboard onNavigate={(p) => setCurrentPath(p)} />
        )}
        {effectivePath === '/students' && <StudentManagement />}
        {effectivePath === '/faculty' && <FacultyManagement />}
        {effectivePath === '/academic' && <AcademicManagement />}
        {effectivePath === '/timetable' && <TimetableManagement />}
        {effectivePath === '/live-attendance' && <LiveWebcamAttendance />}
        {effectivePath === '/video-processing' && <VideoUploadProcessing />}
        {effectivePath === '/live' && <LiveMonitoring />}
        {effectivePath === '/attendance' && (
          <AttendanceSessions onNavigate={(p) => setCurrentPath(p)} />
        )}
        {effectivePath === '/verification' && <AttendanceVerification />}
        {effectivePath === '/analytics' && <AnalyticsPage />}
        {effectivePath === '/reports' && <ReportsPage />}
        {effectivePath === '/cameras' && <CameraManagement />}
        {effectivePath === '/notifications' && <NotificationCenter />}
        {effectivePath === '/audit' && <AuditLogsPage />}
        {effectivePath === '/settings' && <SettingsPage />}
      </div>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

