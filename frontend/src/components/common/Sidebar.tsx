import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  Video, Eye, CheckSquare, ShieldCheck, BarChart3, FileSpreadsheet,
  Camera, History, Settings, Sparkles, ChevronRight, LogOut
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, isAdmin, isFaculty, logout } = useAuth();

  const adminNavItems = [
    { label: 'Overview', path: '/admin-dashboard', icon: LayoutDashboard },
    { label: 'Live Webcam Attendance', path: '/live-attendance', icon: Camera, highlight: true },
    { label: 'Students', path: '/students', icon: GraduationCap },
    { label: 'Faculty', path: '/faculty', icon: Users },
    { label: 'Academic Depts', path: '/academic', icon: BookOpen },
    { label: 'Timetable', path: '/timetable', icon: Calendar },
    { label: 'CCTV Processing', path: '/video-processing', icon: Video },
    { label: 'Live CCTV Streams', path: '/live', icon: Eye },
    { label: 'Attendance Records', path: '/attendance', icon: CheckSquare },
    { label: 'Verification Centre', path: '/verification', icon: ShieldCheck },
    { label: 'Analytics & Intel', path: '/analytics', icon: BarChart3 },
    { label: 'Reports & Export', path: '/reports', icon: FileSpreadsheet },
    { label: 'Camera Fleet', path: '/cameras', icon: Camera },
    { label: 'Audit Logs', path: '/audit', icon: History },
    { label: 'System Settings', path: '/settings', icon: Settings },
  ];

  const facultyNavItems = [
    { label: 'Faculty Dashboard', path: '/faculty-dashboard', icon: LayoutDashboard },
    { label: 'Start Webcam Attendance', path: '/live-attendance', icon: Camera, highlight: true },
    { label: 'My Timetable', path: '/timetable', icon: Calendar },
    { label: 'CCTV Video Upload', path: '/video-processing', icon: Video },
    { label: 'Live Classroom CCTV', path: '/live', icon: Eye },
    { label: 'Lecture Attendance', path: '/attendance', icon: CheckSquare },
    { label: 'Verification Queue', path: '/verification', icon: ShieldCheck },
    { label: 'Student Directory', path: '/students', icon: GraduationCap },
    { label: 'Shortage & Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Download Reports', path: '/reports', icon: FileSpreadsheet },
  ];

  const navItems = isAdmin ? adminNavItems : facultyNavItems;

  return (
    <aside className="w-64 bg-synapse-deep border-r border-synapse-border flex flex-col h-screen sticky top-0 select-none z-40">
      {/* Brand Header */}
      <div className="p-6 border-b border-synapse-border">
        <div
          onClick={() => onNavigate('/')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* Custom SYNAPSE Brand Mark */}
          <div className="relative w-8 h-8 rounded-sm bg-synapse-surface border border-synapse-pink flex items-center justify-center group-hover:shadow-pink-glow transition-all">
            <span className="w-2.5 h-2.5 rounded-full bg-synapse-yellow animate-pulse" />
            <div className="absolute inset-0 border border-synapse-pink/40 scale-125 rounded-none pointer-events-none" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display font-extrabold text-lg tracking-widest text-white">
                SYNAPSE
              </span>
              <span className="text-[10px] font-mono text-synapse-pink font-bold">2.0</span>
            </div>
            <p className="text-[10px] font-mono tracking-wider text-synapse-secondary uppercase">
              AI Classroom Intel
            </p>
          </div>
        </div>
      </div>

      {/* Role Pill Banner */}
      <div className="px-6 py-3 bg-synapse-surface/50 border-b border-synapse-border/40 flex items-center justify-between text-[11px] font-mono">
        <span className="text-synapse-secondary">ROLE CONTEXT</span>
        <span className="text-synapse-pink font-bold uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-synapse-pink" />
          {user?.role || 'SYSTEM'}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-synapse-pink text-white font-semibold shadow-pink-glow'
                  : 'text-synapse-secondary hover:text-white hover:bg-synapse-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-white'
                      : item.highlight
                      ? 'text-synapse-yellow group-hover:text-synapse-yellow'
                      : 'text-synapse-muted group-hover:text-white'
                  }`}
                />
                <span className="tracking-wide font-sans">{item.label}</span>
              </div>

              {item.highlight && !isActive && (
                <span className="text-[9px] font-mono uppercase bg-synapse-yellow/10 text-synapse-yellow border border-synapse-yellow/30 px-1.5 py-0.5 font-bold">
                  AI
                </span>
              )}
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
            </button>
          );
        })}
      </nav>

      {/* Sign Out Action Button */}
      <div className="px-3 py-2 border-t border-synapse-border/60">
        <button
          onClick={logout}
          title="Sign out of SYNAPSE"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider text-synapse-secondary hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Footer System Status */}
      <div className="p-4 border-t border-synapse-border bg-synapse-surface/40">
        <div className="flex items-center justify-between text-[10px] font-mono text-synapse-secondary">
          <span>PIPELINE</span>
          <span className="text-emerald-400 font-bold">ARC-FACE / CV</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-synapse-secondary">
          <span>LATENCY</span>
          <span className="text-synapse-yellow">28ms / FRAME</span>
        </div>
      </div>
    </aside>
  );
};

