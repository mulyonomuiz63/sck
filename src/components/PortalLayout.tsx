import React, { useState } from 'react';
import {
  ArrowRight,
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Receipt,
  RotateCcw,
  User,
  X,
} from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { formatNpwp16, formatRupiah } from '../lib/taxCalculations';
import { NavSection } from '../types/tax';

const NAV_ITEMS: { id: NavSection; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ujian', label: 'Ujian Praktik', shortLabel: 'Ujian Praktik', icon: ClipboardCheck },
  { id: 'dashboard', label: 'Beranda', shortLabel: 'Beranda', icon: LayoutDashboard },
  { id: 'portal_saya', label: 'Portal Saya', shortLabel: 'Portal Saya', icon: User },
  { id: 'efaktur', label: 'e-Faktur', shortLabel: 'e-Faktur', icon: Receipt },
  { id: 'ebupot', label: 'e-Bupot', shortLabel: 'e-Bupot', icon: FileCheck2 },
  { id: 'spt', label: 'Surat Pemberitahuan (SPT)', shortLabel: 'SPT', icon: FileSpreadsheet },
  { id: 'pembayaran', label: 'Pembayaran & Buku Besar', shortLabel: 'Pembayaran', icon: CreditCard },
];

export const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    snapshot,
    activeNav,
    setActiveNav,
    activeExamCase,
    switchRole,
    resetSimulationData,
    logoutSimulator,
    approveBuyerNotification,
    toasts,
    dismissToast,
  } = useSimulator();

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(true);

  const isSimulatorUnlocked = Boolean(activeExamCase);

  if (!snapshot) return null;

  const { workspace, efaktur } = snapshot;
  const isBadan = workspace.activeRole === 'BADAN';
  const activeName = isBadan ? workspace.badanProfile.nama : workspace.opProfile.nama;
  const activeNpwp = isBadan ? workspace.badanProfile.npwp : workspace.opProfile.npwp;
  const activeDeposit = isBadan
    ? workspace.badanProfile.depositBalance
    : workspace.opProfile.depositBalance;

  const pendingBuyerApprovals = efaktur.filter(
    (inv) => inv.status === 'WAITING_FOR_AMENDMENT' || inv.status === 'WAITING_FOR_CANCELLATION'
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Bar: 3 clean zones (Brand | Single-line Nav | Account Switcher) */}
      <header className="sticky top-0 z-30 h-16 bg-[#1A2B5F] text-white border-b-2 border-[#F5C518]">
        <div className="h-full px-5 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveNav('ujian')}
            className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            KelasBrevet Coretax
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="hidden xl:flex items-center gap-6 text-sm font-medium">
            {NAV_ITEMS.filter((n) => n.id !== 'dashboard').map((item) => {
              const active = activeNav === item.id;
              const locked = item.id !== 'ujian' && !isSimulatorUnlocked;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  title={locked ? 'Klik "Mulai Ujian Praktik" pada soal terlebih dahulu' : item.label}
                  className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? 'border-[#F5C518] text-[#F5C518] font-semibold cursor-pointer'
                      : locked
                      ? 'border-transparent text-slate-400/70 cursor-not-allowed'
                      : 'border-transparent text-slate-200 hover:text-white cursor-pointer'
                  }`}
                >
                  {locked && <Lock className="w-3 h-3 opacity-80" />}
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Account / Impersonate Action */}
          <div className="relative flex items-center gap-3 shrink-0">
            {/* Functional Buyer Notification Bell (only interactive when simulating buyer approval) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setRoleMenuOpen(false);
                }}
                className="relative p-2 text-slate-200 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                title="Notifikasi Simulasi Persetujuan Lawan Transaksi"
                aria-label="Notifikasi"
              >
                <Bell className="w-4 h-4" />
                {pendingBuyerApprovals.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#F5C518] text-[#1A2B5F] text-[10px] font-bold rounded-full flex items-center justify-center font-num">
                    {pendingBuyerApprovals.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-lg z-40">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1A2B5F]">
                      Notifikasi Persetujuan Lawan Transaksi
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto p-3 space-y-2.5">
                    {pendingBuyerApprovals.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        Tidak ada permintaan persetujuan Pembatalan atau Pengganti Faktur yang tertunda.
                      </p>
                    ) : (
                      pendingBuyerApprovals.map((inv) => (
                        <div key={inv.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-2">
                          <div className="font-semibold text-slate-900">
                            {inv.status === 'WAITING_FOR_CANCELLATION'
                              ? 'Permintaan Pembatalan Faktur'
                              : 'Permintaan Faktur Pengganti'}
                          </div>
                          <div className="text-slate-600">
                            NSFP: <span className="font-num">{inv.invoiceNumber}</span> · {inv.counterpartyName}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              approveBuyerNotification(inv.id);
                              setNotifOpen(false);
                            }}
                            className="w-full py-1.5 bg-[#1A2B5F] text-white font-semibold rounded hover:bg-[#111D42] cursor-pointer"
                          >
                            Setujui sebagai Lawan Transaksi
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Impersonate / Role Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setRoleMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="h-9 px-3 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                {isBadan ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                <span className="max-w-[180px] truncate">
                  {isBadan ? 'Impersonate: WP Badan' : 'Akun Utama: OP'}
                </span>
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-slate-900 border border-slate-200 rounded-lg shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="text-xs font-bold text-[#1A2B5F]">Ganti Peran / Impersonate Coretax</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Pilih akun Orang Pribadi atau wakilkan Wajib Pajak Badan
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        switchRole('OP');
                        setRoleMenuOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-md text-xs transition-colors cursor-pointer ${
                        !isBadan ? 'bg-[#1A2B5F] text-white' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="font-bold">Akun Utama — Orang Pribadi (OP)</div>
                      <div className={`mt-0.5 ${!isBadan ? 'text-slate-200' : 'text-slate-500'}`}>
                        {workspace.opProfile.nama} · <span className="font-num">{workspace.nik}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        switchRole('BADAN');
                        setRoleMenuOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-md text-xs transition-colors cursor-pointer ${
                        isBadan ? 'bg-[#1A2B5F] text-white' : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="font-bold">Impersonate — Wajib Pajak Badan</div>
                      <div className={`mt-0.5 ${isBadan ? 'text-slate-200' : 'text-slate-500'}`}>
                        {workspace.badanProfile.nama} · <span className="font-num">{workspace.badanProfile.npwp}</span>
                      </div>
                    </button>
                  </div>
                  <div className="p-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setRoleMenuOpen(false);
                        logoutSimulator();
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-md flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Keluar dari Sesi NIK</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Body Grid: Left Sidebar + Main Viewport + Optional Guided Drawer */}
      <div className="flex-1 flex min-w-0">
        {/* Left Contextual Sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-slate-200 flex-col justify-between">
          <div>
            {/* Active Taxpayer Identity Summary */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="text-[11px] font-semibold text-[#B45309]">
                {isBadan ? 'IMPERSONATE WP BADAN' : 'AKUN UTAMA WP OP'}
              </div>
              <div className="mt-1 text-xs font-bold text-[#1A2B5F] leading-snug">{activeName}</div>
              <div className="mt-0.5 text-[11px] font-num text-slate-600">{formatNpwp16(activeNpwp)}</div>
              {snapshot.enrollment?.packageCode && (
                <div className="mt-1 text-[11px] text-slate-500">
                  Paket: <span className="font-semibold text-slate-700">{snapshot.enrollment.packageCode}</span>
                </div>
              )}
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Deposit Pajak</span>
                <span className="font-num font-bold text-slate-900">{formatRupiah(activeDeposit)}</span>
              </div>
            </div>

            {/* Sidebar Links */}
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                const locked = item.id !== 'ujian' && !isSimulatorUnlocked;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    title={locked ? 'Klik "Mulai Ujian Praktik" pada soal terlebih dahulu' : item.label}
                    className={`w-full px-3 py-2.5 rounded-md text-xs font-semibold flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? 'bg-[#1A2B5F] text-white cursor-pointer'
                        : locked
                        ? 'text-slate-400 bg-slate-50/70 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-[#1A2B5F] cursor-pointer'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-[#F5C518]' : locked ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {locked && <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                  </button>
                );
              })}

              {!isSimulatorUnlocked && (
                <div className="mt-3 px-3 py-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  Menu simulasi terbuka otomatis setelah Anda memilih soal &amp; klik{' '}
                  <strong>Mulai Ujian Praktik</strong>.
                </div>
              )}
            </nav>
          </div>

          <div className="p-3 border-t border-slate-200 space-y-2">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full px-3 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Data Latihan</span>
              </button>
            ) : (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-md space-y-2">
                <p className="text-[11px] text-red-800 leading-snug">
                  Reset semua faktur, e-Bupot, SPT, dan deposit ke awal?
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="flex-1 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await resetSimulationData();
                      setConfirmReset(false);
                    }}
                    className="flex-1 py-1 text-[11px] font-bold bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                  >
                    Ya, Reset
                  </button>
                </div>
              </div>
            )}
            <div className="px-1 text-[11px] text-slate-500 leading-relaxed flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span>Lisensi Simulasi KelasBrevet</span>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-6 max-w-full overflow-x-hidden">
          {/* Mobile Navigation Bar */}
          <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-4 mb-4 border-b border-slate-200">
            {NAV_ITEMS.map((item) => {
              const locked = item.id !== 'ujian' && !isSimulatorUnlocked;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                    activeNav === item.id
                      ? 'bg-[#1A2B5F] text-white cursor-pointer'
                      : locked
                      ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-700 cursor-pointer'
                  }`}
                >
                  {locked && <Lock className="w-3 h-3" />}
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Active Exam Case Instruction Bar — Always visible while working inside simulator modules */}
          {activeExamCase && activeNav !== 'ujian' && (
            <div className="mb-5 bg-white border border-[#1A2B5F]/30 rounded-lg overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-[#1A2B5F] text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ClipboardCheck className="w-4 h-4 text-[#F5C518] shrink-0 mt-0.5" />
                  <div className="min-w-0 text-xs">
                    <div className="text-[#F5C518] font-num font-bold">
                      SOAL UJIAN AKTIF · {activeExamCase.code} · KKM {activeExamCase.passingScore}
                    </div>
                    <div className="font-bold text-white truncate mt-0.5">{activeExamCase.title}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBriefExpanded((v) => !v)}
                    className="h-8 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <span>{briefExpanded ? 'Sembunyikan Soal' : 'Lihat Soal & Instruksi'}</span>
                    {briefExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav('ujian')}
                    className="h-8 px-3.5 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <span>Selesai &amp; Kumpulkan Ujian</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {briefExpanded && (
                <div className="p-4 bg-slate-50 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs border-t border-slate-200">
                  <div className="lg:col-span-7">
                    <div className="font-bold text-[#1A2B5F] mb-1.5">Instruksi Soal dari Admin:</div>
                    <div className="text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3 rounded-md border border-slate-200">
                      {activeExamCase.scenarioText}
                    </div>
                  </div>
                  <div className="lg:col-span-5">
                    <div className="font-bold text-[#1A2B5F] mb-1.5">
                      Indikator yang Akan Dinilai Otomatis ({activeExamCase.rubric.length}):
                    </div>
                    <ul className="space-y-1.5 bg-white p-3 rounded-md border border-slate-200">
                      {activeExamCase.rubric.map((rule, idx) => (
                        <li key={rule.id} className="flex items-start justify-between gap-2 text-slate-700">
                          <span>
                            <strong className="font-num text-[#1A2B5F]">{idx + 1}.</strong> {rule.label}
                          </span>
                          <span className="font-num font-semibold text-slate-500 shrink-0">{rule.weight}p</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {children}
        </main>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto px-4 py-3 rounded-md border text-xs font-medium shadow-md flex items-start justify-between gap-3 ${
                t.tone === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : t.tone === 'error'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : t.tone === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <span className="leading-relaxed">{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
