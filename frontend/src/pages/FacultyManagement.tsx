import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Users, Plus, Mail, Phone, BookOpen, ShieldCheck,
  Edit3, Key, Eye, UserX, Search, Filter, RefreshCw,
  ShieldAlert, Check, X
} from 'lucide-react';
import { facultyApi, academicApi } from '../services/api';
import { User, Department } from '../services/types';

export const FacultyManagement: React.FC = () => {
  const [faculty, setFaculty] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter State
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | undefined>();

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  // Active Selected Faculty
  const [activeFaculty, setActiveFaculty] = useState<User | null>(null);
  const [facultyDetails, setFacultyDetails] = useState<any>(null);

  // Form states
  const [newFaculty, setNewFaculty] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'FACULTY',
    department_id: 1,
    designation: 'Assistant Professor',
    phone: '',
  });

  const [editFacultyData, setEditFacultyData] = useState({
    full_name: '',
    email: '',
    phone: '',
    designation: '',
    department_id: 1,
    is_active: true,
  });

  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadFaculty();
  }, [selectedDept]);

  const loadFaculty = async () => {
    try {
      setLoading(true);
      const [fData, dData] = await Promise.all([
        facultyApi.getAll({
          department_id: selectedDept,
          search: search || undefined,
        }),
        academicApi.getDepartments(),
      ]);
      setFaculty(fData);
      setDepartments(dData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadFaculty();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await facultyApi.create(newFaculty);
      setIsAddOpen(false);
      setNewFaculty({
        email: '',
        password: '',
        full_name: '',
        role: 'FACULTY',
        department_id: 1,
        designation: 'Assistant Professor',
        phone: '',
      });
      loadFaculty();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create faculty');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (f: User) => {
    setActiveFaculty(f);
    setEditFacultyData({
      full_name: f.full_name,
      email: f.email,
      phone: f.phone || '',
      designation: f.designation || 'Assistant Professor',
      department_id: f.department_id || 1,
      is_active: f.is_active,
    });
    setFeedbackMsg(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFaculty) return;
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await facultyApi.update(activeFaculty.id, editFacultyData);
      setIsEditOpen(false);
      loadFaculty();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update faculty record',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenResetPassword = (f: User) => {
    setActiveFaculty(f);
    setNewPassword('');
    setFeedbackMsg(null);
    setIsResetPasswordOpen(true);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFaculty) return;
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    setActionLoading(true);
    setFeedbackMsg(null);
    try {
      await facultyApi.resetPassword(activeFaculty.id, newPassword);
      setFeedbackMsg({
        type: 'success',
        text: `Password reset successfully for ${activeFaculty.full_name}`,
      });
      setTimeout(() => {
        setIsResetPasswordOpen(false);
      }, 1500);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to reset password',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDetails = async (f: User) => {
    setActiveFaculty(f);
    setIsDetailsOpen(true);
    try {
      const details = await facultyApi.getDetails(f.id);
      setFacultyDetails(details);
    } catch (e) {
      console.error('Error fetching faculty details:', e);
    }
  };

  const handleOpenDeactivate = (f: User) => {
    setActiveFaculty(f);
    setIsDeactivateOpen(true);
  };

  const handleConfirmDeactivate = async (permanent = false) => {
    if (!activeFaculty) return;
    setActionLoading(true);
    try {
      await facultyApi.delete(activeFaculty.id, permanent);
      setIsDeactivateOpen(false);
      setActiveFaculty(null);
      loadFaculty();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update faculty status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Faculty Accounts & Role Management" breadcrumbs={['Administration', 'Faculty']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              ACADEMIC PERSONNEL
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Faculty Directory
            </h1>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Faculty Account</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-synapse-surface border border-synapse-border flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[280px] max-w-md relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-synapse-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search faculty by name, email, or designation..."
              className="w-full bg-synapse-elevated border border-synapse-border pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-synapse-muted focus:border-synapse-pink focus:outline-none"
            />
          </form>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-synapse-secondary flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-synapse-pink" />
              <span>Department:</span>
            </span>
            <select
              value={selectedDept || ''}
              onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs font-mono text-white focus:border-synapse-pink focus:outline-none"
            >
              <option value="">All Academic Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Faculty Grid */}
        {loading ? (
          <div className="text-center py-12 text-synapse-secondary font-mono text-xs">
            Loading Faculty Directory...
          </div>
        ) : faculty.length === 0 ? (
          <div className="text-center py-12 p-8 border border-dashed border-synapse-border font-mono text-xs text-synapse-secondary">
            No faculty members found matching search criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faculty.map((f) => (
              <div
                key={f.id}
                className="p-6 bg-synapse-surface border border-synapse-border relative flex flex-col justify-between hover:border-synapse-pink/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-synapse-pink font-bold">
                      FACULTY #{f.id}
                    </span>
                    <Badge
                      label={f.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                      variant={f.is_active ? 'green' : 'red'}
                      size="sm"
                    />
                  </div>

                  <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white">
                    {f.full_name}
                  </h3>
                  <p className="text-xs font-mono text-synapse-yellow mt-0.5">{f.designation}</p>

                  <div className="mt-4 space-y-1.5 font-mono text-xs text-synapse-secondary">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-synapse-muted" />
                      <span>{f.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-synapse-muted" />
                      <span>{f.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-synapse-muted" />
                      <span>Dept: {f.department_name || 'School of AI'}</span>
                    </div>
                  </div>
                </div>

                {/* Admin Control Actions */}
                <div className="mt-6 pt-4 border-t border-synapse-border/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(f)}
                      title="Edit Faculty Record"
                      className="px-2 py-1 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-[11px] font-mono text-zinc-300 hover:text-white flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3 text-synapse-pink" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleOpenResetPassword(f)}
                      title="Reset Login Credentials"
                      className="px-2 py-1 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-[11px] font-mono text-synapse-yellow flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" />
                      <span>Password</span>
                    </button>

                    <button
                      onClick={() => handleOpenDetails(f)}
                      title="View Assigned Courses & Stats"
                      className="px-2 py-1 bg-synapse-pink/10 hover:bg-synapse-pink hover:text-white border border-synapse-pink/30 text-[11px] font-mono text-synapse-pink flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Courses</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenDeactivate(f)}
                    title="Safe Deactivate Account"
                    className="p-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Create Faculty */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Faculty Member"
        subtitle="Provision portal login and course assignment privileges"
      >
        <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={newFaculty.full_name}
              onChange={(e) => setNewFaculty({ ...newFaculty, full_name: e.target.value })}
              placeholder="Dr. Rajesh Sharma"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Email *</label>
              <input
                type="email"
                required
                value={newFaculty.email}
                onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                placeholder="faculty@synapse.ai"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Initial Password *</label>
              <input
                type="password"
                required
                value={newFaculty.password}
                onChange={(e) => setNewFaculty({ ...newFaculty, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Designation</label>
              <input
                type="text"
                value={newFaculty.designation}
                onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })}
                placeholder="Professor"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Department</label>
              <select
                value={newFaculty.department_id}
                onChange={(e) => setNewFaculty({ ...newFaculty, department_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Phone</label>
            <input
              type="tel"
              value={newFaculty.phone}
              onChange={(e) => setNewFaculty({ ...newFaculty, phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold tracking-wider hover:bg-synapse-softpink flex items-center gap-1.5"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Account</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Faculty */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Faculty Record"
        subtitle={`Update details for ${activeFaculty?.full_name}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={editFacultyData.full_name}
                onChange={(e) => setEditFacultyData({ ...editFacultyData, full_name: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Email *</label>
              <input
                type="email"
                required
                value={editFacultyData.email}
                onChange={(e) => setEditFacultyData({ ...editFacultyData, email: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Designation</label>
              <input
                type="text"
                value={editFacultyData.designation}
                onChange={(e) => setEditFacultyData({ ...editFacultyData, designation: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Department</label>
              <select
                value={editFacultyData.department_id}
                onChange={(e) => setEditFacultyData({ ...editFacultyData, department_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Phone</label>
            <input
              type="tel"
              value={editFacultyData.phone}
              onChange={(e) => setEditFacultyData({ ...editFacultyData, phone: e.target.value })}
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-synapse-elevated border border-synapse-border">
            <input
              type="checkbox"
              id="faculty_is_active"
              checked={editFacultyData.is_active}
              onChange={(e) => setEditFacultyData({ ...editFacultyData, is_active: e.target.checked })}
              className="w-4 h-4 accent-synapse-pink cursor-pointer"
            />
            <label htmlFor="faculty_is_active" className="text-white cursor-pointer">
              Faculty Account Active (Authorized to conduct lecture sessions)
            </label>
          </div>

          {feedbackMsg && (
            <div className={`p-3 text-xs border ${
              feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-rose-500/10 border-rose-500 text-rose-300'
            }`}>
              {feedbackMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold tracking-wider hover:bg-synapse-softpink flex items-center gap-1.5"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reset Password */}
      <Modal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        title="Reset Faculty Password"
        subtitle={`Administrative credential reset for ${activeFaculty?.email}`}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveResetPassword} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">New Password (Min 6 chars) *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white focus:border-synapse-pink focus:outline-none"
            />
          </div>

          {feedbackMsg && (
            <div className={`p-3 text-xs border ${
              feedbackMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-rose-500/10 border-rose-500 text-rose-300'
            }`}>
              {feedbackMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsResetPasswordOpen(false)}
              className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 bg-synapse-yellow text-black font-bold uppercase tracking-wider hover:bg-yellow-300 flex items-center gap-1.5"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Faculty Details & Course Assignments */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setFacultyDetails(null);
        }}
        title="Faculty Dossier & Assignments"
        subtitle={activeFaculty?.full_name || ''}
        maxWidth="md"
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="p-3 bg-synapse-elevated border border-synapse-border space-y-1">
            <div className="flex justify-between">
              <span className="text-synapse-secondary">Email:</span>
              <span className="text-white">{activeFaculty?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synapse-secondary">Designation:</span>
              <span className="text-synapse-yellow font-bold">{activeFaculty?.designation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synapse-secondary">Department:</span>
              <span className="text-white">{activeFaculty?.department_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-synapse-secondary">Total Lectures Conducted:</span>
              <span className="text-emerald-400 font-bold">{facultyDetails?.total_sessions_conducted ?? 0}</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase text-synapse-pink font-bold mb-2">
              Assigned Courses / Subjects
            </h4>
            {facultyDetails?.assigned_subjects?.length > 0 ? (
              <div className="space-y-2">
                {facultyDetails.assigned_subjects.map((sub: any) => (
                  <div key={sub.id} className="p-2.5 bg-synapse-surface border border-synapse-border flex justify-between items-center">
                    <div>
                      <span className="text-synapse-pink font-bold">{sub.code}</span>
                      <p className="text-[11px] text-zinc-300 mt-0.5">{sub.name}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-synapse-elevated text-synapse-secondary text-[10px]">
                      Sem {sub.semester} • {sub.credits} Credits
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 italic p-3 border border-dashed border-synapse-border text-center">
                No active courses assigned in current semester timetable.
              </p>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-synapse-border">
            <button
              onClick={() => setIsDetailsOpen(false)}
              className="px-4 py-2 bg-synapse-elevated border border-synapse-border text-white uppercase"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Safe Deactivate Faculty */}
      <Modal
        isOpen={isDeactivateOpen}
        onClose={() => {
          setIsDeactivateOpen(false);
          setActiveFaculty(null);
        }}
        title="Faculty Account Status & Deactivation"
        subtitle={`Admin action for ${activeFaculty?.full_name}`}
        maxWidth="md"
      >
        {activeFaculty && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold uppercase tracking-wider text-white">Institutional Record Safeguard</p>
                <p className="mt-1 text-[11px] text-zinc-300">
                  Deactivating this faculty account preserves all historical attendance sessions, verification records, and institutional audit logs conducted by {activeFaculty.full_name}.
                </p>
              </div>
            </div>

            <div className="p-3 bg-synapse-elevated border border-synapse-border space-y-1">
              <div className="flex justify-between">
                <span className="text-synapse-secondary">Faculty Member:</span>
                <span className="text-white font-bold">{activeFaculty.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-synapse-secondary">Email:</span>
                <span className="text-synapse-pink font-bold">{activeFaculty.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-synapse-secondary">Current Status:</span>
                <span className={activeFaculty.is_active ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {activeFaculty.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-synapse-border">
              <button
                type="button"
                onClick={() => {
                  setIsDeactivateOpen(false);
                  setActiveFaculty(null);
                }}
                className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white uppercase"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmDeactivate(false)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Deactivate Faculty Account</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

