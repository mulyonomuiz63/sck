import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Send } from 'lucide-react';
import { useSimulator } from '../../../context/SimulatorContext';
import { formatRupiah, MASA_NAMES } from '../../../lib/taxCalculations';
import { SptPpnPayload, TaxReturn } from '../../../types/tax';

interface Props {
  taxReturn: TaxReturn;
  onBack: () => void;
}

type PpnTab = 'INDUK' | 'A1' | 'A2' | 'B1' | 'B2' | 'B3' | 'C';

export const SptPpnEditor: React.FC<Props> = ({ taxReturn, onBack }) => {
  const {
    snapshot,
    updateTaxReturnPayload,
    postTaxReturnData,
    submitTaxReturn,
    requestTte,
    pushToast,
  } = useSimulator();

  const [tab, setTab] = useState<PpnTab>('INDUK');
  const [payModal, setPayModal] = useState(false);

  if (!snapshot) return null;

  const payload = taxReturn.payload as SptPpnPayload;
  const readOnly = taxReturn.status === 'DILAPORKAN';
  const depositBalance = snapshot.workspace.badanProfile.depositBalance;

  const updateField = <K extends keyof SptPpnPayload>(key: K, val: SptPpnPayload[K]) => {
    if (readOnly) return;
    updateTaxReturnPayload(taxReturn.id, { ...payload, [key]: val });
  };

  const totalKeluaran = payload.a2DipungutSendiriPpn;
  const totalMasukan = payload.b1ImporPpn + payload.b2MasukanKreditPpn + payload.kompensasiMasaLalu;
  const selisih = totalKeluaran - totalMasukan + payload.ppnKms + payload.ppnbmTerutang;
  const statusLabel = selisih > 0 ? 'KURANG BAYAR' : selisih < 0 ? 'LEBIH BAYAR' : 'NIHIL';

  const periodInvoices = snapshot.efaktur.filter(
    (i) => i.masaPajak === taxReturn.masaPajak && i.tahunPajak === taxReturn.tahunPajak && i.status !== 'CANCELED'
  );

  const handleTriggerSubmit = () => {
    if (!payload.declarationChecked) {
      pushToast('warning', 'Centang pernyataan kebenaran SPT terlebih dahulu sebelum melapor.');
      return;
    }
    if (selisih > 0) {
      setPayModal(true);
    } else {
      requestTte({
        title: `Lapor SPT Masa PPN (${MASA_NAMES[taxReturn.masaPajak - 1]} ${taxReturn.tahunPajak})`,
        description: `Status SPT: ${statusLabel} (${formatRupiah(Math.abs(selisih))}).`,
        onConfirm: () => {
          submitTaxReturn(taxReturn.id, 'NONE');
          onBack();
        },
      });
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Top Action Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
            aria-label="Kembali ke daftar SPT"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <div>
            <div className="text-xs text-slate-500">
              SPT Masa PPN · {MASA_NAMES[taxReturn.masaPajak - 1]} {taxReturn.tahunPajak} ·{' '}
              {taxReturn.pembetulanKe === 0 ? 'Normal' : `Pembetulan ke-${taxReturn.pembetulanKe}`}
            </div>
            <h2 className="text-lg font-bold text-[#1A2B5F]">{snapshot.workspace.badanProfile.nama}</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => postTaxReturnData(taxReturn.id)}
                className="px-3.5 py-2 border border-[#1A2B5F] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Posting SPT (Tarik e-Faktur)</span>
              </button>
              <button
                type="button"
                onClick={handleTriggerSubmit}
                className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Bayar dan Lapor</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs A1 - C */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full">
        {[
          { id: 'INDUK', label: 'Induk SPT' },
          { id: 'A1', label: 'A-1 Ekspor' },
          { id: 'A2', label: 'A-2 Keluaran DN' },
          { id: 'B1', label: 'B-1 Impor' },
          { id: 'B2', label: 'B-2 Masukan Kredit' },
          { id: 'B3', label: 'B-3 Tdk Dikreditkan' },
          { id: 'C', label: 'C Pihak Lain' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as PpnTab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              tab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'INDUK' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-slate-500">Pajak Keluaran Dipungut Sendiri (A-2)</div>
              <div className="mt-1 text-lg font-bold font-num text-slate-900">{formatRupiah(totalKeluaran)}</div>
            </div>
            <div>
              <div className="text-slate-500">Total Pajak Masukan & Kompensasi (B-1 + B-2)</div>
              <div className="mt-1 text-lg font-bold font-num text-emerald-700">{formatRupiah(totalMasukan)}</div>
            </div>
            <div>
              <div className="text-slate-500">Posisi SPT ({statusLabel})</div>
              <div
                className={`mt-1 text-lg font-bold font-num ${
                  selisih > 0 ? 'text-red-700' : selisih < 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {formatRupiah(Math.abs(selisih))}
              </div>
            </div>
          </div>

          <table className="w-full border-collapse">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 text-slate-700">I.A Ekspor BKP/JKP (Lampiran A-1) — DPP</td>
                <td className="py-2.5 text-right font-num">{formatRupiah(payload.a1EksporDpp)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">I.B Penyerahan Dalam Negeri (Lampiran A-2) — DPP</td>
                <td className="py-2.5 text-right font-num">{formatRupiah(payload.a2KeluaranDpp)}</td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold text-slate-900">II.A Pajak Keluaran yang Harus Dipungut Sendiri</td>
                <td className="py-2.5 text-right font-num font-bold text-[#1A2B5F]">{formatRupiah(payload.a2DipungutSendiriPpn)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">II.B PPN Dipungut oleh Pemungut PPN (Kode 02/03)</td>
                <td className="py-2.5 text-right font-num">{formatRupiah(payload.a2DipungutPemungutPpn)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">III.A Pajak Masukan Impor (Lampiran B-1)</td>
                <td className="py-2.5 text-right font-num">{formatRupiah(payload.b1ImporPpn)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">III.B Pajak Masukan Dalam Negeri Dikreditkan (Lampiran B-2)</td>
                <td className="py-2.5 text-right font-num">{formatRupiah(payload.b2MasukanKreditPpn)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">III.C Kompensasi Kelebihan PPN Masa Pajak Sebelumnya</td>
                <td className="py-2.5 text-right">
                  <input
                    type="number"
                    disabled={readOnly}
                    min={0}
                    value={payload.kompensasiMasaLalu}
                    onChange={(e) => updateField('kompensasiMasaLalu', Number(e.target.value) || 0)}
                    className="w-44 h-8 px-2 text-right font-num border border-slate-300 rounded"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">IV. PPN Kegiatan Membangun Sendiri (KMS)</td>
                <td className="py-2.5 text-right">
                  <input
                    type="number"
                    disabled={readOnly}
                    min={0}
                    value={payload.ppnKms}
                    onChange={(e) => updateField('ppnKms', Number(e.target.value) || 0)}
                    className="w-44 h-8 px-2 text-right font-num border border-slate-300 rounded"
                  />
                </td>
              </tr>
              <tr className="bg-amber-50/70">
                <td className="py-3 font-bold text-[#1A2B5F]">
                  V. PPN Kurang atau (Lebih) Bayar — {statusLabel}
                </td>
                <td className="py-3 text-right font-num font-bold text-base text-[#1A2B5F]">
                  {formatRupiah(selisih)}
                </td>
              </tr>
            </tbody>
          </table>

          {selisih < 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-2">
              <div className="font-bold text-slate-900">Pilihan Kelebihan Pembayaran PPN:</div>
              <div className="flex flex-wrap gap-4">
                {[
                  { id: 'KOMPENSASI', label: 'Dikompensasikan ke Masa Pajak Berikutnya' },
                  { id: 'RESTITUSI_CEPAT', label: 'Pengembalian Pendahuluan (Restitusi Cepat)' },
                  { id: 'RESTITUSI_BIASA', label: 'Restitusi Prosedur Biasa' },
                ].map((opt) => (
                  <label key={opt.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      disabled={readOnly}
                      checked={payload.overpaymentAction === opt.id}
                      onChange={() => updateField('overpaymentAction', opt.id as SptPpnPayload['overpaymentAction'])}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Pernyataan */}
          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={payload.declarationChecked}
                onChange={(e) => updateField('declarationChecked', e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-slate-700 leading-relaxed">
                <strong>Pernyataan Wajib Pajak:</strong> Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi sesuai ketentuan peraturan perundang-undangan yang berlaku, saya menyatakan bahwa apa yang telah saya beritahukan di atas beserta lampirannya adalah benar, lengkap, dan jelas.
              </span>
            </label>
          </div>
        </div>
      )}

      {tab !== 'INDUK' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-[#1A2B5F]">Rincian Lampiran {tab} (Hasil Prepopulate e-Faktur)</h3>
            <span className="text-slate-500">
              {payload.postedAt ? `Diposting: ${payload.postedAt.slice(0, 19).replace('T', ' ')}` : 'Belum di-Posting'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#1A2B5F] text-white">
                <tr>
                  <th className="text-left px-4 py-2.5">NSFP / Nomor</th>
                  <th className="text-left px-4 py-2.5">Kode</th>
                  <th className="text-left px-4 py-2.5">Lawan Transaksi</th>
                  <th className="text-right px-4 py-2.5">DPP</th>
                  <th className="text-right px-4 py-2.5">PPN</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(() => {
                  const rows = periodInvoices.filter((i) => {
                    if (tab === 'A1') return i.category === 'SPECIAL_OUTPUT';
                    if (tab === 'A2') return (i.category === 'OUTPUT' || i.category === 'OUTPUT_RETURN') && (i.status === 'APPROVED' || i.status === 'AMENDED');
                    if (tab === 'B1') return i.category === 'SPECIAL_INPUT';
                    if (tab === 'B2') return (i.category === 'INPUT' || i.category === 'INPUT_RETURN') && i.creditStatus === 'CREDITED';
                    if (tab === 'B3') return i.category === 'INPUT' && i.creditStatus === 'UNCREDITED';
                    return false;
                  });
                  if (rows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Tidak ada dokumen e-Faktur pada Lampiran {tab} untuk masa pajak ini.
                        </td>
                      </tr>
                    );
                  }
                  return rows.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2.5 font-num">{inv.transactionCode}</td>
                      <td className="px-4 py-2.5">{inv.counterpartyName}</td>
                      <td className="px-4 py-2.5 text-right font-num">{formatRupiah(inv.dppTotal)}</td>
                      <td className="px-4 py-2.5 text-right font-num font-semibold">{formatRupiah(inv.ppnTotal)}</td>
                      <td className="px-4 py-2.5 text-emerald-700 font-semibold">{inv.status}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Choice Modal (Deposit vs Billing Code) */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 font-bold text-sm">
              Pilih Metode Pembayaran PPN Kurang Bayar
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">PPN Kurang Bayar</span>
                  <strong className="font-num text-red-700">{formatRupiah(selisih)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Saldo Deposit Pajak Badan</span>
                  <strong className="font-num text-[#1A2B5F]">{formatRupiah(depositBalance)}</strong>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={depositBalance < selisih}
                  onClick={() => {
                    setPayModal(false);
                    requestTte({
                      title: 'Pemindahbukuan Saldo Deposit & Lapor SPT Masa PPN',
                      description: `Memotong Saldo Deposit sebesar ${formatRupiah(selisih)} dan langsung menerbitkan BPE.`,
                      onConfirm: () => {
                        const res = submitTaxReturn(taxReturn.id, 'DEPOSIT');
                        if (res.ok) onBack();
                      },
                    });
                  }}
                  className="w-full p-3 text-left border border-[#1A2B5F] bg-[#1A2B5F]/5 rounded-md hover:bg-[#1A2B5F]/10 disabled:opacity-40 cursor-pointer"
                >
                  <div className="font-bold text-[#1A2B5F]">1. Pemindahbukuan Saldo Deposit Pajak</div>
                  <div className="text-slate-600 mt-0.5">Langsung lunas dan status SPT menjadi DILAPORKAN (BPE terbit).</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPayModal(false);
                    requestTte({
                      title: 'Buat Kode Billing & Kirim SPT Masa PPN',
                      description: `Menerbitkan ID Billing sebesar ${formatRupiah(selisih)}. Status SPT menjadi Menunggu Pembayaran hingga Billing dilunasi.`,
                      onConfirm: () => {
                        const res = submitTaxReturn(taxReturn.id, 'BILLING');
                        if (res.ok) onBack();
                      },
                    });
                  }}
                  className="w-full p-3 text-left border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  <div className="font-bold text-slate-900">2. Buat Kode Billing (ID Billing 15 Digit)</div>
                  <div className="text-slate-600 mt-0.5">SPT masuk Menunggu Pembayaran; lunasi di menu Pembayaran untuk menerbitkan BPE.</div>
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPayModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
