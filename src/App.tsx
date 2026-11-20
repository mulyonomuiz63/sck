import React, { useEffect, useState } from 'react';
import { AdminPortalView } from './components/admin/AdminPortalView';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginGate } from './components/LoginGate';
import { DashboardView } from './components/modules/DashboardView';
import { EBupotView } from './components/modules/EBupotView';
import { EFakturView } from './components/modules/EFakturView';
import { ExamCenterView } from './components/modules/ExamCenterView';
import { PembayaranView } from './components/modules/PembayaranView';
import { PortalSayaView } from './components/modules/PortalSayaView';
import { SptModuleView } from './components/modules/SptModuleView';
import { PortalLayout } from './components/PortalLayout';
import { TteModal } from './components/TteModal';
import { SimulatorProvider, useSimulator } from './context/SimulatorContext';

const SimulatorShell: React.FC = () => {
  const { isLoggedIn, activeNav } = useSimulator();
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() =>
    window.location.pathname.startsWith('/admin')
  );

  useEffect(() => {
    const onPopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const openAdmin = () => {
    if (!window.location.pathname.startsWith('/admin')) {
      window.history.pushState({}, '', '/admin');
    }
    setIsAdminRoute(true);
  };

  const exitAdmin = () => {
    window.history.pushState({}, '', '/');
    setIsAdminRoute(false);
  };

  if (isAdminRoute) {
    return <AdminPortalView onExitAdmin={exitAdmin} />;
  }

  if (!isLoggedIn) {
    return <LoginGate onOpenAdmin={openAdmin} />;
  }

  return (
    <>
      <PortalLayout>
        {activeNav === 'dashboard' && <DashboardView />}
        {activeNav === 'ujian' && <ExamCenterView />}
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
