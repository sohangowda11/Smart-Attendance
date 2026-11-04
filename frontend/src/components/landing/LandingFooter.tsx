import React from 'react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="py-16 px-6 sm:px-12 lg:px-20 bg-synapse-deep border-t border-synapse-border">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-synapse-surface border border-synapse-pink flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-synapse-yellow" />
            </div>
            <span className="font-display font-black text-lg tracking-widest text-white">
              SYNAPSE
            </span>
          </div>
          <p className="mt-2 text-xs text-synapse-secondary font-mono">
            Intelligence. Accuracy. Attendance.
          </p>
          <p className="text-[11px] text-synapse-muted mt-1">
            Production AI Smart Attendance & Classroom Intelligence Architecture.
          </p>
        </div>

        <div className="flex items-center gap-8 text-xs font-mono text-synapse-secondary">
          <span>Dlib 128-D Biometrics</span>
          <span>OpenCV RTSP Demuxer</span>
          <span>FastAPI Engine</span>
          <span>JWT RBAC Protected</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-synapse-border/40 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-synapse-muted gap-4">
        <span>© 2026 SYNAPSE PLATFORM. ALL RIGHTS RESERVED.</span>
        <span>ACADEMIC ENTERPRISE DEPLOYMENT</span>
      </div>
    </footer>
  );
};

