import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  ShieldCheck, AlertTriangle, CheckCircle2,
  XCircle, UserCheck, MessageSquare, Eye
} from 'lucide-react';
import { verificationApi, studentsApi } from '../services/api';
import { VerificationQueueItem, Student } from '../services/types';

export const AttendanceVerification: React.FC = () => {
  const [queue, setQueue] = useState<VerificationQueueItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Action modal
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<VerificationQueueItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REASSIGN'>('APPROVE');
  const [reassignedId, setReassignedId] = useState<number | undefined>();
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [qData, sData] = await Promise.all([
        verificationApi.getQueue({ status_filter: 'PENDING' }),
        studentsApi.getAll(),
      ]);
      setQueue(qData);
      setStudents(sData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAction = (item: VerificationQueueItem, type: 'APPROVE' | 'REJECT' | 'REASSIGN') => {
    setActiveItem(item);
    setActionType(type);
    setReassignedId(item.candidate_student_id || undefined);
    setReviewNotes('');
    setIsActionModalOpen(true);
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setActionLoading(true);

    try {
      await verificationApi.actOnItem(activeItem.id, {
        action: actionType,
        reassigned_student_id: actionType === 'REASSIGN' ? reassignedId : undefined,
        review_notes: reviewNotes,
      });
      setIsActionModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit verification action');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Biometric Verification Centre" breadcrumbs={['AI Engine', 'Verification Queue']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-yellow font-semibold">
              HUMAN-IN-THE-LOOP QUALITY ASSURANCE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Attendance Verification Queue
            </h1>
            <p className="text-xs text-synapse-secondary mt-1">
              Borderline recognitions (confidence between 48% and 65%) requiring instructor confirmation before automatic attendance marking.
            </p>
          </div>

          <Badge
            label={`${queue.length} PENDING AUDITS`}
            variant={queue.length > 0 ? 'yellow' : 'green'}
            size="md"
            pulse={queue.length > 0}
          />
        </div>

        {/* Verification Queue Items Grid */}
        {queue.length === 0 ? (
          <div className="p-16 text-center bg-synapse-surface border border-synapse-border">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold font-display uppercase text-white">
              Verification Queue Clear
            </h3>
            <p className="text-xs text-synapse-secondary mt-1 font-mono">
              All high-confidence computer vision detections have been processed. No uncertain matches pending review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {queue.map((item) => (
              <div
                key={item.id}
                className="bg-synapse-surface border border-synapse-border p-6 flex flex-col justify-between relative hover:border-synapse-yellow/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-synapse-border mb-4">
                    <span className="font-mono text-xs font-bold text-synapse-yellow">
                      TRACK #{item.track_id}
                    </span>
                    <span className="font-mono text-xs text-white">
                      {(item.confidence * 100).toFixed(1)}% Match
                    </span>
                  </div>

                  {/* Frame snapshot */}
                  <div className="aspect-video w-full bg-zinc-950 border border-synapse-border mb-4 flex items-center justify-center overflow-hidden">
                    {item.frame_snapshot_path ? (
                      <img
                        src={item.frame_snapshot_path}
                        alt="Face detection frame"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center font-mono text-xs text-synapse-muted">
                        <AlertTriangle className="w-6 h-6 text-synapse-yellow mx-auto mb-1" />
                        <span>Surveillance Snapshot</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 font-mono text-xs">
                    <p className="text-synapse-secondary text-[11px]">Best Student Candidate:</p>
                    <p className="font-bold text-white text-sm">{item.candidate_name}</p>
                    <p className="text-synapse-pink text-xs">{item.candidate_usn}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t border-synapse-border grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleOpenAction(item, 'APPROVE')}
                    className="py-2 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-bold uppercase transition-colors"
                  >
                    Confirm
                  </button>

                  <button
                    onClick={() => handleOpenAction(item, 'REASSIGN')}
                    className="py-2 bg-synapse-elevated hover:bg-zinc-800 text-synapse-yellow border border-synapse-border text-[11px] font-mono font-bold uppercase transition-colors"
                  >
                    Reassign
                  </button>

                  <button
                    onClick={() => handleOpenAction(item, 'REJECT')}
                    className="py-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border border-rose-500/40 text-[11px] font-mono font-bold uppercase transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Action Review Modal */}
      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title="Verification Decision Review"
        subtitle={`Action: ${actionType} for Track #${activeItem?.track_id}`}
      >
        <form onSubmit={handleSubmitAction} className="space-y-4 font-mono text-xs">
          {actionType === 'REASSIGN' && (
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">
                Select Correct Student *
              </label>
              <select
                value={reassignedId || ''}
                onChange={(e) => setReassignedId(Number(e.target.value))}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.usn} — {st.full_name} ({st.department_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-synapse-secondary uppercase mb-1">
              Instructor Review Notes
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="e.g. Confirmed student identity based on seating position and clothing match."
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white placeholder-synapse-muted focus:border-synapse-pink focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsActionModalOpen(false)}
              className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold tracking-wider hover:bg-synapse-softpink"
            >
              {actionLoading ? 'Recording...' : 'Submit Decision'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

