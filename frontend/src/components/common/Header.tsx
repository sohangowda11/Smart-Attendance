import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Bell, Video, User as UserIcon, LogOut, CheckCircle2, AlertTriangle, Shield, Check } from 'lucide-react';
import { notificationsApi } from '../../services/api';
import { NotificationItem } from '../../services/types';

interface HeaderProps {
  pageTitle: string;
  breadcrumbs?: string[];
}

export const Header: React.FC<HeaderProps> = ({ pageTitle, breadcrumbs = [] }) => {
  const { user, logout, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await notificationsApi.getAll();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      loadNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header className="h-16 border-b border-synapse-border bg-synapse-jet/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-synapse-secondary">
          <span>SYNAPSE</span>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              <span className="text-synapse-muted">/</span>
              <span>{b}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="h-4 w-px bg-synapse-border mx-1 hidden sm:block" />
        <h1 className="text-sm font-semibold text-white tracking-wide uppercase font-sans hidden sm:block">
          {pageTitle}
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Live System Indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-synapse-surface border border-synapse-border text-xs font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-synapse-yellow opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-synapse-yellow"></span>
          </span>
          <span className="text-zinc-300">VISION ENGINE</span>
          <span className="text-synapse-yellow font-bold">ONLINE</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 text-synapse-secondary hover:text-synapse-pink hover:bg-synapse-surface border border-transparent hover:border-synapse-border transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-synapse-pink text-white text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-synapse-surface border border-synapse-border shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-synapse-border">
                <span className="text-xs font-mono uppercase tracking-wider text-synapse-pink font-semibold">
                  System Alerts ({unreadCount})
                </span>
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-mono text-synapse-secondary hover:text-white flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Mark all read
                </button>
              </div>

              <div className="divide-y divide-synapse-border/40 max-h-72 overflow-y-auto mt-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-synapse-muted py-4 text-center">
                    No active notifications
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`py-2.5 px-2 flex items-start gap-2.5 hover:bg-synapse-elevated transition-colors ${
                        !n.is_read ? 'bg-synapse-pink/5' : ''
                      }`}
                    >
                      <div className="mt-0.5">
                        {n.severity === 'ALERT' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-synapse-yellow" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-synapse-pink" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-white">{n.title}</p>
                        <p className="text-[11px] text-synapse-secondary mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-3 pl-2 border-l border-synapse-border">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-white">{user?.full_name}</p>
            <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-pink font-semibold">
              {user?.role} {user?.department_name ? `• ${user.department_name.split(' ')[0]}` : ''}
            </span>
          </div>

          <button
            onClick={logout}
            title="Sign out of SYNAPSE"
            className="p-2 text-synapse-secondary hover:text-rose-400 hover:bg-synapse-surface border border-synapse-border/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

