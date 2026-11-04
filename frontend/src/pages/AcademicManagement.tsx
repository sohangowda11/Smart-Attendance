import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { BookOpen, School, Plus, Layers, Video } from 'lucide-react';
import { academicApi } from '../services/api';
import { Department, Classroom, Subject } from '../services/types';

export const AcademicManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DEPTS' | 'CLASSROOMS' | 'SUBJECTS'>('DEPTS');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isSubjModalOpen, setIsSubjModalOpen] = useState(false);

  // Forms
  const [deptForm, setDeptForm] = useState({ code: '', name: '', description: '' });
  const [classForm, setClassForm] = useState({ room_number: '', building: 'Turing Block', capacity: 60, has_cctv: true });
  const [subjForm, setSubjForm] = useState({ code: '', name: '', department_id: 1, semester: 6, credits: 4 });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [d, c, s] = await Promise.all([
        academicApi.getDepartments(),
        academicApi.getClassrooms(),
        academicApi.getSubjects(),
      ]);
      setDepartments(d);
      setClassrooms(c);
      setSubjects(s);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicApi.createDepartment(deptForm);
      setIsDeptModalOpen(false);
      setDeptForm({ code: '', name: '', description: '' });
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create department');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicApi.createClassroom(classForm);
      setIsClassModalOpen(false);
      setClassForm({ room_number: '', building: 'Turing Block', capacity: 60, has_cctv: true });
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create classroom');
    }
  };

  const handleCreateSubj = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await academicApi.createSubject(subjForm);
      setIsSubjModalOpen(false);
      setSubjForm({ code: '', name: '', department_id: 1, semester: 6, credits: 4 });
      loadAll();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create subject');
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Academic Infrastructure & Curricula" breadcrumbs={['Academic', 'Structure']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              INSTITUTIONAL HIERARCHY
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Departments, Halls & Courses
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'DEPTS' && (
              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="px-4 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold hover:bg-synapse-softpink flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Department</span>
              </button>
            )}
            {activeTab === 'CLASSROOMS' && (
              <button
                onClick={() => setIsClassModalOpen(true)}
                className="px-4 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold hover:bg-synapse-softpink flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Classroom</span>
              </button>
            )}
            {activeTab === 'SUBJECTS' && (
              <button
                onClick={() => setIsSubjModalOpen(true)}
                className="px-4 py-2 bg-synapse-pink text-white font-mono text-xs uppercase font-bold hover:bg-synapse-softpink flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subject Course</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-synapse-border">
          {[
            { id: 'DEPTS', label: `Departments (${departments.length})` },
            { id: 'CLASSROOMS', label: `Classrooms & Halls (${classrooms.length})` },
            { id: 'SUBJECTS', label: `Subjects & Courses (${subjects.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-mono text-xs uppercase font-bold tracking-wider transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-synapse-pink text-synapse-pink bg-synapse-surface'
                  : 'border-transparent text-synapse-secondary hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Departments */}
        {activeTab === 'DEPTS' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {departments.map((d) => (
              <div key={d.id} className="p-6 bg-synapse-surface border border-synapse-border">
                <span className="font-mono text-xs text-synapse-pink font-bold">{d.code}</span>
                <h3 className="text-lg font-bold font-display uppercase tracking-tight text-white mt-1">
                  {d.name}
                </h3>
                <p className="text-xs text-synapse-secondary mt-2 font-sans">{d.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Classrooms */}
        {activeTab === 'CLASSROOMS' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {classrooms.map((c) => (
              <div key={c.id} className="p-6 bg-synapse-surface border border-synapse-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-synapse-yellow">
                    {c.building} • Floor {c.floor}
                  </span>
                  <Badge label={c.has_cctv ? 'CCTV EQUIPPED' : 'NO CCTV'} variant="green" size="sm" />
                </div>
                <h3 className="text-2xl font-bold font-display uppercase text-white">
                  {c.room_number}
                </h3>
                <p className="text-xs font-mono text-synapse-secondary mt-2">
                  Capacity: {c.capacity} Students
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Subjects */}
        {activeTab === 'SUBJECTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((s) => (
              <div key={s.id} className="p-6 bg-synapse-surface border border-synapse-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-synapse-pink">{s.code}</span>
                  <span className="text-[11px] font-mono text-synapse-muted">Credits: {s.credits}</span>
                </div>
                <h3 className="text-lg font-bold font-display uppercase text-white">{s.name}</h3>
                <div className="mt-3 text-xs font-mono text-synapse-secondary space-y-1">
                  <div>Semester: {s.semester}</div>
                  <div>Faculty: <strong className="text-white">{s.faculty_name || 'Dr. Rajesh Sharma'}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Add Department */}
      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title="Add Department">
        <form onSubmit={handleCreateDept} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Code *</label>
            <input
              type="text"
              required
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
              placeholder="e.g. AI-ML"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              placeholder="Artificial Intelligence & Machine Learning"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="submit" className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold">
              Save Department
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Classroom */}
      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="Register Classroom">
        <form onSubmit={handleCreateClass} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Room Number *</label>
            <input
              type="text"
              required
              value={classForm.room_number}
              onChange={(e) => setClassForm({ ...classForm, room_number: e.target.value })}
              placeholder="LH-103"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Capacity</label>
            <input
              type="number"
              value={classForm.capacity}
              onChange={(e) => setClassForm({ ...classForm, capacity: Number(e.target.value) })}
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="submit" className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold">
              Register Classroom
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Subject */}
      <Modal isOpen={isSubjModalOpen} onClose={() => setIsSubjModalOpen(false)} title="Create Subject Course">
        <form onSubmit={handleCreateSubj} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Subject Code *</label>
              <input
                type="text"
                required
                value={subjForm.code}
                onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value })}
                placeholder="CS605"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Course Title *</label>
              <input
                type="text"
                required
                value={subjForm.name}
                onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })}
                placeholder="Edge AI Systems"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="submit" className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold">
              Create Course
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

