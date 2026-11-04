import React from 'react';
import { Cpu, Terminal, Shield, Zap, RefreshCw, Lock } from 'lucide-react';

export const TechArchitecture: React.FC = () => {
  const specs = [
    {
      title: 'Biometric Model',
      tech: 'Dlib / ArcFace 128-D Embedding Space',
      detail: 'Normalized Euclidean distance calibration with strict 0.52 tolerance threshold.',
      icon: Cpu,
    },
    {
      title: 'Tracking Algorithm',
      tech: 'Centroid & Intersection-over-Union (IoU)',
      detail: 'Greedy Hungarian association maintaining consistent track IDs across 15 lost frame buffers.',
      icon: RefreshCw,
    },
    {
      title: 'Video Engine',
      tech: 'OpenCV Real-Time Stream Demuxer',
      detail: 'Hardware-accelerated frame ingestion supporting MP4, RTSP, and live USB/IP capture.',
      icon: Terminal,
    },
    {
      title: 'Database & Transactions',
      tech: 'PostgreSQL Relational Schema with Unique Constraints',
      detail: 'Enforces single-record-per-lecture integrity at the database engine level.',
      icon: Lock,
    },
  ];

  return (
    <section id="technology" className="py-24 px-6 sm:px-12 lg:px-20 bg-synapse-jet border-t border-synapse-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
              TECHNICAL SPECIFICATIONS
            </span>
            <h2 className="text-3xl sm:text-5xl font-black font-display tracking-tight text-white uppercase mt-2">
              UNDER THE HOOD.
            </h2>
          </div>
          <p className="mt-4 md:mt-0 text-sm font-sans text-synapse-secondary max-w-md">
            Production-grade stack engineered for high throughput, minimal false acceptance, and enterprise scale.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {specs.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="p-8 bg-synapse-surface border border-synapse-border relative hover:border-synapse-yellow/50 transition-colors"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-synapse-elevated border border-synapse-border text-synapse-yellow">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-synapse-pink">
                      {s.title}
                    </span>
                    <h4 className="text-lg font-bold font-mono text-white mt-0.5">
                      {s.tech}
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-synapse-secondary leading-relaxed font-sans">
                  {s.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

