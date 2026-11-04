import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${widthClasses} bg-synapse-surface border border-synapse-border shadow-2xl p-6 sm:p-8 z-10 transition-all`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-synapse-border">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-synapse-pink">
              SYNAPSE DIALOG
            </span>
            <h3 className="text-xl font-bold font-display tracking-tight text-white mt-1">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-synapse-secondary mt-1">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-synapse-secondary hover:text-synapse-pink hover:bg-synapse-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5">{children}</div>

        {/* Cyberpunk corner accents */}
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-synapse-pink" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-synapse-pink" />
      </div>
    </div>
  );
};

