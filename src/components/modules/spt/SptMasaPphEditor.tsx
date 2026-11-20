import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Send } from 'lucide-react';
import { useSimulator } from '../../../context/SimulatorContext';
import { formatRupiah, MASA_NAMES } from '../../../lib/taxCalculations';
import { SptPph21MasaPayload, SptUnifikasiPayload, TaxReturn } from '../../../types/tax';

interface Props {
  taxReturn: TaxReturn;
  onBack: () => void;
}

export const SptMasaPphEditor: React.FC<Props> = ({ taxReturn, onBack }) => {
  const {
    snapshot,
    updateTaxReturnPayload,
    postTaxReturnData,
    submitTaxReturn,
    requestTte,
    pushToast,
  } = useSimulator();

  const [payModal, setPayModal] = useState(false);

  if (!snapshot) return null;

  const isPph21 = taxReturn.returnType === 'PPH21_MASA';
  const readOnly = taxReturn.status === 'DILAPORKAN';
  const depositBalance = snapshot.workspace.badanProfile.depositBalance;

  const p21 = isPph21 ? (taxReturn.payload as SptPph21MasaPayload) : null;
  const pUnif = !isPph21 ? (taxReturn.payload as SptUnifikasiPayload) : null;

  const totalDue = isPph21
    ? p21!.pphPegawaiTetap + p21!.pphBukanPegawai + p21!.pphBpa1 - p21!.kompensasiSebelumnya
    : pUnif!.pph23Terutang + pUnif!.pph4Ayat2Terutang + pUnif!.pph22Terutang;

  const declarationChecked = isPph21 ? p21!.declarationChecked : pUnif!.declarationChecked;

  const linkedSlips = snapshot.ebupot.filter((s) =>
    isPph21
      ? s.masaPajak === taxReturn.masaPajak &&
        s.tahunPajak === taxReturn.tahunPajak &&
        s.status === 'TELAH_TERBIT' &&
        ['MP', 'BP21', 'BPA1', 'BPA2'].includes(s.slipType) &&
        s.issuerNpwp === snapshot.workspace.badanProfile.npwp
      : s.masaPajak === taxReturn.masaPajak &&
        s.tahunPajak === taxReturn.tahunPajak &&
        s.status === 'TELAH_TERBIT' &&
        s.slipType === 'BPPU' &&
        s.issuerNpwp === snapshot.workspace.badanProfile.npwp
  );

  const handleSubmitClick = () => {
    if (!declarationChecked) {
      pushToast('warning', 'Centang pernyataan kebenaran SPT terlebih dahulu.');
      return;
    }
    if (totalDue > 0) {
      setPayModal(true);
    } else {
      requestTte({
        title: `Lapor ${isPph21 ? 'SPT Masa PPh 21/26' : 'SPT Masa PPh Unifikasi'}`,
        description: `Status Nihil / Lebih Bayar (${formatRupiah(Math.abs(totalDue))}).`,
        onConfirm: () => {
          submitTaxReturn(taxReturn.id, 'NONE');
          onBack();
        },
      });
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <div>
            <div className="text-xs text-slate-500">
              {isPph21 ? 'SPT Masa PPh Pasal 21/26' : 'SPT Masa PPh Unifikasi (PPh 23/4(2)/22)'} ·{' '}
              {MASA_NAMES[taxReturn.masaPajak - 1]} {taxReturn.tahunPajak}
            </div>
            <h2 className="text-lg font-bold text-[#1A2B5F]">{snapshot.workspace.badanProfile.nama}</h2>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => postTaxReturnData(taxReturn.id)}
              className="px-3.5 py-2 border border-[#1A2B5F] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Posting SPT (Tarik e-Bupot)</span>
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Bayar dan Lapor</span>
            </button>
          </div>
        )}
      </div>

      {/* Induk Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
          Ringkasan Induk {isPph21 ? 'SPT Masa PPh 21/26' : 'SPT Masa PPh Unifikasi'}
        </h3>

        {isPph21 && p21 ? (
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 text-slate-700">1. Pegawai Tetap (e-Bupot MP TER) — {p21.jumlahPegawaiTetap} penerima</td>
                <td className="py-2.5 text-right font-num">Bruto: {formatRupiah(p21.brutoPegawaiTetap)}</td>
                <td className="py-2.5 text-right font-num font-semibold">{formatRupiah(p21.pphPegawaiTetap)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">2. Bukan Pegawai / Tenaga Ahli (e-Bupot BP 21) — {p21.jumlahBukanPegawai} penerima</td>
                <td className="py-2.5 text-right font-num">Bruto: {formatRupiah(p21.brutoBukanPegawai)}</td>
                <td className="py-2.5 text-right font-num font-semibold">{formatRupiah(p21.pphBukanPegawai)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">3. Masa Pajak Terakhir (BP A1 / A2) — {p21.jumlahBpa1} penerima</td>
                <td className="py-2.5 text-right text-slate-400">-</td>
                <td className="py-2.5 text-right font-num font-semibold">{formatRupiah(p21.pphBpa1)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700" colSpan={2}>4. Kompensasi Kelebihan Setor Masa Sebelumnya</td>
                <td className="py-2.5 text-right">
                  <input
                    type="number"
                    disabled={readOnly}
                    min={0}
                    value={p21.kompensasiSebelumnya}
                    onChange={(e) =>
                      updateTaxReturnPayload(taxReturn.id, {
                        ...p21,
                        kompensasiSebelumnya: Number(e.target.value) || 0,
                      })
                    }
                    className="w-40 h-8 px-2 text-right font-num border border-slate-300 rounded"
                  />
                </td>
              </tr>
              <tr className="bg-amber-50/70">
                <td className="py-3 font-bold text-[#1A2B5F]" colSpan={2}>
                  Total PPh Pasal 21/26 Kurang / (Lebih) Bayar
                </td>
                <td className="py-3 text-right font-num font-bold text-base text-[#1A2B5F]">
                  {formatRupiah(totalDue)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          pUnif && (
            <table className="w-full border-collapse">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2.5 text-slate-700">1. PPh Pasal 23 (e-Bupot BPPU) — {pUnif.jumlahBppu} bukti potong</td>
                  <td className="py-2.5 text-right font-num">DPP: {formatRupiah(pUnif.dppPph23)}</td>
                  <td className="py-2.5 text-right font-num font-semibold">{formatRupiah(pUnif.pph23Terutang)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-700" colSpan={2}>2. PPh Pasal 4 ayat (2) Final (Penyetoran Sendiri / Tambahan)</td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      disabled={readOnly}
                      min={0}
                      value={pUnif.pph4Ayat2Terutang}
                      onChange={(e) =>
                        updateTaxReturnPayload(taxReturn.id, {
                          ...pUnif,
                          pph4Ayat2Terutang: Number(e.target.value) || 0,
                        })
                      }
                      className="w-40 h-8 px-2 text-right font-num border border-slate-300 rounded"
                    />
                  </td>
                </tr>
                <tr className="bg-amber-50/70">
                  <td className="py-3 font-bold text-[#1A2B5F]" colSpan={2}>
                    Total PPh Unifikasi yang Harus Disetor
                  </td>
                  <td className="py-3 text-right font-num font-bold text-base text-[#1A2B5F]">
                    {formatRupiah(totalDue)}
                  </td>
                </tr>
              </tbody>
            </table>
          )
        )}

        <div className="pt-4 border-t border-slate-200">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={declarationChecked}
              onChange={(e) =>
                updateTaxReturnPayload(
                  taxReturn.id,
                  isPph21
                    ? { ...p21!, declarationChecked: e.target.checked }
                    : { ...pUnif!, declarationChecked: e.target.checked }
                )
              }
              className="mt-0.5"
            />
            <span className="text-slate-700 leading-relaxed">
              <strong>Pernyataan:</strong> Saya menyatakan bahwa seluruh bukti pemotongan dan perhitungan pajak pada SPT Masa ini telah benar, lengkap, dan jelas.
            </span>
          </label>
        </div>
      </div>

      {/* Linked e-Bupot Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden text-xs">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 font-bold text-[#1A2B5F]">
          Daftar e-Bupot Telah Terbit (Sumber Prepopulate Masa {MASA_NAMES[taxReturn.masaPajak - 1]} {taxReturn.tahunPajak})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#1A2B5F] text-white">
              <tr>
                <th className="text-left px-4 py-2.5">Nomor Bupot</th>
                <th className="text-left px-4 py-2.5">Jenis</th>
                <th className="text-left px-4 py-2.5">Penerima</th>
                <th className="text-left px-4 py-2.5">Kode Objek</th>
                <th className="text-right px-4 py-2.5">Bruto / DPP</th>
                <th className="text-right px-4 py-2.5">PPh Dipotong</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {linkedSlips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Belum ada e-Bupot berstatus TELAH_TERBIT pada masa pajak ini. Terbitkan di menu e-Bupot lalu klik Posting SPT.
                  </td>
                </tr>
              ) : (
                linkedSlips.map((sl) => (
                  <tr key={sl.id}>
                    <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{sl.slipNumber}</td>
                    <td className="px-4 py-2.5">{sl.slipType}</td>
                    <td className="px-4 py-2.5">{sl.recipientName}</td>
                    <td className="px-4 py-2.5 font-num">{sl.objectCode}</td>
                    <td className="px-4 py-2.5 text-right font-num">{formatRupiah(sl.grossAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-num font-semibold">{formatRupiah(sl.pphAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 font-bold text-sm">
              Pilih Metode Pembayaran SPT Masa
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Jumlah Harus Disetor</span>
                  <strong className="font-num text-red-700">{formatRupiah(totalDue)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Saldo Deposit Badan</span>
                  <strong className="font-num text-[#1A2B5F]">{formatRupiah(depositBalance)}</strong>
                </div>
              </div>
              <button
                type="button"
                disabled={depositBalance < totalDue}
                onClick={() => {
                  setPayModal(false);
                  requestTte({
                    title: 'Pemindahbukuan Saldo Deposit & Lapor SPT Masa',
                    description: `Memotong Deposit Pajak sebesar ${formatRupiah(totalDue)} dan langsung menerbitkan BPE.`,
                    onConfirm: () => {
                      const res = submitTaxReturn(taxReturn.id, 'DEPOSIT');
                      if (res.ok) onBack();
                    },
                  });
                }}
                className="w-full p-3 text-left border border-[#1A2B5F] bg-[#1A2B5F]/5 rounded-md hover:bg-[#1A2B5F]/10 disabled:opacity-40 cursor-pointer"
              >
                <div className="font-bold text-[#1A2B5F]">1. Pemindahbukuan Saldo Deposit</div>
                <div className="text-slate-600 mt-0.5">Langsung lunas & status menjadi DILAPORKAN.</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayModal(false);
                  requestTte({
                    title: 'Terbitkan Kode Billing SPT Masa',
                    description: `Membuat Kode Billing sebesar ${formatRupiah(totalDue)}. Lunasi di menu Pembayaran untuk menerbitkan BPE.`,
                    onConfirm: () => {
                      const res = submitTaxReturn(taxReturn.id, 'BILLING');
                      if (res.ok) onBack();
                    },
                  });
                }}
                className="w-full p-3 text-left border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <div className="font-bold text-slate-900">2. Buat Kode Billing (15 Digit)</div>
                <div className="text-slate-600 mt-0.5">Bayar via tombol Simulasi Bayar Billing di menu Pembayaran.</div>
              </button>
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
