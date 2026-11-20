import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BookOpenCheck, Lock, ShieldCheck, X } from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { DEMO_NIK_TUAN_A } from '../lib/seedData';

interface LoginGateProps {
  onOpenAdmin: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ onOpenAdmin }) => {
  const { loginWithNik, loginWithSso, loginError, clearLoginError } = useSimulator();
  const [nik, setNik] = useState(DEMO_NIK_TUAN_A);
  const [nama, setNama] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ssoChecking, setSsoChecking] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('sso');
    if (!ssoToken) return;

    // Bersihkan parameter ?sso= dari address bar agar token tidak tertinggal di history browser
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    setSsoChecking(true);
    void loginWithSso(ssoToken).finally(() => setSsoChecking(false));
  }, [loginWithSso]);

  const digitsOnly = nik.replace(/\D/g, '').slice(0, 16);
  const isValid = digitsOnly.length === 16;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    clearLoginError();
    setSubmitting(true);
    try {
      await loginWithNik(digitsOnly, nama);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async () => {
    clearLoginError();
    setSubmitting(true);
    try {
      await loginWithNik(DEMO_NIK_TUAN_A, 'TUAN A (PESERTA BREVET)');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Coretax Navy Accent Strip */}
      <header className="bg-[#1A2B5F] text-white border-b-4 border-[#F5C518]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            KelasBrevet Coretax
          </span>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 text-xs text-white font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#F5C518]" />
            <span>Portal Admin</span>
          </button>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Minimal Login Form */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-8 flex flex-col justify-center">
            <div>
              <h1 className="text-2xl font-bold text-[#1A2B5F] leading-snug">
                Masuk Simulasi Coretax
              </h1>

              {ssoChecking && (
                <div className="mt-4 p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-[#1A2B5F] font-medium">
                  Memverifikasi tautan akses otomatis (SSO)...
                </div>
              )}

              {loginError && (
                <div
                  role="alert"
                  className="mt-4 p-3.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-900 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <div className="font-bold text-red-800">Akses Ditolak</div>
                      <p className="mt-0.5 text-red-800">{loginError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearLoginError}
                    className="text-red-500 hover:text-red-800 shrink-0 cursor-pointer"
                    aria-label="Tutup pesan galat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="nik-input" className="text-xs font-semibold text-slate-700">
                      NIK (16 Digit)
                    </label>
                    <span className="font-num text-xs text-slate-500">{digitsOnly.length}/16</span>
                  </div>
                  <input
                    id="nik-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    value={digitsOnly}
                    onChange={(e) => {
                      clearLoginError();
                      setNik(e.target.value.replace(/\D/g, '').slice(0, 16));
                    }}
                    placeholder="3273011205900001"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-md font-num text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F] focus:border-[#1A2B5F]"
                  />
                </div>

                <div>
                  <label htmlFor="nama-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Peserta (Opsional)
                  </label>
                  <input
                    id="nama-input"
                    type="text"
                    maxLength={80}
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Nama peserta"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F] focus:border-[#1A2B5F]"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={!isValid || submitting || ssoChecking}
                    className="flex-1 h-11 px-4 bg-[#1A2B5F] text-white text-sm font-semibold rounded-md hover:bg-[#111D42] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>{submitting ? 'Memverifikasi...' : 'Masuk Simulator'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={submitting || ssoChecking}
                    onClick={handleQuickDemo}
                    className="h-11 px-4 bg-[#F5C518] text-[#1A2B5F] text-sm font-bold rounded-md hover:bg-[#EAB308] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    NIK Latihan Tuan A
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Right: Concise Modules Outline Only */}
          <aside className="lg:col-span-6 bg-[#1A2B5F] text-white rounded-lg p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#F5C518] text-xs font-semibold">
                <BookOpenCheck className="w-4 h-4" />
                <span>Garis Besar Modul</span>
              </div>

              <ol className="mt-5 space-y-3 text-sm">
                <li className="pb-3 border-b border-white/15 font-semibold text-white">
                  01. e-Faktur &amp; SPT Masa PPN
                </li>
                <li className="pb-3 border-b border-white/15 font-semibold text-white">
                  02. Pelaporan PPh 21 Tahunan (Karyawan)
                </li>
                <li className="pb-3 border-b border-white/15 font-semibold text-white">
                  03. e-Bupot &amp; SPT Masa PPh 21 dan PPh 23
                </li>
                <li className="pb-3 border-b border-white/15 font-semibold text-white">
                  04. Laporan SPT Tahunan Orang Pribadi
                </li>
                <li className="pb-3 border-b border-white/15 font-semibold text-white">
                  05. Pelaporan SPT Tahunan PPh Badan
                </li>
                <li className="font-semibold text-[#F5C518]">
                  06. Ujian Praktik &amp; Sertifikat Otomatis
                </li>
              </ol>
            </div>

            <div className="mt-6 pt-4 border-t border-white/15 flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#F5C518] shrink-0" />
              <span>
                Passphrase: <span className="font-num text-white">kelasbrevet123</span>
              </span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
