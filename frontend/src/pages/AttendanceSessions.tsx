import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  CheckSquare, Calendar, Filter, Search,
  Edit3, CheckCircle2, Clock, AlertCircle,
  FileCheck, ShieldAlert, Check
} from 'lucide-react';
import { attendanceApi } from '../services/api';
import { LectureSession, AttendanceRecord } from '../services/types';

export const AttendanceSessions: React.FC = () => {
  const [sessions, setSessions] = useState<LectureSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Correction state
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [correctingRecord, setCorrectingRecord] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState<string>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctLoading, setCorrectLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await attendanceApi.getSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        handleViewSession(data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = async (sessionId: number) => {
    setSelectedSessionId(sessionId);
    try {
      const details = await attendanceApi.getSessionDetails(sessionId);
      setSessionDetail(details);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCorrect = (record: AttendanceRecord) => {
    setCorrectingRecord(record);
    setNewStatus(record.status === 'ABSENT' ? 'PRESENT' : 'EXCUSED');
    setCorrectionReason('');
    setIsCorrectModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRecord) return;
    setCorrectLoading(true);

    try {
      await attendanceApi.correctRecord(correctingRecord.id, {
        new_status: newStatus,
        reason: correctionReason,
      });
      setIsCorrectModalOpen(false);
      // Reload session detail
      if (selectedSessionId) {
        handleViewSession(selectedSessionId);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to correct record');
    } finally {
      setCorrectLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedSessionId) return;
    try {
      await attendanceApi.finalizeSession(selectedSessionId);
      handleViewSession(selectedSessionId);
      loadSessions();
      alert('Lecture attendance finalized. Absent records automatically logged for undetected students.');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Lecture Attendance Ledger & Audit" breadcrumbs={['Attendance', 'Sessions']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              ACADEMIC ATTENDANCE LEDGER
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Lecture Attendance Records
            </h1>
            <p className="text-xs text-synapse-secondary mt-1">
              Automated computer-vision attendance logs, duplicate detection prevention, and faculty manual correction audit trails.
            </p>
          </div>

          {sessionDetail?.session.status !== 'COMPLETED' && selectedSessionId && (
            <button
              onClick={handleFinalize}
              className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 self-start md:self-auto"
            >
              <Check className="w-4 h-4" />
              <span>Finalize & Mark Absences</span>
            </button>
          )}
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Session List */}
          <div className="bg-synapse-surface border border-synapse-border p-4 h-[750px] flex flex-col">
            <span className="text-xs font-mono uppercase tracking-wider text-synapse-pink font-semibold mb-3">
              Lecture Sessions ({sessions.length})
            </span>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleViewSession(s.id)}
                  className={`p-3.5 border transition-all cursor-pointer font-mono text-xs ${
                    selectedSessionId === s.id
                      ? 'bg-synapse-pink/10 border-synapse-pink shadow-pink-glow'
                      : 'bg-synapse-elevated border-synapse-border hover:border-zinc-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{s.subject_code}</span>
                    <Badge
                      label={s.status}
                      variant={s.status === 'COMPLETED' ? 'green' : 'yellow'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[11px] text-synapse-secondary font-sans mt-0.5 truncate">
                    {s.subject_name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-synapse-muted">
                    <span>{s.session_date}</span>
                    <span>Hall: {s.room_number}</span>
                    <span className="text-emerald-400 font-bold">{s.total_recognized} Verified</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Session Details & Student Records Table */}
          <div className="lg:col-span-2 bg-synapse-surface border border-synapse-border p-6 flex flex-col justify-between">
            {sessionDetail ? (
              <div className="space-y-6">
                {/* Header Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-synapse-elevated border border-synapse-border">
                    <span className="text-[10px] font-mono text-synapse-secondary uppercase">
                      Total Roster
                    </span>
                    <p className="text-2xl font-bold font-display text-white mt-0.5">
                      {sessionDetail.stats.total_enrolled}
                    </p>
                  </div>

                  <div className="p-3 bg-synapse-elevated border border-synapse-border">
                    <span className="text-[10px] font-mono text-synapse-secondary uppercase">
                      Verified Present
                    </span>
                    <p className="text-2xl font-bold font-display text-emerald-400 mt-0.5">
                      {sessionDetail.stats.present_count}
                    </p>
                  </div>

                  <div className="p-3 bg-synapse-elevated border border-synapse-border">
                    <span className="text-[10px] font-mono text-synapse-secondary uppercase">
                      Late Arrivals
                    </span>
                    <p className="text-2xl font-bold font-display text-synapse-yellow mt-0.5">
                      {sessionDetail.stats.late_count}
                    </p>
                  </div>

                  <div className="p-3 bg-synapse-elevated border border-synapse-border">
                    <span className="text-[10px] font-mono text-synapse-secondary uppercase">
                      Recorded Absences
                    </span>
                    <p className="text-2xl font-bold font-display text-rose-400 mt-0.5">
                      {sessionDetail.stats.absent_count}
                    </p>
                  </div>
                </div>

                {/* Records Table */}
                <div className="border border-synapse-border">
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead className="sticky top-0 bg-synapse-deep border-b border-synapse-border text-[11px] text-synapse-secondary uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Student</th>
                          <th className="py-2.5 px-3">USN</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Confidence</th>
                          <th className="py-2.5 px-3 text-center">Duration</th>
                          <th className="py-2.5 px-3 text-right">Correction</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-synapse-border/40">
                        {sessionDetail.records.map((r: any) => {
                          const statusVariant = {
                            PRESENT: 'green',
                            LATE: 'yellow',
                            ABSENT: 'red',
                            EXCUSED: 'blue',
                            PENDING_VERIFICATION: 'yellow',
                          }[r.status as string] as any || 'gray';

                          return (
                            <tr key={r.id} className="hover:bg-synapse-elevated/60">
                              <td className="py-2.5 px-3 font-sans font-bold text-white">
                                {r.student_name}
                              </td>
                              <td className="py-2.5 px-3 text-synapse-pink">{r.student_usn}</td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge label={r.status} variant={statusVariant} size="sm" />
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {r.confidence_score > 0
                                  ? `${(r.confidence_score * 100).toFixed(1)}%`
                                  : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center text-synapse-muted">
                                {r.duration_minutes > 0 ? `${r.duration_minutes.toFixed(0)}m` : '0m'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => handleOpenCorrect(r)}
                                  className="px-2 py-1 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-[11px] text-synapse-secondary hover:text-white transition-colors"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-synapse-muted font-mono text-xs">
                Select a session on the left to inspect detailed attendance records.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal: Correct Attendance */}
      <Modal
        isOpen={isCorrectModalOpen}
        onClose={() => setIsCorrectModalOpen(false)}
        title="Faculty Attendance Correction"
        subtitle={`Audit-logged override for ${correctingRecord?.student_name} (${correctingRecord?.student_usn})`}
      >
        <form onSubmit={handleSaveCorrection} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">
              New Attendance Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
            >
              <option value="PRESENT">PRESENT</option>
              <option value="LATE">LATE</option>
              <option value="ABSENT">ABSENT</option>
              <option value="EXCUSED">EXCUSED (Medical / On-Duty)</option>
            </select>
          </div>

          <div>
            <label className="block text-synapse-secondary uppercase mb-1">
              Mandatory Reason for Correction *
            </label>
            <textarea
              required
              rows={3}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="e.g. Student was attending university symposium presentation with permission."
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white placeholder-synapse-muted focus:border-synapse-pink focus:outline-none"
            />
          </div>

          <div className="p-3 bg-synapse-elevated border border-synapse-border text-[11px] text-synapse-secondary">
            Note: This override will be recorded in the immutable audit log with your user identity and timestamp.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsCorrectModalOpen(false)}
              className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={correctLoading || !correctionReason.trim()}
              className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold tracking-wider hover:bg-synapse-softpink disabled:opacity-50"
            >
              {correctLoading ? 'Logging...' : 'Confirm Override'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

