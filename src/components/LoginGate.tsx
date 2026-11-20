import React, { useState } from 'react';
import { ArrowRight, BookOpenCheck, Cloud, ShieldCheck } from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { DEMO_NIK_TUAN_A } from '../lib/seedData';

export const LoginGate: React.FC = () => {
  const { loginWithNik, firebaseUser, connectGoogleCloud } = useSimulator();
  const [nik, setNik] = useState(DEMO_NIK_TUAN_A);
  const [nama, setNama] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const digitsOnly = nik.replace(/\D/g, '').slice(0, 16);
  const isValid = digitsOnly.length === 16;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      await loginWithNik(digitsOnly, nama);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async () => {
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
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            KelasBrevet Coretax
          </span>
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-200">
            <span className="whitespace-nowrap">Lisensi Pembelajaran KelasBrevet</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">Lingkungan Simulasi Pendidikan</span>
          </div>
        </div>
      </header>

      {/* Main Split Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Login Form */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#B45309] tracking-wide">
                Portal Simulasi Administrasi Perpajakan
              </p>
              <h1 className="mt-2 text-2xl font-bold text-[#1A2B5F] leading-snug text-balance">
                Masuk ke Simulasi Coretax dengan NIK
              </h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Masukkan 16 digit NIK Anda untuk langsung memulai praktik. Sistem otomatis menyiapkan
                akun Wajib Pajak Orang Pribadi serta akses Impersonate PT Simulasi KelasBrevet.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="nik-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nomor Induk Kependudukan (NIK 16 Digit)
                  </label>
                  <input
                    id="nik-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={16}
                    value={digitsOnly}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    placeholder="Contoh: 3273011205900001"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-md font-num text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F] focus:border-[#1A2B5F]"
                  />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>{isValid ? 'Format 16 digit valid' : 'Masukkan tepat 16 digit angka'}</span>
                    <span className="font-num">{digitsOnly.length}/16</span>
                  </div>
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
                    placeholder="Kosongkan untuk nama default (mis. Tuan A)"
                    className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F] focus:border-[#1A2B5F]"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={!isValid || submitting}
                    className="flex-1 h-11 px-4 bg-[#1A2B5F] text-white text-sm font-semibold rounded-md hover:bg-[#111D42] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>{submitting ? 'Memuat Portal...' : 'Masuk Simulator'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleQuickDemo}
                    className="h-11 px-4 bg-[#F5C518] text-[#1A2B5F] text-sm font-bold rounded-md hover:bg-[#EAB308] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    NIK Latihan Tuan A
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-600">
                {firebaseUser ? (
                  <span>Sinkronisasi Cloud aktif: {firebaseUser.email}</span>
                ) : (
                  <span>Ingin simpan progres lintas perangkat?</span>
                )}
              </div>
              {!firebaseUser && (
                <button
                  type="button"
                  onClick={() => void connectGoogleCloud()}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#1A2B5F] border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Hubungkan Google Cloud</span>
                </button>
              )}
            </div>
          </section>

          {/* Right: 5 Modules Curriculum Summary */}
          <aside className="lg:col-span-6 bg-[#1A2B5F] text-white rounded-lg p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#F5C518] text-xs font-semibold">
                <BookOpenCheck className="w-4 h-4" />
                <span>Kurikulum Praktik Brevet A & B — KelasBrevet</span>
              </div>
              <h2 className="mt-3 text-xl font-bold leading-snug text-balance">
                Lima Modul Simulasi Terintegrasi dalam Satu Portal
              </h2>
              <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                Faktur Pajak dan Bukti Potong yang Anda terbitkan mengalir otomatis (prepopulate)
                saat menjalankan Posting SPT, lengkap dengan simulasi TTE Passphrase, Deposit Pajak,
                Kode Billing, dan cetak BPE.
              </p>

              <ol className="mt-6 space-y-3 text-sm">
                <li className="pb-3 border-b border-white/15">
                  <div className="font-semibold text-white">01. e-Faktur & SPT Masa PPN</div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Keluaran/Masukan, Pengganti, Pembatalan, Retur, Lampiran A-1 s.d. C, Deposit & Billing.
                  </p>
                </li>
                <li className="pb-3 border-b border-white/15">
                  <div className="font-semibold text-white">02. Pelaporan PPh 21 Tahunan (Karyawan)</div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Studi kasus Tuan A, Dokumen Saya (BPA1), Posting SPT, Induk A–K, Lampiran L-1 & L-2, BPE.
                  </p>
                </li>
                <li className="pb-3 border-b border-white/15">
                  <div className="font-semibold text-white">03. e-Bupot & SPT Masa PPh 21 dan PPh 23</div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Impersonate Perusahaan, MP Pegawai Tetap (TER A/B/C), BP 21, BPPU PPh 23 (2%), Impor Massal.
                  </p>
                </li>
                <li className="pb-3 border-b border-white/15">
                  <div className="font-semibold text-white">04. Laporan SPT Tahunan Orang Pribadi</div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Skenario komprehensif OP: Pekerjaan, Usaha/Norma, Penghasilan Final UMKM, Harta & Utang.
                  </p>
                </li>
                <li>
                  <div className="font-semibold text-white">05. Pelaporan SPT Tahunan PPh Badan</div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Laba Rugi Komersial, Rekonsiliasi Fiskal Positif/Negatif, Tarif 22% / Pasal 31E, Kredit Pajak.
                  </p>
                </li>
              </ol>
            </div>

            <div className="mt-6 pt-4 border-t border-white/15 flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#F5C518] shrink-0" />
              <span>
                Passphrase simulasi standar: <span className="font-num text-white">kelasbrevet123</span> · Bukan situs resmi DJP.
              </span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
