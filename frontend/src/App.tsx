import React, { useState } from 'react';
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

  // If user is at root and authenticated, redirect to role dashboard
  const effectivePath =
    currentPath === '/' && isAuthenticated
      ? isAdmin
        ? '/admin-dashboard'
        : '/faculty-dashboard'
      : currentPath;

  // Unauthenticated landing or login view
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
          // AuthContext will update; default path handled above
          setCurrentPath('/admin-dashboard');
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
        {effectivePath === '/video-processing' && <VideoUploadProcessing />}
        {effectivePath === '/live' && <LiveMonitoring />}
        {effectivePath === '/attendance' && <AttendanceSessions />}
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

