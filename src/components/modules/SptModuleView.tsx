import React, { useState } from 'react';
import { Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import { formatRupiah, MASA_NAMES } from '../../lib/taxCalculations';
import { TaxReturnStatus, TaxReturnType } from '../../types/tax';
import { SptBadanTahunanEditor } from './spt/SptBadanTahunanEditor';
import { SptMasaPphEditor } from './spt/SptMasaPphEditor';
import { SptOpTahunanEditor } from './spt/SptOpTahunanEditor';
import { SptPpnEditor } from './spt/SptPpnEditor';

const RETURN_TYPE_META: Record<TaxReturnType, { label: string; role: 'OP' | 'BADAN'; isAnnual: boolean }> = {
  PPH_OP_TAHUNAN: { label: 'SPT Tahunan PPh Orang Pribadi', role: 'OP', isAnnual: true },
  PPN: { label: 'SPT Masa PPN', role: 'BADAN', isAnnual: false },
  PPH21_MASA: { label: 'SPT Masa PPh Pasal 21/26', role: 'BADAN', isAnnual: false },
  PPH_UNIFIKASI: { label: 'SPT Masa PPh Unifikasi (PPh 23)', role: 'BADAN', isAnnual: false },
  PPH_BADAN_TAHUNAN: { label: 'SPT Tahunan PPh Badan', role: 'BADAN', isAnnual: true },
};

export const SptModuleView: React.FC = () => {
  const {
    snapshot,
    createTaxReturn,
    deleteTaxReturn,
    switchRole,
    setActiveNav,
    openPreviewDoc,
  } = useSimulator();

  const [statusTab, setStatusTab] = useState<TaxReturnStatus>('KONSEP');
  const [editingId, setEditingId] = useState<string | null>(null);

  // 3-step Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [wType, setWType] = useState<TaxReturnType>('PPH_OP_TAHUNAN');
  const [wMasa, setWMasa] = useState(1);
  const [wTahun, setWTahun] = useState(2025);
  const [wPembetulan, setWPembetulan] = useState(0);

  if (!snapshot) return null;

  const activeReturn = editingId ? snapshot.taxReturns.find((r) => r.id === editingId) : null;
  if (activeReturn) {
    if (activeReturn.returnType === 'PPN') {
      return <SptPpnEditor taxReturn={activeReturn} onBack={() => setEditingId(null)} />;
    }
    if (activeReturn.returnType === 'PPH21_MASA' || activeReturn.returnType === 'PPH_UNIFIKASI') {
      return <SptMasaPphEditor taxReturn={activeReturn} onBack={() => setEditingId(null)} />;
    }
    if (activeReturn.returnType === 'PPH_OP_TAHUNAN') {
      return <SptOpTahunanEditor taxReturn={activeReturn} onBack={() => setEditingId(null)} />;
    }
    return <SptBadanTahunanEditor taxReturn={activeReturn} onBack={() => setEditingId(null)} />;
  }

  const isBadan = snapshot.workspace.activeRole === 'BADAN';
  const filteredReturns = snapshot.taxReturns.filter((r) => r.status === statusTab);

  const openWizard = () => {
    setWType(isBadan ? 'PPN' : 'PPH_OP_TAHUNAN');
    setWMasa(1);
    setWTahun(2025);
    setWPembetulan(0);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const handleCreateConcept = () => {
    const meta = RETURN_TYPE_META[wType];
    if (snapshot.workspace.activeRole !== meta.role) {
      switchRole(meta.role);
    }
    const created = createTaxReturn({
      returnType: wType,
      masaPajak: meta.isAnnual ? 12 : wMasa,
      tahunPajak: wTahun,
      pembetulanKe: wPembetulan,
    });
    setWizardOpen(false);
    setEditingId(created.id);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Surat Pemberitahuan (SPT)</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F]">
            Konsep SPT, Menunggu Pembayaran & SPT Dilaporkan
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Kelola pelaporan SPT Masa PPN, PPh 21/26, PPh Unifikasi, SPT Tahunan Orang Pribadi, dan SPT Tahunan PPh Badan.
          </p>
        </div>

        <button
          type="button"
          onClick={openWizard}
          className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-2 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Konsep SPT</span>
        </button>
      </div>

      {/* Status Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
        {[
          {
            id: 'KONSEP',
            label: `Konsep SPT (${snapshot.taxReturns.filter((r) => r.status === 'KONSEP').length})`,
          },
          {
            id: 'MENUNGGU_PEMBAYARAN',
            label: `Menunggu Pembayaran (${snapshot.taxReturns.filter((r) => r.status === 'MENUNGGU_PEMBAYARAN').length})`,
          },
          {
            id: 'DILAPORKAN',
            label: `SPT Dilaporkan (${snapshot.taxReturns.filter((r) => r.status === 'DILAPORKAN').length})`,
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatusTab(t.id as TaxReturnStatus)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              statusTab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SPT Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#1A2B5F] text-white">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Jenis SPT</th>
                <th className="text-left font-semibold px-4 py-3">Peran WP</th>
                <th className="text-left font-semibold px-4 py-3">Masa / Tahun</th>
                <th className="text-left font-semibold px-4 py-3">Model</th>
                <th className="text-left font-semibold px-4 py-3">Posisi Pajak</th>
                <th className="text-right font-semibold px-4 py-3">Nominal</th>
                <th className="text-left font-semibold px-4 py-3">BPE / Billing</th>
                <th className="text-right font-semibold px-4 py-3">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Belum ada SPT pada tab <strong>{statusTab.replace(/_/g, ' ')}</strong>. Klik{' '}
                    <strong>Buat Konsep SPT</strong> untuk memulai pelaporan.
                  </td>
                </tr>
              ) : (
                filteredReturns.map((r) => {
                  const meta = RETURN_TYPE_META[r.returnType];
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-[#1A2B5F]">{meta.label}</td>
                      <td className="px-4 py-2.5">{r.taxpayerRole === 'BADAN' ? 'WP Badan' : 'WP OP'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {meta.isAnnual ? `Tahun ${r.tahunPajak}` : `${MASA_NAMES[r.masaPajak - 1]} ${r.tahunPajak}`}
                      </td>
                      <td className="px-4 py-2.5">{r.pembetulanKe === 0 ? 'Normal' : `Pembetulan-${r.pembetulanKe}`}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        <span
                          className={
                            r.taxPosition === 'KURANG_BAYAR'
                              ? 'text-red-700'
                              : r.taxPosition === 'LEBIH_BAYAR'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }
                        >
                          {r.taxPosition}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-num font-semibold">{formatRupiah(r.amountDue)}</td>
                      <td className="px-4 py-2.5 font-num text-[11px] text-slate-600">
                        {r.bpeNumber || r.billingCode || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                        {r.status === 'KONSEP' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(r.id)}
                              className="px-2.5 py-1 bg-[#1A2B5F] text-white font-semibold rounded hover:bg-[#111D42] cursor-pointer"
                            >
                              Buka / Isi SPT
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTaxReturn(r.id)}
                              className="p-1 text-red-600 hover:text-red-800 align-middle cursor-pointer"
                              title="Hapus Konsep"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </>
                        )}
                        {r.status === 'MENUNGGU_PEMBAYARAN' && (
                          <button
                            type="button"
                            onClick={() => setActiveNav('pembayaran')}
                            className="px-2.5 py-1 bg-[#F5C518] text-[#1A2B5F] font-bold rounded hover:bg-[#EAB308] cursor-pointer"
                          >
                            Bayar Kode Billing
                          </button>
                        )}
                        {r.status === 'DILAPORKAN' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(r.id)}
                              className="p-1 text-slate-600 hover:text-[#1A2B5F] align-middle cursor-pointer"
                              title="Lihat SPT"
                            >
                              <Eye className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openPreviewDoc({
                                  kind: 'BPE',
                                  title: 'Bukti Penerimaan Elektronik (BPE)',
                                  subtitle: `${meta.label} — Status DILAPORKAN`,
                                  docNumber: r.bpeNumber,
                                  date: r.submittedAt.slice(0, 10),
                                  taxpayerName:
                                    r.taxpayerRole === 'BADAN'
                                      ? snapshot.workspace.badanProfile.nama
                                      : snapshot.workspace.opProfile.nama,
                                  taxpayerNpwp:
                                    r.taxpayerRole === 'BADAN'
                                      ? snapshot.workspace.badanProfile.npwp
                                      : snapshot.workspace.opProfile.npwp,
                                  rows: [
                                    { label: 'Jenis SPT', value: meta.label },
                                    {
                                      label: 'Masa / Tahun Pajak',
                                      value: meta.isAnnual
                                        ? `Tahun ${r.tahunPajak}`
                                        : `${MASA_NAMES[r.masaPajak - 1]} ${r.tahunPajak}`,
                                    },
                                    {
                                      label: 'Model SPT',
                                      value: r.pembetulanKe === 0 ? 'Normal' : `Pembetulan ke-${r.pembetulanKe}`,
                                    },
                                    { label: 'Posisi SPT', value: r.taxPosition },
                                    { label: 'Nominal', value: formatRupiah(r.amountDue), highlight: true },
                                    { label: 'Tanggal & Jam Lapor', value: r.submittedAt.replace('T', ' ').slice(0, 19) },
                                  ],
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1A2B5F] text-white font-semibold rounded hover:bg-[#111D42] cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Cetak BPE</span>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3-Step Buat Konsep SPT Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold">Buat Konsep SPT — Langkah {wizardStep} dari 3</h2>
              <button type="button" onClick={() => setWizardOpen(false)} className="text-xs text-slate-200 hover:text-white cursor-pointer">
                Tutup
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {wizardStep === 1 && (
                <div className="space-y-2.5">
                  <div className="font-bold text-[#1A2B5F]">Langkah 1: Pilih Jenis Pajak / SPT</div>
                  {(Object.keys(RETURN_TYPE_META) as TaxReturnType[]).map((key) => {
                    const m = RETURN_TYPE_META[key];
                    return (
                      <label
                        key={key}
                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer ${
                          wType === key ? 'border-[#1A2B5F] bg-[#1A2B5F]/5' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            checked={wType === key}
                            onChange={() => setWType(key)}
                          />
                          <span className="font-semibold text-slate-900">{m.label}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {m.role === 'BADAN' ? 'WP Badan' : 'WP OP'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <div className="font-bold text-[#1A2B5F]">Langkah 2: Pilih Periode / Tahun Pajak</div>
                  <div className="grid grid-cols-2 gap-3">
                    {!RETURN_TYPE_META[wType].isAnnual && (
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Masa Pajak</label>
                        <select
                          value={wMasa}
                          onChange={(e) => setWMasa(Number(e.target.value))}
                          className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                        >
                          {MASA_NAMES.map((m, idx) => (
                            <option key={m} value={idx + 1}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={RETURN_TYPE_META[wType].isAnnual ? 'col-span-2' : ''}>
                      <label className="block font-semibold text-slate-700 mb-1">Tahun Pajak</label>
                      <select
                        value={wTahun}
                        onChange={(e) => setWTahun(Number(e.target.value))}
                        className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white font-num"
                      >
                        <option value={2025}>2025 (Januari – Desember 2025)</option>
                        <option value={2024}>2024 (Januari – Desember 2024)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-3">
                  <div className="font-bold text-[#1A2B5F]">Langkah 3: Model SPT (Normal / Pembetulan)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`p-3 border rounded-md cursor-pointer ${
                        wPembetulan === 0 ? 'border-[#1A2B5F] bg-[#1A2B5F]/5' : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={wPembetulan === 0}
                        onChange={() => setWPembetulan(0)}
                        className="mr-2"
                      />
                      <strong>Normal (Ke-0)</strong>
                    </label>
                    <label
                      className={`p-3 border rounded-md cursor-pointer ${
                        wPembetulan > 0 ? 'border-[#1A2B5F] bg-[#1A2B5F]/5' : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={wPembetulan > 0}
                        onChange={() => setWPembetulan(1)}
                        className="mr-2"
                      />
                      <strong>Pembetulan</strong>
                    </label>
                  </div>
                  {wPembetulan > 0 && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Pembetulan Ke-</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={wPembetulan}
                        onChange={(e) => setWPembetulan(Math.max(1, Number(e.target.value) || 1))}
                        className="w-28 h-9 px-2.5 border border-slate-300 rounded font-num"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                    <div>
                      <strong>Ringkasan:</strong> {RETURN_TYPE_META[wType].label}
                    </div>
                    <div className="text-slate-600">
                      Periode:{' '}
                      {RETURN_TYPE_META[wType].isAnnual
                        ? `Tahun ${wTahun}`
                        : `${MASA_NAMES[wMasa - 1]} ${wTahun}`}{' '}
                      · {wPembetulan === 0 ? 'Normal' : `Pembetulan ke-${wPembetulan}`}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  disabled={wizardStep === 1}
                  onClick={() => setWizardStep((s) => (s === 3 ? 2 : 1))}
                  className="px-4 py-2 border border-slate-300 rounded-md font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Kembali
                </button>
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((s) => (s === 1 ? 2 : 3))}
                    className="px-4 py-2 bg-[#1A2B5F] text-white font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
                  >
                    Lanjut
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateConcept}
                    className="px-4 py-2 bg-[#F5C518] text-[#1A2B5F] font-bold rounded-md hover:bg-[#EAB308] cursor-pointer"
                  >
                    Buat Konsep SPT
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
