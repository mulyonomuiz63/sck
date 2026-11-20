import React, { useState } from 'react';
import { KeyRound, ShieldCheck, X } from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { DEFAULT_PASSPHRASE } from '../lib/seedData';

export const TteModal: React.FC = () => {
  const { tteRequest, closeTte, verifyPassphrase, snapshot } = useSimulator();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!tteRequest || !snapshot) return null;

  const activePass =
    snapshot.workspace.activeRole === 'BADAN'
      ? snapshot.workspace.badanProfile.passphrase
      : snapshot.workspace.opProfile.passphrase;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPassphrase(passphrase)) {
      setError(`Passphrase Kode Otorisasi tidak sesuai. Gunakan passphrase simulasi: ${activePass}`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await tteRequest.onConfirm();
      setPassphrase('');
      closeTte();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full overflow-hidden">
        <div className="bg-[#1A2B5F] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#F5C518]" />
            <h2 className="text-sm font-bold">Penandatanganan Dokumen (TTE)</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setPassphrase('');
              setError('');
              closeTte();
            }}
            className="text-slate-300 hover:text-white cursor-pointer"
            aria-label="Tutup modal tanda tangan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{tteRequest.title}</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{tteRequest.description}</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Penyedia Penandatangan</span>
              <span className="font-semibold text-slate-900">Kode Otorisasi DJP (Simulasi KelasBrevet)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ID Penandatangan (NIK)</span>
              <span className="font-num text-slate-900">{snapshot.workspace.nik}</span>
            </div>
          </div>

          <div>
            <label htmlFor="tte-passphrase" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kata Sandi Penandatangan (Passphrase)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                id="tte-passphrase"
                type="password"
                autoFocus
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setError('');
                }}
                placeholder="Masukkan passphrase simulasi..."
                className="w-full h-10 pl-9 pr-3 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B5F]"
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>
                Petunjuk simulasi: <span className="font-num text-slate-800">{activePass || DEFAULT_PASSPHRASE}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setPassphrase(activePass || DEFAULT_PASSPHRASE);
                  setError('');
                }}
                className="text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
              >
                Isi Otomatis
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setPassphrase('');
                setError('');
                closeTte();
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !passphrase.trim()}
              className="px-4 py-2 text-xs font-bold bg-[#1A2B5F] text-white rounded-md hover:bg-[#111D42] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Memproses...' : 'Konfirmasi Tanda Tangan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
