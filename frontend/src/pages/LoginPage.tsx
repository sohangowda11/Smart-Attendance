import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  onBackToHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onBackToHome }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: 'ADMIN' | 'FACULTY') => {
    if (role === 'ADMIN') {
      setEmail('admin@synapse.ai');
      setPassword('Admin@123');
    } else {
      setEmail('dr.sharma@synapse.ai');
      setPassword('Faculty@123');
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col justify-center items-center px-4 sm:px-6 relative bg-grid-pattern">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-synapse-pink/15 blur-[130px] pointer-events-none rounded-full" />

      {/* Brand Header */}
      <div
        onClick={onBackToHome}
        className="flex items-center gap-3 mb-8 cursor-pointer group"
      >
        <div className="relative w-9 h-9 rounded-sm bg-synapse-surface border border-synapse-pink flex items-center justify-center group-hover:shadow-pink-glow transition-all">
          <span className="w-2.5 h-2.5 rounded-full bg-synapse-yellow" />
          <div className="absolute inset-0 border border-synapse-pink/40 scale-125 pointer-events-none" />
        </div>
        <div>
          <span className="font-display font-black text-2xl tracking-widest text-white">
            SYNAPSE
          </span>
          <p className="text-[10px] font-mono tracking-wider text-synapse-pink uppercase -mt-1 font-bold">
            Portal Authentication
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-synapse-surface border border-synapse-border p-8 relative shadow-2xl">
        <div className="border-b border-synapse-border pb-4 mb-6">
          <span className="text-[10px] font-mono uppercase tracking-widest text-synapse-pink font-semibold">
            SECURE ACCESS
          </span>
          <h2 className="text-2xl font-bold font-display text-white tracking-tight uppercase mt-1">
            Sign In to Platform
          </h2>
          <p className="text-xs text-synapse-secondary mt-1">
            Access enterprise attendance management and computer vision streams.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-synapse-secondary mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@synapse.ai"
                className="w-full bg-synapse-elevated border border-synapse-border px-4 py-3 text-sm text-white placeholder-synapse-muted focus:border-synapse-pink focus:outline-none focus:ring-1 focus:ring-synapse-pink transition-colors font-mono"
              />
              <Mail className="w-4 h-4 text-synapse-muted absolute right-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-synapse-secondary mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-synapse-elevated border border-synapse-border px-4 py-3 text-sm text-white placeholder-synapse-muted focus:border-synapse-pink focus:outline-none focus:ring-1 focus:ring-synapse-pink transition-colors font-mono"
              />
              <Lock className="w-4 h-4 text-synapse-muted absolute right-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-synapse-pink text-white font-mono uppercase tracking-wider text-xs font-bold shadow-pink-glow hover:bg-synapse-softpink transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to SYNAPSE</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials Buttons */}
        <div className="mt-8 pt-6 border-t border-synapse-border/60">
          <p className="text-[11px] font-mono uppercase tracking-wider text-synapse-secondary text-center mb-3">
            Quick-Login Demo Credentials
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleQuickLogin('ADMIN')}
              className="px-3 py-2 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-left transition-colors group"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-synapse-pink">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Demo</span>
              </div>
              <p className="text-[10px] font-mono text-synapse-muted mt-0.5">
                admin@synapse.ai
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('FACULTY')}
              className="px-3 py-2 bg-synapse-elevated hover:bg-zinc-800 border border-synapse-border text-left transition-colors group"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-synapse-yellow">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Faculty Demo</span>
              </div>
              <p className="text-[10px] font-mono text-synapse-muted mt-0.5">
                dr.sharma@synapse.ai
              </p>
            </button>
          </div>
        </div>

        {/* Corner Accents */}
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-synapse-pink" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-synapse-yellow" />
      </div>

      <button
        onClick={onBackToHome}
        className="mt-6 text-xs font-mono text-synapse-secondary hover:text-white transition-colors"
      >
        ← Return to Landing Page
      </button>
    </div>
  );
};

