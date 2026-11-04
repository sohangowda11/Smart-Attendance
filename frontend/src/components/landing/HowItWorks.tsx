import React from 'react';
import { ArrowRight, Video, Filter, ScanFace, Database, CheckCheck, FileText } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'CCTV Input',
      desc: 'Ingests high-resolution RTSP streams or uploaded surveillance video files (.mp4, .avi, .mkv).',
      icon: Video,
      color: 'pink',
    },
    {
      num: '02',
      title: 'Frame Sampling',
      desc: 'Configurable frame-rate sampling extracts key frames for real-time OpenCV processing.',
      icon: Filter,
      color: 'yellow',
    },
    {
      num: '03',
      title: 'Face Detection',
      desc: 'Localizes student facial bounds with Laplacian variance blur & quality filtering.',
      icon: ScanFace,
      color: 'pink',
    },
    {
      num: '04',
      title: 'Biometric Matching',
      desc: 'Extracts 128-d vectors and performs Euclidean distance comparison against enrolled student embeddings.',
      icon: Database,
      color: 'yellow',
    },
    {
      num: '05',
      title: 'Attendance Rules',
      desc: 'Validates minimum observation count and duration thresholds to prevent accidental flashes.',
      icon: CheckCheck,
      color: 'pink',
    },
    {
      num: '06',
      title: 'Verified Record',
      desc: 'Persists attendance record, updates classroom occupancy, and alerts faculty of shortages.',
      icon: FileText,
      color: 'yellow',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 sm:px-12 lg:px-20 bg-synapse-deep border-t border-synapse-border">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-xs font-mono uppercase tracking-widest text-synapse-yellow font-semibold">
            THE PIPELINE
          </span>
          <h2 className="text-3xl sm:text-5xl font-black font-display tracking-tight text-white uppercase mt-2">
            FROM CCTV PIXELS TO VERIFIED RECORDS.
          </h2>
          <p className="mt-4 text-sm font-sans text-synapse-secondary">
            A resilient multi-stage intelligence architecture designed for rigorous classroom conditions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isPink = step.color === 'pink';

            return (
              <div
                key={i}
                className="bg-synapse-surface border border-synapse-border p-8 relative flex flex-col justify-between hover:border-synapse-pink/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-2xl font-bold text-synapse-pink">
                      {step.num}
                    </span>
                    <div className="p-2.5 bg-synapse-elevated border border-synapse-border">
                      <Icon className={`w-5 h-5 ${isPink ? 'text-synapse-pink' : 'text-synapse-yellow'}`} />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold font-display uppercase tracking-wide text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs text-synapse-secondary font-sans leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-synapse-border/40 flex items-center justify-between text-[11px] font-mono text-synapse-muted">
                  <span>STAGE {i + 1} OF 6</span>
                  <span className={isPink ? 'text-synapse-pink' : 'text-synapse-yellow'}>ACTIVE</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

