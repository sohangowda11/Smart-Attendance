import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, User } from 'lucide-react';

interface LandingNavbarProps {
  onLoginClick: () => void;
  onDashboardClick: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onLoginClick, onDashboardClick }) => {
  const { isAuthenticated, user } = useAuth();

  return (
    <nav className="h-20 border-b border-synapse-border bg-synapse-jet/90 backdrop-blur-md sticky top-0 z-50 px-6 sm:px-12 lg:px-20 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8 rounded-sm bg-synapse-surface border border-synapse-pink flex items-center justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-synapse-yellow animate-pulse" />
          <div className="absolute inset-0 border border-synapse-pink/40 scale-125 pointer-events-none" />
        </div>
        <div>
          <span className="font-display font-black text-xl tracking-widest text-white">
            SYNAPSE
          </span>
          <p className="text-[9px] font-mono tracking-wider text-synapse-pink uppercase -mt-1 font-bold">
            Intelligence. Accuracy. Attendance.
          </p>
        </div>
      </div>

      {/* Nav Links */}
      <div className="hidden md:flex items-center gap-8 text-xs font-mono tracking-wider uppercase text-synapse-secondary">
        <a href="#platform" className="hover:text-synapse-pink transition-colors">
          Platform
        </a>
        <a href="#how-it-works" className="hover:text-synapse-pink transition-colors">
          How It Works
        </a>
        <a href="#technology" className="hover:text-synapse-pink transition-colors">
          Technology
        </a>
      </div>

      {/* Auth Action */}
      <div>
        {isAuthenticated ? (
          <button
            onClick={onDashboardClick}
            className="px-5 py-2.5 bg-synapse-pink text-white font-mono text-xs font-bold uppercase tracking-wider shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-2"
          >
            <User className="w-3.5 h-3.5" />
            <span>Open Dashboard ({user?.role})</span>
          </button>
        ) : (
          <button
            onClick={onLoginClick}
            className="px-6 py-2.5 bg-synapse-surface border border-synapse-border hover:border-synapse-pink text-white font-mono text-xs font-bold uppercase tracking-wider hover:text-synapse-pink transition-all flex items-center gap-2 group"
          >
            <span>Platform Login</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </nav>
  );
};

