import React from 'react';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginGate } from './components/LoginGate';
import { DashboardView } from './components/modules/DashboardView';
import { EBupotView } from './components/modules/EBupotView';
import { EFakturView } from './components/modules/EFakturView';
import { PembayaranView } from './components/modules/PembayaranView';
import { PortalSayaView } from './components/modules/PortalSayaView';
import { SptModuleView } from './components/modules/SptModuleView';
import { PortalLayout } from './components/PortalLayout';
import { TteModal } from './components/TteModal';
import { SimulatorProvider, useSimulator } from './context/SimulatorContext';

const SimulatorShell: React.FC = () => {
  const { isLoggedIn, activeNav } = useSimulator();

  if (!isLoggedIn) {
    return <LoginGate />;
  }

  return (
    <>
      <PortalLayout>
        {activeNav === 'dashboard' && <DashboardView />}
        {activeNav === 'portal_saya' && <PortalSayaView />}
        {activeNav === 'efaktur' && <EFakturView />}
        {activeNav === 'ebupot' && <EBupotView />}
        {activeNav === 'spt' && <SptModuleView />}
        {activeNav === 'pembayaran' && <PembayaranView />}
      </PortalLayout>
      <TteModal />
      <DocumentPreviewModal />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SimulatorProvider>
        <SimulatorShell />
      </SimulatorProvider>
    </ErrorBoundary>
  );
}
