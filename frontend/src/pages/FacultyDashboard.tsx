import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/common/Header';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import {
  Calendar, BookOpen, Video, CheckSquare,
  AlertTriangle, Play, Clock, ArrowRight, Eye
} from 'lucide-react';
import { analyticsApi, attendanceApi, timetableApi, verificationApi } from '../services/api';
import { TimetableEntry, LectureSession, VerificationQueueItem } from '../services/types';

interface FacultyDashboardProps {
  onNavigate: (path: string) => void;
}

export const FacultyDashboard: React.FC<FacultyDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [facultyStats, setFacultyStats] = useState<any>(null);
  const [todayClasses, setTodayClasses] = useState<TimetableEntry[]>([]);
  const [recentSessions, setRecentSessions] = useState<LectureSession[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<VerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFacultyData();
  }, []);

  const loadFacultyData = async () => {
    try {
      setLoading(true);
      const todayWeekday = new Date().getDay(); // 0 is Sunday, 1 is Monday...
      const mappedWeekday = todayWeekday === 0 ? 6 : todayWeekday - 1;

      const [statsData, ttData, sessData, verifData] = await Promise.all([
        analyticsApi.getFacultyStats(),
        timetableApi.getAll({ day_of_week: mappedWeekday, faculty_id: user?.id }),
        attendanceApi.getSessions({ faculty_id: user?.id }),
        verificationApi.getQueue({ status_filter: 'PENDING' }),
      ]);

      setFacultyStats(statsData);
      setTodayClasses(ttData);
      setRecentSessions(sessData.slice(0, 5));
      setPendingVerifications(verifData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Faculty Teaching Hub" breadcrumbs={['Faculty', 'Teaching Hub']} />

      <main className="flex-1 p-6 sm:p-8 space-y-8 max-w-[1600px] w-full mx-auto">
        {/* Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              INSTRUCTOR WORKSPACE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Welcome, {user?.full_name}
            </h1>
            <p className="text-xs text-synapse-secondary mt-1 font-sans">
              Assigned Department: {user?.department_name || 'School of Computing'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/video-processing')}
              className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Record Lecture Attendance</span>
            </button>

            <button
              onClick={() => onNavigate('/verification')}
              className="px-4 py-2.5 bg-synapse-surface border border-synapse-border hover:border-synapse-yellow text-white font-mono text-xs uppercase font-semibold transition-all flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4 text-synapse-yellow" />
              <span>Review Queue ({pendingVerifications.length})</span>
            </button>
          </div>
        </div>

        {/* Faculty Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Assigned Courses"
            value={facultyStats?.assigned_subjects_count ?? '—'}
            subtitle="Curriculum subjects assigned to you"
            icon={BookOpen}
            accent="pink"
          />

          <StatCard
            title="Classes Conducted"
            value={facultyStats?.total_sessions_conducted ?? '—'}
            subtitle="CCTV video sessions archived"
            icon={Video}
            accent="yellow"
          />

          <StatCard
            title="Average Attendance"
            value={facultyStats ? `${facultyStats.average_attendance_pct}%` : '—'}
            subtitle="Across all assigned lecture sections"
            icon={CheckSquare}
            accent="white"
          />

          <StatCard
            title="Pending Verifications"
            value={pendingVerifications.length}
            subtitle="Borderline biometric recognitions"
            icon={AlertTriangle}
            accent={pendingVerifications.length > 0 ? 'yellow' : 'pink'}
          />
        </div>

        {/* Today's Schedule & Action Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Lectures */}
          <div className="lg:col-span-2 bg-synapse-surface border border-synapse-border p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-synapse-border mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-pink font-semibold">
                  TODAY'S TEACHING TIMETABLE
                </span>
                <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-0.5">
                  Scheduled Lecture Sessions
                </h3>
              </div>
              <Badge label="ACTIVE TERM" variant="pink" size="sm" />
            </div>

            <div className="space-y-3">
              {todayClasses.length === 0 ? (
                <div className="p-8 text-center bg-synapse-elevated border border-synapse-border/40 text-synapse-muted font-mono text-xs">
                  No lectures scheduled for today on the timetable.
                </div>
              ) : (
                todayClasses.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-synapse-elevated border border-synapse-border hover:border-synapse-pink/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono">
                          {item.subject_code}
                        </span>
                        <span className="text-xs text-synapse-secondary">
                          {item.subject_name}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs font-mono text-synapse-muted">
                        <span className="flex items-center gap-1 text-synapse-yellow">
                          <Clock className="w-3.5 h-3.5" />
                          {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                        </span>
                        <span>Hall: {item.room_number}</span>
                        <span>Section {item.section}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('/video-processing')}
                      className="px-4 py-2 bg-synapse-pink text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-synapse-softpink transition-all flex items-center gap-1.5 self-start sm:self-center"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Lecture</span>
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink" />
          </div>

          {/* Quick Camera & Classroom Monitor */}
          <div className="bg-synapse-surface border border-synapse-border p-6 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-synapse-border mb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-yellow font-semibold">
                    CCTV MONITORING
                  </span>
                  <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-0.5">
                    Live Classroom Feeds
                  </h3>
                </div>
                <Badge label="3 ONLINE" variant="yellow" size="sm" pulse />
              </div>

              <p className="text-xs text-synapse-secondary leading-relaxed font-sans mb-4">
                Access assigned live CCTV camera feeds, inspect real-time student occupancy, and launch automated face recognition.
              </p>

              <div className="p-3 bg-synapse-elevated border border-synapse-border/80 font-mono text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-synapse-secondary">Classroom LH-101:</span>
                  <span className="text-emerald-400 font-bold">STREAM ONLINE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-synapse-secondary">Camera CAM-01:</span>
                  <span className="text-synapse-yellow">30 FPS / 1080p</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-synapse-secondary">AI Pipeline:</span>
                  <span className="text-synapse-pink">TRACKING ACTIVE</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('/live')}
              className="mt-6 w-full py-2.5 bg-synapse-surface border border-synapse-yellow text-synapse-yellow font-mono text-xs uppercase font-bold tracking-wider hover:bg-synapse-yellow hover:text-black transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              <span>Open Live CCTV Monitor</span>
            </button>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-yellow" />
          </div>
        </div>

        {/* Recent Attendance Sessions */}
        <div className="bg-synapse-surface border border-synapse-border p-6 relative">
          <div className="flex items-center justify-between pb-4 border-b border-synapse-border mb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-pink font-semibold">
                LECTURE ARCHIVE
              </span>
              <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-0.5">
                My Recent Attendance Sessions
              </h3>
            </div>
            <button
              onClick={() => onNavigate('/attendance')}
              className="text-xs font-mono text-synapse-pink hover:text-synapse-softpink flex items-center gap-1"
            >
              <span>View All Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-synapse-border text-synapse-secondary uppercase text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Classroom</th>
                  <th className="py-3 px-4 text-center">Identified</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-synapse-border/40">
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-synapse-muted">
                      No attendance sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentSessions.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => onNavigate('/attendance')}
                      className="hover:bg-synapse-elevated/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 text-white font-medium">{s.session_date}</td>
                      <td className="py-3 px-4 text-synapse-pink font-bold">
                        {s.subject_code} — {s.subject_name}
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{s.room_number}</td>
                      <td className="py-3 px-4 text-center text-emerald-400 font-bold">
                        {s.total_recognized}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge label={s.status} variant="green" size="sm" />
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
    </div>
  );
};

