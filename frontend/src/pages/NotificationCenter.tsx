import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Bell, AlertTriangle, CheckCircle2, Check, Clock } from 'lucide-react';
import { notificationsApi } from '../services/api';
import { NotificationItem } from '../services/types';

export const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.getAll();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Notification & Telemetry Dispatch" breadcrumbs={['System', 'Notifications']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-4xl w-full mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              EVENT DISPATCH
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Notification Centre
            </h1>
          </div>

          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 bg-synapse-surface border border-synapse-border hover:border-synapse-pink text-xs font-mono uppercase text-white hover:text-synapse-pink transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark All as Read</span>
          </button>
        </div>

        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 bg-synapse-surface border transition-colors flex items-start gap-4 ${
                !n.is_read ? 'border-synapse-pink/60 bg-synapse-pink/5' : 'border-synapse-border'
              }`}
            >
              <div className="p-2 bg-synapse-elevated border border-synapse-border shrink-0 mt-0.5">
                {n.severity === 'ALERT' ? (
                  <AlertTriangle className="w-5 h-5 text-synapse-yellow" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-synapse-pink" />
                )}
              </div>

              <div className="flex-1 font-mono">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white font-sans">{n.title}</h4>
                  <span className="text-[10px] text-synapse-muted">
                    {new Date(n.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-synapse-secondary mt-1 font-sans leading-relaxed">
                  {n.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

