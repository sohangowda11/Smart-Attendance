import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Camera as CameraIcon, Plus, Radio, Activity, Eye, Shield } from 'lucide-react';
import { camerasApi, academicApi } from '../services/api';
import { Camera, Classroom } from '../services/types';

export const CameraManagement: React.FC = () => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    camera_name: '',
    camera_code: '',
    classroom_id: 1,
    location_desc: 'Front podium wide angle',
    stream_url: 'rtsp://admin:pass@192.168.1.50:554/live',
    stream_type: 'RTSP' as 'RTSP' | 'WEBCAM' | 'SIMULATED',
    resolution: '1080p',
    fps: 30,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [c, cr] = await Promise.all([
        camerasApi.getAll(),
        academicApi.getClassrooms(),
      ]);
      setCameras(c);
      setClassrooms(cr);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await camerasApi.register(form);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to register camera');
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="CCTV Camera Fleet & Stream Configuration" breadcrumbs={['Hardware', 'Cameras']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-synapse-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              SURVEILLANCE INFRASTRUCTURE
            </span>
            <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
              Camera Fleet Registry
            </h1>
            <p className="text-xs text-synapse-secondary mt-1">
              Configure RTSP endpoints, ONVIF credentials, frame sampling rates, and multi-camera classroom coverage.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs uppercase font-bold tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register CCTV Camera</span>
          </button>
        </div>

        {/* Camera Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cameras.map((c) => (
            <div key={c.id} className="p-6 bg-synapse-surface border border-synapse-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-synapse-border mb-4">
                  <span className="font-mono text-xs text-synapse-yellow font-bold">
                    {c.camera_code}
                  </span>
                  <Badge label={c.status} variant={c.status === 'ONLINE' ? 'green' : 'red'} size="sm" pulse={c.status === 'ONLINE'} />
                </div>

                <h3 className="text-lg font-bold font-display uppercase text-white">
                  {c.camera_name}
                </h3>
                <p className="text-xs font-mono text-synapse-secondary mt-1">
                  Location: {c.classroom_name || 'LH-101'} — {c.location_desc}
                </p>

                <div className="mt-4 p-3 bg-synapse-elevated border border-synapse-border font-mono text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-synapse-secondary">Stream Type:</span>
                    <span className="text-white font-bold">{c.stream_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-synapse-secondary">Resolution:</span>
                    <span className="text-synapse-pink font-bold">{c.resolution} @ {c.fps}fps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-synapse-secondary">Health Score:</span>
                    <span className="text-emerald-400 font-bold">{c.health_score}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-synapse-border flex items-center justify-between text-xs font-mono">
                <span className="text-synapse-muted truncate max-w-[180px]">{c.stream_url}</span>
                <span className="text-synapse-yellow font-bold">ACTIVE</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register CCTV Surveillance Camera">
        <form onSubmit={handleRegister} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Camera Name *</label>
              <input
                type="text"
                required
                value={form.camera_name}
                onChange={(e) => setForm({ ...form, camera_name: e.target.value })}
                placeholder="LH-101 Front Wide"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Camera Code *</label>
              <input
                type="text"
                required
                value={form.camera_code}
                onChange={(e) => setForm({ ...form, camera_code: e.target.value })}
                placeholder="CAM-LH101-02"
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-synapse-secondary uppercase mb-1">Stream Address (RTSP URL / USB) *</label>
            <input
              type="text"
              required
              value={form.stream_url}
              onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
              placeholder="rtsp://user:pass@192.168.1.100:554/live"
              className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-synapse-secondary uppercase mb-1">Classroom</label>
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
              <label className="block text-synapse-secondary uppercase mb-1">Stream Type</label>
              <select
                value={form.stream_type}
                onChange={(e) => setForm({ ...form, stream_type: e.target.value as any })}
                className="w-full bg-synapse-elevated border border-synapse-border px-3 py-2 text-white"
              >
                <option value="RTSP">RTSP Camera</option>
                <option value="WEBCAM">USB / Integrated Webcam</option>
                <option value="SIMULATED">Simulated Surveillance File</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="submit" className="px-6 py-2 bg-synapse-pink text-white uppercase font-bold">
              Register Camera
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

