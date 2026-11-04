import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Calendar, Plus, Clock, MapPin, User, Sparkles } from 'lucide-react';
import { timetableApi, academicApi, facultyApi } from '../services/api';
import { TimetableEntry, Classroom, Subject, User as FacultyUser } from '../services/types';

export const TimetableManagement: React.FC = () => {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [activeLecture, setActiveLecture] = useState<any>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [faculty, setFaculty] = useState<FacultyUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    day_of_week: 0,
    start_time: '09:00:00',
    end_time: '10:00:00',
    subject_id: 1,
    faculty_id: 2,
    classroom_id: 1,
    semester: 6,
    section: 'A',
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tt, subj, cr, fac, active] = await Promise.all([
        timetableApi.getAll(),
        academicApi.getSubjects(),
        academicApi.getClassrooms(),
        facultyApi.getAll(),
        timetableApi.getActiveLecture(),
      ]);
      setTimetable(tt);
      setSubjects(subj);
      setClassrooms(cr);
      setFaculty(fac);
      setActiveLecture(active);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await timetableApi.create(form);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create timetable slot');
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="Academic Timetable & Lecture Scheduling" breadcrumbs={['Curriculum', 'Timetable']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              AUTOMATIC SUBJECT MAPPING ENGINE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Lecture Timetable Grid
            </h1>
            <p className="text-xs text-synapse-secondary mt-1">
              The AI CCTV ingestion pipeline automatically synchronizes with active timetable slots to tag the correct subject, classroom, and faculty.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lecture Slot</span>
          </button>
        </div>

        {/* Active Lecture Auto-Mapping Card */}
        {activeLecture?.has_active_lecture && (
          <div className="p-4 bg-synapse-surface border border-synapse-yellow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-synapse-yellow/10 border border-synapse-yellow text-synapse-yellow">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-yellow font-bold">
                  AUTO-MAPPED ACTIVE LECTURE
                </span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {activeLecture.subject_code} — {activeLecture.subject_name}
                </p>
                <p className="text-xs font-mono text-synapse-secondary mt-0.5">
                  Hall: {activeLecture.room_number} | Instructor: {activeLecture.faculty_name} | {activeLecture.start_time} - {activeLecture.end_time}
                </p>
              </div>
            </div>
            <Badge label="TIME SLOT SYNCHRONIZED" variant="yellow" size="sm" pulse />
          </div>
        )}

        {/* Timetable Weekly Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {days.map((dayName, dayIdx) => {
            const dayEntries = timetable.filter((t) => t.day_of_week === dayIdx);

            return (
              <div key={dayIdx} className="bg-synapse-surface border border-synapse-border p-5">
                <div className="flex items-center justify-between pb-3 border-b border-synapse-border mb-4">
                  <span className="font-display font-bold uppercase tracking-wider text-white text-sm">
                    {dayName}
                  </span>
                  <span className="font-mono text-xs text-synapse-pink">
                    {dayEntries.length} Slots
                  </span>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  {dayEntries.length === 0 ? (
                    <p className="text-synapse-muted text-center py-6">No scheduled classes</p>
                  ) : (
                    dayEntries.map((slot) => (
                      <div
                        key={slot.id}
                        className="p-3 bg-synapse-elevated border border-synapse-border hover:border-synapse-pink/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{slot.subject_code}</span>
                          <span className="text-synapse-yellow text-[11px]">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <p className="text-[11px] text-synapse-secondary font-sans mt-0.5 truncate">
                          {slot.subject_name}
                        </p>
                        <div className="mt-2 pt-2 border-t border-synapse-border/40 flex justify-between text-[10px] text-synapse-muted">
                          <span>{slot.room_number}</span>
                          <span>{slot.faculty_name?.split(' ')[1] || 'Faculty'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Configure Lecture Timetable Slot">
        <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Day of Week</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              >
                {days.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Subject Course</label>
              <select
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Start Time (HH:MM)</label>
              <input
                type="text"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">End Time (HH:MM)</label>
              <input
                type="text"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Assigned Classroom</label>
              <select
                value={form.classroom_id}
                onChange={(e) => setForm({ ...form, classroom_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.room_number} ({c.building})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Assigned Faculty</label>
              <select
                value={form.faculty_id}
                onChange={(e) => setForm({ ...form, faculty_id: Number(e.target.value) })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              >
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="submit" className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold">
              Add Slot
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

