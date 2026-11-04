import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Badge } from '../components/common/Badge';
import { Settings, Shield, Sliders, CheckCircle2, Lock } from 'lucide-react';
import { settingsApi } from '../services/api';
import { SystemSetting } from '../services/types';

export const SettingsPage: React.FC = () => {
  const [settingsList, setSettingsList] = useState<SystemSetting[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.getAll();
      setSettingsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await settingsApi.update(key, value);
      setSavedSuccess(`Setting '${key}' updated successfully`);
      loadSettings();
      setTimeout(() => setSavedSuccess(null), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-synapse-jet flex flex-col">
      <Header pageTitle="System Settings & Policy Parameters" breadcrumbs={['System', 'Configuration']} />

      <main className="flex-1 p-6 sm:p-8 space-y-6 max-w-4xl w-full mx-auto">
        <div className="pb-6 border-b border-synapse-border">
          <span className="text-xs font-mono uppercase tracking-widest text-synapse-pink font-semibold">
            ENGINE & INSTITUTIONAL POLICIES
          </span>
          <h1 className="text-3xl font-black font-display tracking-tight text-white uppercase mt-1">
            Configuration & Rules Engine
          </h1>
          <p className="text-xs text-synapse-secondary mt-1">
            Calibrate face recognition distance tolerances, late arrival grace windows, disbarment shortage thresholds, and GDPR/biometric privacy policies.
          </p>
        </div>

        {savedSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedSuccess}</span>
          </div>
        )}

        <div className="space-y-4">
          {settingsList.map((st) => (
            <div key={st.key} className="p-5 bg-synapse-surface border border-synapse-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
              <div className="max-w-md">
                <span className="text-[10px] text-synapse-pink font-bold uppercase">{st.category}</span>
                <h4 className="text-sm font-bold text-white uppercase mt-0.5">{st.key}</h4>
                <p className="text-xs text-synapse-secondary font-sans mt-1 leading-relaxed">
                  {st.description}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  defaultValue={st.value}
                  onBlur={(e) => {
                    if (e.target.value !== st.value) {
                      handleUpdate(st.key, e.target.value);
                    }
                  }}
                  className="w-28 bg-synapse-elevated border border-synapse-border px-3 py-2 text-white font-mono text-center focus:border-synapse-pink focus:outline-none"
                />
                <button
                  disabled={savingKey === st.key}
                  className="px-3 py-2 bg-synapse-elevated border border-synapse-border hover:border-synapse-pink text-synapse-secondary hover:text-white transition-colors"
                >
                  {savingKey === st.key ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

