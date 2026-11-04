import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { History, Shield, Filter, Search } from 'lucide-react';
import { auditApi } from '../services/api';
import { AuditLogItem } from '../services/types';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await auditApi.getLogs({ limit: 50 });
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Forensic Activity & Audit System" breadcrumbs={['System', 'Audit Trail']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="pb-6 border-b border-synapse-border">
          <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
            IMMUTABLE SECURITY RECORDS
          </span>
          <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
            System Audit Trail
          </h1>
          <p className="text-xs text-synapse-secondary mt-1">
            Tamper-evident chronological logs capturing all user logins, biometric enrollments, manual attendance overrides, and administrative modifications.
          </p>
        </div>

        <div className="bg-synapse-surface border border-synapse-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-synapse-border text-synapse-secondary uppercase text-[11px] bg-synapse-deep">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Audit Details</th>
                  <th className="py-3 px-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-synapse-border/40">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-synapse-elevated/60">
                    <td className="py-3 px-4 text-zinc-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-synapse-pink">{log.action}</td>
                    <td className="py-3 px-4 text-white">{log.user_email}</td>
                    <td className="py-3 px-4 text-synapse-yellow">{log.entity} #{log.entity_id || ''}</td>
                    <td className="py-3 px-4 text-zinc-300 font-sans text-[11px]">{log.details}</td>
                    <td className="py-3 px-4 text-right text-synapse-muted">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

