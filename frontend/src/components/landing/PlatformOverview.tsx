import React from 'react';
import { Eye, Shield, Cpu, Clock, BarChart3, Bell, CheckCircle } from 'lucide-react';

export const PlatformOverview: React.FC = () => {
  const capabilities = [
    {
      title: 'AI Face Recognition',
      desc: 'Deep 128-dimensional biometric embeddings matched against enrolled student records with calibrated confidence thresholds.',
      icon: Cpu,
      color: 'pink',
    },
    {
      title: 'Live CCTV Monitoring',
      desc: 'Seamless ingestion of RTSP, ONVIF, and webcam IP streams with real-time frame telemetry and multi-camera classroom support.',
      icon: Eye,
      color: 'yellow',
    },
    {
      title: 'Intelligent Tracking',
      desc: 'Centroid and IoU multi-object tracking assigning persistent track IDs across frames to eliminate duplicate counting and occlusions.',
      icon: Clock,
      color: 'white',
    },
    {
      title: 'Automated Attendance',
      desc: 'Rule-based attendance generator requiring minimum observation count and duration, with late arrival grace period enforcement.',
      icon: CheckCircle,
      color: 'pink',
    },
    {
      title: 'Classroom Occupancy',
      desc: 'Live occupancy calculations comparing tracked individuals against registered classroom strength with capacity alerts.',
      icon: BarChart3,
      color: 'yellow',
    },
    {
      title: 'Shortage Intelligence',
      desc: 'Configurable institutional threshold monitoring (<75%) alerting students, faculty, and administrators before semester disbarment.',
      icon: Bell,
      color: 'white',
    },
  ];

  return (
    <section id="platform" className="py-24 px-6 sm:px-12 lg:px-20 bg-synapse-jet border-t border-synapse-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              CORE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-black font-display tracking-tight text-white uppercase mt-2">
              ENGINEERED FOR PRECISION.
            </h2>
          </div>
          <p className="mt-4 md:mt-0 text-sm font-sans text-synapse-secondary max-w-md">
            Eliminating proxy attendance, manual roll-calls, and administrative overhead through computer vision.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            const borderAccent = {
              pink: 'hover:border-synapse-pink/60 hover:shadow-pink-glow',
              yellow: 'hover:border-synapse-yellow/60 hover:shadow-yellow-glow',
              white: 'hover:border-zinc-500',
            }[c.color as 'pink' | 'yellow' | 'white'];

            const iconColor = {
              pink: 'text-synapse-pink',
              yellow: 'text-synapse-yellow',
              white: 'text-white',
            }[c.color as 'pink' | 'yellow' | 'white'];

            return (
              <div
                key={i}
                className={`p-8 bg-synapse-surface border border-synapse-border transition-all duration-300 relative group ${borderAccent}`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className={`p-3 bg-synapse-elevated border border-synapse-border/80 ${iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono text-synapse-muted font-bold">
                    0{i + 1}
                  </span>
                </div>

                <h3 className="text-xl font-bold font-display text-white tracking-tight uppercase">
                  {c.title}
                </h3>
                <p className="mt-3 text-sm text-synapse-secondary leading-relaxed font-sans font-light">
                  {c.desc}
                </p>

                {/* Subtle corner marker */}
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-synapse-pink/40" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

