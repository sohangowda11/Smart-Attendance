import React from 'react';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { CinematicHero } from '../components/landing/CinematicHero';
import { PlatformOverview } from '../components/landing/PlatformOverview';
import { HowItWorks } from '../components/landing/HowItWorks';
import { TechArchitecture } from '../components/landing/TechArchitecture';
import { LandingFooter } from '../components/landing/LandingFooter';

interface LandingPageProps {
  onLoginClick: () => void;
  onDashboardClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onDashboardClick }) => {
  return (
    <div className="min-h-screen bg-synapse-jet text-white selection:bg-synapse-pink selection:text-white">
      <LandingNavbar onLoginClick={onLoginClick} onDashboardClick={onDashboardClick} />
      <CinematicHero onExplore={() => {
        const el = document.getElementById('how-it-works');
        el?.scrollIntoView({ behavior: 'smooth' });
      }} onLogin={onLoginClick} />
      <PlatformOverview />
      <HowItWorks />
      <TechArchitecture />
      <LandingFooter />
    </div>
  );
};

