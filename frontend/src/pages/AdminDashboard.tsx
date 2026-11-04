import React, { useState, useEffect } from 'react';
import {
  Users, CheckCircle2, XCircle, TrendingUp,
  School, Video, Play, Award, ArrowUpRight,
  ShieldCheck, AlertTriangle, Eye, Plus, Calendar
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { analyticsApi, attendanceApi } from '../services/api';
import { DashboardStats, TrendPoint, ClassroomOccupancy, LectureSession } from '../services/types';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, BarChart, Bar, CartesianGrid
} from 'recharts';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [occupancy, setOccupancy] = useState<ClassroomOccupancy[]>([]);
  const [recentSessions, setRecentSessions] = useState<LectureSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, trendsData, occData, sessData] = await Promise.all([
        analyticsApi.getDashboardStats(),
        analyticsApi.getTrends(8),
        analyticsApi.getOccupancy(),
        attendanceApi.getSessions(),
      ]);

      setStats(statsData);
      setTrends(trendsData);
      setOccupancy(occData);
      setRecentSessions(sessData.slice(0, 5));
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Enterprise Command Overview" breadcrumbs={['Admin', 'Overview']} />

      <main className="flex-1 p-6 sm:p-8 space-y-8 max-w-[1600px] w-full mx-auto">
        {/* Welcome Banner / Quick Actions Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              ACADEMIC INTELLIGENCE SUITE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              SYSTEM COMMAND OVERVIEW
            </h1>
            <p className="text-xs text-synapse-secondary mt-1 font-sans">
              Real-time computer vision inference, CCTV stream health, and automated attendance metrics.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('/video-processing')}
              className="px-4 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Start Attendance Session</span>
            </button>

            <button
              onClick={() => onNavigate('/students')}
              className="px-4 py-2.5 bg-synapse-surface border border-synapse-border hover:border-synapse-yellow text-white font-mono text-xs uppercase font-semibold hover:text-synapse-yellow transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Student</span>
            </button>

            <button
              onClick={() => onNavigate('/reports')}
              className="px-4 py-2.5 bg-synapse-surface border border-synapse-border hover:border-white text-synapse-secondary hover:text-white font-mono text-xs uppercase font-semibold transition-all flex items-center gap-2"
            >
              <span>Audit Reports</span>
            </button>
          </div>
        </div>

        {/* Primary Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Enrolled Students"
            value={stats?.total_students ?? '—'}
            subtitle="Verified biometric profiles in database"
            icon={Users}
            accent="pink"
          />

          <StatCard
            title="Overall Attendance Rate"
            value={stats ? `${stats.overall_attendance_pct}%` : '—'}
            subtitle="Target policy threshold: 75.0%"
            icon={TrendingUp}
            accent="yellow"
            change={stats && stats.overall_attendance_pct >= 75 ? '+4.2%' : '-2.1%'}
            changePositive={stats ? stats.overall_attendance_pct >= 75 : true}
          />

          <StatCard
            title="Present Today"
            value={stats?.present_today ?? '—'}
            subtitle={`Absences recorded: ${stats?.absent_today ?? 0}`}
            icon={CheckCircle2}
            accent="white"
          />

          <StatCard
            title="CCTV Cameras Online"
            value={stats ? `${stats.connected_cameras} Active` : '—'}
            subtitle={`${stats?.active_classrooms ?? 0} Classrooms monitored`}
            icon={Video}
            accent="yellow"
          />
        </div>

        {/* Visual Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Attendance Trend Area Chart */}
          <div className="lg:col-span-2 bg-synapse-surface border border-synapse-border p-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-synapse-border mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-pink font-semibold">
                  CHRONOLOGICAL ANALYSIS
                </span>
                <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-0.5">
                  Institutional Attendance Trend
                </h3>
              </div>
              <Badge label="Daily Rate %" variant="pink" size="sm" />
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF168B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FF168B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#282828" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={11} tickLine={false} />
                  <YAxis domain={[50, 100]} stroke="#71717A" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#151515',
                      borderColor: '#282828',
                      borderRadius: '0px',
                      color: '#FFF',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="attendance_rate"
                    stroke="#FF168B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#pinkGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink" />
          </div>

          {/* Real-Time Classroom Occupancy Gauges */}
          <div className="bg-synapse-surface border border-synapse-border p-6 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-synapse-border mb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-yellow font-semibold">
                    REAL-TIME TELEMETRY
                  </span>
                  <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-0.5">
                    Classroom Occupancy
                  </h3>
                </div>
                <Badge label="LIVE" variant="yellow" pulse size="sm" />
              </div>

              <div className="space-y-4">
                {occupancy.map((cr, idx) => (
                  <div key={idx} className="p-3 bg-synapse-elevated border border-synapse-border/60">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">{cr.room_number}</span>
                      <span className="text-synapse-yellow font-semibold">
                        {cr.current_occupancy} / {cr.capacity} ({cr.occupancy_pct}%)
                      </span>
                    </div>
                    {/* Occupancy bar */}
                    <div className="w-full bg-zinc-800 h-2 mt-2 rounded-none overflow-hidden">
                      <div
                        className="bg-synapse-yellow h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, cr.occupancy_pct)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-synapse-secondary">
                      <span>Stream: {cr.camera_status}</span>
                      <span>Verified: {cr.recognized_students}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onNavigate('/live')}
              className="mt-6 w-full py-2 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-xs font-mono uppercase tracking-wider text-synapse-yellow font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Launch Multi-Camera Grid</span>
            </button>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-yellow" />
          </div>
        </div>

        {/* Recent Attendance Sessions & AI Activity Table */}
        <div className="bg-synapse-surface border border-synapse-border p-6 relative">
          <div className="flex items-center justify-between pb-4 border-b border-synapse-border mb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-pink font-semibold">
                AUDITED LOGS
              </span>
              <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-0.5">
                Recent Lecture Attendance Sessions
              </h3>
            </div>
            <button
              onClick={() => onNavigate('/attendance')}
              className="text-xs font-mono text-synapse-pink hover:text-synapse-softpink flex items-center gap-1"
            >
              <span>View All Sessions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-synapse-border text-synapse-secondary font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Session Date</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Faculty In-Charge</th>
                  <th className="py-3 px-4">Hall</th>
                  <th className="py-3 px-4 text-center">Tracks</th>
                  <th className="py-3 px-4 text-center">Recognized</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-synapse-border/40 font-mono">
                {recentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-synapse-muted">
                      No lecture sessions recorded yet.
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
                      <td className="py-3 px-4">
                        <span className="font-bold text-synapse-pink">{s.subject_code}</span>
                        <span className="text-synapse-secondary ml-1 hidden sm:inline">
                          — {s.subject_name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{s.faculty_name}</td>
                      <td className="py-3 px-4 text-zinc-400">{s.room_number}</td>
                      <td className="py-3 px-4 text-center text-synapse-yellow">{s.total_unique_tracks}</td>
                      <td className="py-3 px-4 text-center text-emerald-400 font-bold">{s.total_recognized}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          label={s.status}
                          variant={s.status === 'COMPLETED' ? 'green' : 'yellow'}
                          size="sm"
                        />
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

