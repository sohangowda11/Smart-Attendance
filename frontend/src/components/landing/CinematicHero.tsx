import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Cpu, Eye, Sparkles, Activity } from 'lucide-react';

interface CinematicHeroProps {
  onExplore: () => void;
  onLogin: () => void;
}

export const CinematicHero: React.FC<CinematicHeroProps> = ({ onExplore, onLogin }) => {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center px-6 sm:px-12 lg:px-20 overflow-hidden bg-grid-pattern">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-synapse-pink/15 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-synapse-yellow/10 blur-[160px] pointer-events-none rounded-full" />

      {/* Hero Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 bg-synapse-surface border border-synapse-border text-xs font-mono text-synapse-secondary mb-6"
      >
        <span className="w-2 h-2 rounded-full bg-synapse-yellow animate-ping" />
        <span className="text-synapse-white uppercase tracking-wider font-semibold">
          SYNAPSE 2.0 REVOLUTION
        </span>
        <span className="text-synapse-pink font-bold">/// BIOMETRIC INTELLIGENCE</span>
      </motion.div>

      {/* Main Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="text-5xl sm:text-7xl lg:text-8xl font-black font-display tracking-tight text-white uppercase max-w-5xl leading-[1.05]"
      >
        ATTENDANCE,{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-synapse-pink via-synapse-softpink to-synapse-yellow">
          REIMAGINED.
        </span>
      </motion.h1>

      {/* Supporting Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-6 text-lg sm:text-xl text-synapse-secondary max-w-2xl font-sans font-light leading-relaxed"
      >
        Intelligent classroom monitoring powered by computer vision. Transform ordinary
        CCTV footage and live IP streams into automated, verified lecture attendance records with zero manual roll calls.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="mt-10 flex flex-wrap items-center gap-4"
      >
        <button
          onClick={onLogin}
          className="px-8 py-4 bg-synapse-pink text-white font-mono uppercase tracking-wider text-sm font-bold shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center gap-3 group"
        >
          <span>Access Platform</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={onExplore}
          className="px-8 py-4 bg-synapse-surface border border-synapse-border hover:border-synapse-yellow text-white font-mono uppercase tracking-wider text-sm font-semibold hover:text-synapse-yellow transition-all flex items-center gap-2"
        >
          <span>Explore Pipeline</span>
        </button>
      </motion.div>

      {/* Interactive CV HUD Live Preview Simulation */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.8 }}
        className="mt-16 w-full max-w-5xl bg-synapse-deep border border-synapse-border p-4 relative"
      >
        <div className="flex items-center justify-between pb-3 border-b border-synapse-border text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-synapse-yellow" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="ml-2 text-synapse-secondary">LIVE CCTV STREAM [LH-101 CAM-01]</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-synapse-secondary">
            <span>FPS: <strong className="text-white">29.8</strong></span>
            <span>TRACKED: <strong className="text-synapse-yellow">18</strong></span>
            <span>VERIFIED: <strong className="text-synapse-pink">17</strong></span>
          </div>
        </div>

        {/* Video Simulation Display */}
        <div className="relative h-64 sm:h-80 bg-zinc-950 flex items-center justify-center overflow-hidden border border-synapse-border/40 mt-3">
          {/* Grid lines */}
          <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

          {/* AI Tracking Visual Overlays */}
          <div className="absolute top-12 left-1/4 border-2 border-synapse-pink p-3 bg-synapse-pink/10 shadow-pink-glow">
            <span className="text-[10px] font-mono text-synapse-pink font-bold bg-black px-1.5 py-0.5">
              #1 AARAV SHARMA (96%)
            </span>
            <div className="w-20 h-24" />
          </div>

          <div className="absolute top-20 right-1/4 border-2 border-synapse-yellow p-3 bg-synapse-yellow/10 shadow-yellow-glow">
            <span className="text-[10px] font-mono text-synapse-yellow font-bold bg-black px-1.5 py-0.5">
              #2 ANANYA RAO (94%)
            </span>
            <div className="w-20 h-24" />
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 border border-dashed border-synapse-secondary/60 p-2 text-center bg-black/60">
            <p className="text-[11px] font-mono text-synapse-yellow">
              SYNAPSE COMPUTER VISION INGESTION ACTIVE
            </p>
            <p className="text-[10px] font-mono text-synapse-secondary">
              Euclidean Biometric Match: ArcFace 128-D Embeddings
            </p>
          </div>
        </div>

        {/* Accent corners */}
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-synapse-yellow" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-synapse-pink" />
      </motion.div>
    </section>
  );
};

