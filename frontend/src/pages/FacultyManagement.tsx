import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Users, Plus, Mail, Phone, BookOpen, ShieldCheck } from 'lucide-react';
import { facultyApi, academicApi } from '../services/api';
import { User, Department } from '../services/types';

export const FacultyManagement: React.FC = () => {
  const [faculty, setFaculty] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFaculty, setNewFaculty] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'FACULTY',
    department_id: 1,
    designation: 'Assistant Professor',
    phone: '',
  });

  useEffect(() => {
    loadFaculty();
  }, []);

  const loadFaculty = async () => {
    try {
      const [fData, dData] = await Promise.all([
        facultyApi.getAll(),
        academicApi.getDepartments(),
      ]);
      setFaculty(fData);
      setDepartments(dData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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

        {/* Faculty Grid */}
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
                  <Badge label={f.is_active ? 'ACTIVE' : 'INACTIVE'} variant="green" size="sm" />
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

              <div className="mt-6 pt-4 border-t border-synapse-border/40 text-[11px] font-mono text-synapse-muted flex items-center justify-between">
                <span>ROLE: {f.role}</span>
                <span className="text-emerald-400">AUTHORIZED</span>
              </div>
            </div>
          ))}
        </div>
      </main>

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

          <div className="flex justify-end gap-3 pt-3 border-t border-synapse-border">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-synapse-border text-synapse-secondary hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold tracking-wider hover:bg-synapse-softpink"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

