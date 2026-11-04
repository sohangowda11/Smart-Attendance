import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  GraduationCap, Search, Plus, Filter,
  CheckCircle2, AlertTriangle, Upload, Eye,
  Shield, UserCheck, ArrowUpRight
} from 'lucide-react';
import { studentsApi, academicApi } from '../services/api';
import { Student, Department } from '../services/types';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<number | undefined>();
  const [selectedSem, setSelectedSem] = useState<number | undefined>();

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEnrollFaceOpen, setIsEnrollFaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);

  // Form states
  const [newStudent, setNewStudent] = useState({
    usn: '',
    full_name: '',
    email: '',
    phone: '',
    department_id: 1,
    semester: 6,
    section: 'A',
    consent_status: true,
  });

  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedSem]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studData, deptData] = await Promise.all([
        studentsApi.getAll({
          department_id: selectedDept,
          semester: selectedSem,
          search: search || undefined,
        }),
        academicApi.getDepartments(),
      ]);
      setStudents(studData);
      setDepartments(deptData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await studentsApi.create(newStudent);
      setIsRegisterOpen(false);
      setNewStudent({
        usn: '',
        full_name: '',
        email: '',
        phone: '',
        department_id: 1,
        semester: 6,
        section: 'A',
        consent_status: true,
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create student');
    }
  };

  const handleOpenEnrollFace = (st: Student) => {
    setActiveStudent(st);
    setFaceFile(null);
    setFacePreview(null);
    setEnrollMsg(null);
    setIsEnrollFaceOpen(true);
  };

  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFaceFile(f);
      setFacePreview(URL.createObjectURL(f));
    }
  };

  const handleUploadFace = async () => {
    if (!activeStudent || !faceFile) return;
    setEnrollLoading(true);
    setEnrollMsg(null);
    try {
      const res = await studentsApi.enrollFace(activeStudent.id, faceFile);
      setEnrollMsg({
        type: 'success',
        text: `Face Biometrics Enrolled! Quality Score: ${(res.quality_score * 100).toFixed(1)}%`,
      });
      loadData();
      setTimeout(() => {
        setIsEnrollFaceOpen(false);
      }, 1500);
    } catch (err: any) {
      setEnrollMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Face enrollment failed. Ensure a clear frontal photo.',
      });
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleViewProfile = async (st: Student) => {
    setActiveStudent(st);
    try {
      const det = await studentsApi.getDetails(st.id);
      setStudentDetails(det);
      setIsProfileOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Student Roster & Face Biometrics" breadcrumbs={['Roster', 'Students']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              BIOMETRIC ENROLLMENT DATABASE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Student Directory
            </h1>
          </div>

          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Student</span>
          </button>
        </div>

        {/* Filters & Search Bar */}
        <div className="p-4 bg-synapse-surface border border-synapse-border flex flex-wrap items-center gap-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px] relative">
            <input
              type="text"
              placeholder="Search by student name or USN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-synapse-elevated border border-synapse-border pl-10 pr-4 py-2 text-xs text-white placeholder-synapse-muted font-mono focus:border-synapse-pink focus:outline-none"
            />
            <Search className="w-4 h-4 text-synapse-muted absolute left-3.5 top-2.5" />
          </form>

          <div className="flex items-center gap-3">
            <select
              value={selectedDept || ''}
              onChange={(e) => setSelectedDept(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedSem || ''}
              onChange={(e) => setSelectedSem(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Table */}
        <div className="bg-synapse-surface border border-synapse-border relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-synapse-border text-synapse-secondary font-mono uppercase text-[11px] bg-synapse-deep">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">USN / ID</th>
                  <th className="py-3 px-4">Dept / Sem</th>
                  <th className="py-3 px-4 text-center">Biometrics</th>
                  <th className="py-3 px-4 text-center">Attendance Rate</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-synapse-border/40 font-mono">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-synapse-muted">
                      No student records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr
                      key={st.id}
                      className="hover:bg-synapse-elevated/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={st.photo_url || '/placeholder_student.jpg'}
                            alt={st.full_name}
                            onError={(e: any) => {
                              e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" fill="%231C1C1C"/><circle cx="20" cy="16" r="8" fill="%2371717A"/><path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="%2371717A"/></svg>';
                            }}
                            className="w-9 h-9 object-cover border border-synapse-border rounded-none"
                          />
                          <div>
                            <p className="font-sans font-bold text-white text-xs">{st.full_name}</p>
                            <p className="text-[10px] text-synapse-muted">{st.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-synapse-pink">{st.usn}</td>
                      <td className="py-3 px-4 text-zinc-300">
                        {st.department_code || 'AIML'} • Sem {st.semester} ({st.section})
                      </td>

                      <td className="py-3 px-4 text-center">
                        {st.has_biometric ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 128-D ENROLLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-synapse-yellow font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> PENDING
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-bold ${
                            (st.attendance_percentage ?? 100) < 75
                              ? 'text-rose-400'
                              : 'text-white'
                          }`}
                        >
                          {st.attendance_percentage ?? 100}%
                        </span>
                        <span className="text-synapse-muted text-[10px] ml-1">
                          ({st.attended_lectures ?? 0}/{st.total_lectures ?? 0})
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEnrollFace(st)}
                            title="Enroll / Update Face Biometrics"
                            className="px-2.5 py-1 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-[11px] text-synapse-yellow hover:border-synapse-yellow transition-colors flex items-center gap-1"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Biometrics</span>
                          </button>

                          <button
                            onClick={() => handleViewProfile(st)}
                            title="View Student Profile"
                            className="px-2.5 py-1 bg-synapse-pink/10 hover:bg-synapse-pink hover:text-white border border-synapse-pink/30 text-synapse-pink text-[11px] transition-colors"
                          >
                            Profile
                          </button>
                        </div>
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

      {/* Modal: Register Student */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register Enrolled Student"
        subtitle="Add student details into institutional academic database"
      >
        <form onSubmit={handleRegisterStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                University Seat Number (USN) *
              </label>
              <input
                type="text"
                required
                value={newStudent.usn}
                onChange={(e) => setNewStudent({ ...newStudent, usn: e.target.value })}
                placeholder="1RV21AI021"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newStudent.full_name}
                onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                placeholder="Student Full Name"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                placeholder="student@synapse.edu"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={newStudent.phone}
                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                placeholder="+91 99800 12345"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Department
              </label>
              <select
                value={newStudent.department_id}
                onChange={(e) => setNewStudent({ ...newStudent, department_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Semester
              </label>
              <select
                value={newStudent.semester}
                onChange={(e) => setNewStudent({ ...newStudent, semester: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Sem {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-synapse-secondary mb-1">
                Section
              </label>
              <input
                type="text"
                value={newStudent.section}
                onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-xs text-white font-mono focus:border-synapse-pink focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-synapse-elevated border border-synapse-border/80 text-[11px] font-mono text-synapse-secondary flex items-center gap-2">
            <Shield className="w-4 h-4 text-synapse-pink shrink-0" />
            <span>Biometric consent acknowledged for AI attendance matching.</span>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 border border-synapse-border text-xs font-mono uppercase text-synapse-secondary hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-synapse-softpink"
            >
              Register Student
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Enroll Face Biometrics */}
      <Modal
        isOpen={isEnrollFaceOpen}
        onClose={() => setIsEnrollFaceOpen(false)}
        title="Biometric Face Enrollment"
        subtitle={`Generate 128-d face embedding for ${activeStudent?.full_name} (${activeStudent?.usn})`}
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-synapse-border bg-synapse-elevated">
            {facePreview ? (
              <div className="relative">
                <img
                  src={facePreview}
                  alt="Face preview"
                  className="w-48 h-48 object-cover border-2 border-synapse-pink"
                />
                <span className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[10px] font-mono text-synapse-pink font-bold">
                  READY FOR CV ANALYSIS
                </span>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-10 h-10 text-synapse-pink mx-auto mb-2 animate-bounce" />
                <p className="text-xs font-mono text-white uppercase font-bold">
                  Upload Student Portrait Photograph
                </p>
                <p className="text-[11px] text-synapse-secondary mt-1">
                  Supported formats: JPG, PNG. High frontal lighting recommended.
                </p>
              </div>
            )}

            <input
              type="file"
              accept="image/png, image/jpeg"
              onChange={handleFaceFileChange}
              className="mt-4 text-xs font-mono text-synapse-secondary file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-mono file:bg-synapse-pink file:text-white hover:file:bg-synapse-softpink cursor-pointer"
            />
          </div>

          {enrollMsg && (
            <div
              className={`p-3 text-xs font-mono border ${
                enrollMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              }`}
            >
              {enrollMsg.text}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-synapse-border pt-4">
            <button
              onClick={() => setIsEnrollFaceOpen(false)}
              className="px-4 py-2 border border-synapse-border text-xs font-mono text-synapse-secondary hover:text-white"
            >
              Close
            </button>
            <button
              onClick={handleUploadFace}
              disabled={!faceFile || enrollLoading}
              className="px-6 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-synapse-softpink disabled:opacity-50"
            >
              {enrollLoading ? 'Processing Biometrics...' : 'Extract & Store Embedding'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Student Detailed Profile */}
      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="Student Intelligence Dossier"
        subtitle={activeStudent?.usn || ''}
        maxWidth="xl"
      >
        {studentDetails && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-start gap-6 p-4 bg-synapse-elevated border border-synapse-border">
              <img
                src={studentDetails.student.photo_url || '/placeholder_student.jpg'}
                alt={studentDetails.student.full_name}
                onError={(e: any) => {
                  e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 40 40"><rect width="40" height="40" fill="%231C1C1C"/><circle cx="20" cy="16" r="8" fill="%2371717A"/></svg>';
                }}
                className="w-24 h-24 object-cover border-2 border-synapse-pink"
              />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold font-display text-white">
                    {studentDetails.student.full_name}
                  </h3>
                  <Badge
                    label={studentDetails.stats.is_shortage ? 'SHORTAGE ALERT' : 'ATTENDANCE SAFE'}
                    variant={studentDetails.stats.is_shortage ? 'red' : 'green'}
                    size="sm"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono text-synapse-secondary">
                  <div>Department: <strong className="text-white">{studentDetails.student.department_code}</strong></div>
                  <div>Semester: <strong className="text-white">{studentDetails.student.semester} ({studentDetails.student.section})</strong></div>
                  <div>Biometrics: <strong className="text-emerald-400">128-D Active</strong></div>
                  <div>Email: <strong className="text-white">{studentDetails.student.email}</strong></div>
                  <div>Phone: <strong className="text-white">{studentDetails.student.phone}</strong></div>
                </div>
              </div>
            </div>

            {/* Subject Attendance Breakdown */}
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-synapse-pink font-semibold mb-3">
                Subject-Wise Attendance Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {studentDetails.subject_breakdown.map((sb: any) => (
                  <div key={sb.subject_id} className="p-3 bg-synapse-elevated border border-synapse-border">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-white">{sb.subject_code}</span>
                      <span className={sb.is_shortage ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {sb.attendance_percentage}%
                      </span>
                    </div>
                    <p className="text-[11px] text-synapse-secondary mt-0.5 truncate">{sb.subject_name}</p>
                    <div className="w-full bg-zinc-800 h-1.5 mt-2">
                      <div
                        className={`h-full ${sb.is_shortage ? 'bg-rose-500' : 'bg-emerald-400'}`}
                        style={{ width: `${sb.attendance_percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

