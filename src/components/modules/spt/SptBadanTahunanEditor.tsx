import React, { useState } from 'react';
import { ArrowLeft, Plus, Send, Sparkles, Trash2 } from 'lucide-react';
import { useSimulator } from '../../../context/SimulatorContext';
import { createPresetSptBadanPayload } from '../../../lib/seedData';
import { calculateSptBadanSummary, formatRupiah, generateId } from '../../../lib/taxCalculations';
import { KoreksiFiskalItem, KreditPajakBadanItem, SptBadanTahunanPayload, TaxReturn } from '../../../types/tax';

interface Props {
  taxReturn: TaxReturn;
  onBack: () => void;
}

export const SptBadanTahunanEditor: React.FC<Props> = ({ taxReturn, onBack }) => {
  const {
    snapshot,
    updateTaxReturnPayload,
    submitTaxReturn,
    requestTte,
    pushToast,
  } = useSimulator();

  const [tab, setTab] = useState<'INDUK' | 'LABA_RUGI' | 'REKONSILIASI' | 'KREDIT'>('INDUK');
  const [payModal, setPayModal] = useState(false);

  // Add Koreksi Fiskal state
  const [korJenis, setKorJenis] = useState<'POSITIF' | 'NEGATIF'>('POSITIF');
  const [korAkun, setKorAkun] = useState('');
  const [korDasar, setKorDasar] = useState('Pasal 9 ayat (1) UU PPh');
  const [korNilai, setKorNilai] = useState(25_000_000);

  // Add Kredit Pajak state
  const [krPasal, setKrPasal] = useState<KreditPajakBadanItem['pasal']>('PPh 23');
  const [krPemotong, setKrPemotong] = useState('');
  const [krNomor, setKrNomor] = useState('BPPU-25-00192');
  const [krNilai, setKrNilai] = useState(15_000_000);

  if (!snapshot) return null;

  const payload = taxReturn.payload as SptBadanTahunanPayload;
  const readOnly = taxReturn.status === 'DILAPORKAN';
  const summary = calculateSptBadanSummary(payload);
  const depositBalance = snapshot.workspace.badanProfile.depositBalance;

  const patch = (updates: Partial<SptBadanTahunanPayload>) => {
    if (readOnly) return;
    updateTaxReturnPayload(taxReturn.id, { ...payload, ...updates });
  };

  const handleLoadPreset = () => {
    if (readOnly) return;
    updateTaxReturnPayload(taxReturn.id, createPresetSptBadanPayload());
    pushToast(
      'success',
      'Studi Kasus PT Simulasi (Omzet Rp12 M, Rekonsiliasi Fiskal, Fasilitas Pasal 31E & Kredit Pajak) dimuat.'
    );
  };

  const handleAddKoreksi = () => {
    if (!korAkun.trim()) return;
    const item: KoreksiFiskalItem = {
      id: generateId('kor'),
      jenis: korJenis,
      akun: korAkun.trim(),
      dasarHukum: korDasar.trim() || 'UU PPh',
      nilai: korNilai,
    };
    patch({ koreksiList: [...payload.koreksiList, item] });
    setKorAkun('');
  };

  const handleAddKredit = () => {
    if (!krPemotong.trim()) return;
    const item: KreditPajakBadanItem = {
      id: generateId('kr'),
      pasal: krPasal,
      pemotong: krPemotong.trim(),
      nomorBukti: krNomor.trim(),
      nilai: krNilai,
    };
    patch({ kreditPajakList: [...payload.kreditPajakList, item] });
    setKrPemotong('');
  };

  const handleTriggerSubmit = () => {
    if (!payload.declarationChecked) {
      pushToast('warning', 'Centang pernyataan kebenaran SPT PPh Badan pada tab Induk terlebih dahulu.');
      setTab('INDUK');
      return;
    }
    if (summary.selisih > 0) {
      setPayModal(true);
    } else {
      requestTte({
        title: `Lapor SPT Tahunan PPh Badan (${taxReturn.tahunPajak})`,
        description: `Status SPT: ${summary.taxPosition} (${formatRupiah(summary.amountDue)}).`,
        onConfirm: () => {
          submitTaxReturn(taxReturn.id, 'NONE');
          onBack();
        },
      });
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
              SPT Tahunan PPh Badan · Tahun Pajak {taxReturn.tahunPajak} · Tahun Buku {payload.tahunBuku}
            </div>
            <h2 className="text-lg font-bold text-[#1A2B5F]">{snapshot.workspace.badanProfile.nama}</h2>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadPreset}
              className="px-3 py-2 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Muat Studi Kasus PT Simulasi</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerSubmit}
              className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Bayar dan Lapor</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Fiscal KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">Laba Komersial</div>
          <div className="mt-1 font-num font-bold text-base text-slate-900">{formatRupiah(summary.labaKomersial)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">Penghasilan Neto Fiskal (PKP)</div>
          <div className="mt-1 font-num font-bold text-base text-[#1A2B5F]">{formatRupiah(summary.pkpRounded)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">PPh Badan Terutang</div>
          <div className="mt-1 font-num font-bold text-base text-slate-900">{formatRupiah(summary.pphTerutang)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">PPh Pasal 29 / 28A ({summary.taxPosition})</div>
          <div className={`mt-1 font-num font-bold text-base ${summary.selisih > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {formatRupiah(summary.amountDue)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full">
        {[
          { id: 'INDUK', label: 'Induk SPT & Tarif 22%/31E' },
          { id: 'LABA_RUGI', label: 'Laporan Laba Rugi Komersial' },
          { id: 'REKONSILIASI', label: `Rekonsiliasi Fiskal (${payload.koreksiList.length})` },
          { id: 'KREDIT', label: `Kredit Pajak (${payload.kreditPajakList.length} + PPh 25)` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              tab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB INDUK */}
      {tab === 'INDUK' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-[#1A2B5F]">
              Perhitungan PPh Badan Terutang & PPh Kurang / Lebih Bayar
            </h3>
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={payload.gunakanFasilitas31E}
                onChange={(e) => patch({ gunakanFasilitas31E: e.target.checked })}
              />
              <span>Terapkan Fasilitas Pengurangan Tarif Pasal 31E (Omzet ≤ Rp50 Miliar)</span>
            </label>
          </div>

          <table className="w-full border-collapse">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 text-slate-700">1. Laba / (Rugi) Bersih Komersial Sebelum Pajak</td>
                <td className="py-2.5 text-right font-num">{formatRupiah(summary.labaKomersial)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">2. Koreksi Fiskal Positif (+)</td>
                <td className="py-2.5 text-right font-num text-amber-700">+ {formatRupiah(summary.totalKoreksiPositif)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">3. Koreksi Fiskal Negatif (-)</td>
                <td className="py-2.5 text-right font-num text-emerald-700">- {formatRupiah(summary.totalKoreksiNegatif)}</td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold text-slate-900">4. Penghasilan Neto Fiskal</td>
                <td className="py-2.5 text-right font-num font-bold">{formatRupiah(summary.penghasilanNetoFiskal)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">5. Kompensasi Kerugian Fiskal Tahun Sebelumnya</td>
                <td className="py-2.5 text-right">
                  <input
                    type="number"
                    disabled={readOnly}
                    min={0}
                    value={payload.kompensasiKerugian}
                    onChange={(e) => patch({ kompensasiKerugian: Number(e.target.value) || 0 })}
                    className="w-44 h-8 px-2 text-right font-num border border-slate-300 rounded"
                  />
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-[#1A2B5F]">6. Penghasilan Kena Pajak (PKP dibulatkan ribuan)</td>
                <td className="py-2.5 text-right font-num font-bold text-[#1A2B5F]">{formatRupiah(summary.pkpRounded)}</td>
              </tr>
              {summary.eligible31E ? (
                <>
                  <tr className="bg-slate-50/70">
                    <td className="py-2 pl-4 text-slate-600">
                      Bagian PKP Fasilitas Pasal 31E (11% × {formatRupiah(summary.pkpFasilitas)})
                    </td>
                    <td className="py-2 text-right font-num">{formatRupiah(summary.pphFasilitas)}</td>
                  </tr>
                  <tr className="bg-slate-50/70">
                    <td className="py-2 pl-4 text-slate-600">
                      Bagian PKP Non-Fasilitas (22% × {formatRupiah(summary.pkpNonFasilitas)})
                    </td>
                    <td className="py-2 text-right font-num">{formatRupiah(summary.pphNonFasilitas)}</td>
                  </tr>
                </>
              ) : (
                <tr className="bg-slate-50/70">
                  <td className="py-2 pl-4 text-slate-600">Tarif Umum PPh Badan (22% × {formatRupiah(summary.pkpRounded)})</td>
                  <td className="py-2 text-right font-num">{formatRupiah(summary.pphTerutang)}</td>
                </tr>
              )}
              <tr>
                <td className="py-2.5 font-bold text-slate-900">7. PPh Badan Terutang</td>
                <td className="py-2.5 text-right font-num font-bold">{formatRupiah(summary.pphTerutang)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">8. Kredit Pajak Dipotong / Dipungut Pihak Lain (PPh 22/23/24)</td>
                <td className="py-2.5 text-right font-num text-emerald-700">- {formatRupiah(summary.totalKreditBuktiPotong)}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-slate-700">9. PPh Dibayar Sendiri (Angsuran PPh Pasal 25 Setahun)</td>
                <td className="py-2.5 text-right font-num text-emerald-700">- {formatRupiah(payload.angsuranPph25Setahun)}</td>
              </tr>
              <tr className="bg-amber-50/70">
                <td className="py-3 font-bold text-[#1A2B5F]">
                  10. PPh Pasal 29 (Kurang Bayar) / Pasal 28A (Lebih Bayar) — {summary.taxPosition}
                </td>
                <td className="py-3 text-right font-num font-bold text-base text-[#1A2B5F]">
                  {formatRupiah(summary.selisih)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="pt-4 border-t border-slate-200">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={payload.declarationChecked}
                onChange={(e) => patch({ declarationChecked: e.target.checked })}
                className="mt-0.5"
              />
              <span className="text-slate-700 leading-relaxed">
                <strong>Pernyataan Pengurus / Kuasa WP Badan:</strong> Saya menyatakan bahwa Laporan Laba Rugi, Rekonsiliasi Fiskal, dan perhitungan PPh Badan di atas adalah benar, lengkap, dan jelas.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* TAB LABA RUGI */}
      {tab === 'LABA_RUGI' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
          <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
            Laporan Laba Rugi Komersial (Lampiran L-1B)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Peredaran Usaha (Omzet Bruto)</label>
              <input
                type="number"
                disabled={readOnly}
                value={payload.peredaranUsaha}
                onChange={(e) => patch({ peredaranUsaha: Number(e.target.value) || 0 })}
                className="w-full h-9 px-3 border border-slate-300 rounded font-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Harga Pokok Penjualan (HPP)</label>
              <input
                type="number"
                disabled={readOnly}
                value={payload.hpp}
                onChange={(e) => patch({ hpp: Number(e.target.value) || 0 })}
                className="w-full h-9 px-3 border border-slate-300 rounded font-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Beban Operasional / Usaha</label>
              <input
                type="number"
                disabled={readOnly}
                value={payload.bebanUsaha}
                onChange={(e) => patch({ bebanUsaha: Number(e.target.value) || 0 })}
                className="w-full h-9 px-3 border border-slate-300 rounded font-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Penghasilan dari Luar Usaha (Bunga/Sewa/dll)</label>
              <input
                type="number"
                disabled={readOnly}
                value={payload.penghasilanLuarUsaha}
                onChange={(e) => patch({ penghasilanLuarUsaha: Number(e.target.value) || 0 })}
                className="w-full h-9 px-3 border border-slate-300 rounded font-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Beban dari Luar Usaha</label>
              <input
                type="number"
                disabled={readOnly}
                value={payload.bebanLuarUsaha}
                onChange={(e) => patch({ bebanLuarUsaha: Number(e.target.value) || 0 })}
                className="w-full h-9 px-3 border border-slate-300 rounded font-num"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Laba Bersih Komersial Sebelum Pajak</label>
              <div className="h-9 px-3 bg-slate-100 border border-slate-200 rounded flex items-center font-num font-bold text-[#1A2B5F]">
                {formatRupiah(summary.labaKomersial)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB REKONSILIASI FISKAL */}
      {tab === 'REKONSILIASI' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-[#1A2B5F]">
              Rekonsiliasi Fiskal (Penyesuaian Fiskal Positif & Negatif)
            </h3>
            <div className="font-num">
              Positif: <strong className="text-amber-700">+{formatRupiah(summary.totalKoreksiPositif)}</strong> · Negatif:{' '}
              <strong className="text-emerald-700">-{formatRupiah(summary.totalKoreksiNegatif)}</strong>
            </div>
          </div>

          {!readOnly && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">Jenis Koreksi</label>
                <select
                  value={korJenis}
                  onChange={(e) => setKorJenis(e.target.value as 'POSITIF' | 'NEGATIF')}
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                >
                  <option value="POSITIF">Koreksi Positif (+)</option>
                  <option value="NEGATIF">Koreksi Negatif (-)</option>
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold mb-1">Akun / Uraian Penyesuaian</label>
                <input
                  type="text"
                  value={korAkun}
                  onChange={(e) => setKorAkun(e.target.value)}
                  placeholder="Contoh: Biaya Sanksi Pajak / Bunga Deposito"
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">Dasar Hukum</label>
                <input
                  type="text"
                  value={korDasar}
                  onChange={(e) => setKorDasar(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">Nilai (Rp)</label>
                <input
                  type="number"
                  value={korNilai}
                  onChange={(e) => setKorNilai(Number(e.target.value) || 0)}
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddKoreksi}
                  className="w-full h-8 bg-[#1A2B5F] text-white font-bold rounded inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          )}

          <table className="w-full">
            <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2">Jenis</th>
                <th className="text-left px-3 py-2">Uraian Penyesuaian Fiskal</th>
                <th className="text-left px-3 py-2">Dasar Hukum</th>
                <th className="text-right px-3 py-2">Nominal</th>
                {!readOnly && <th className="text-right px-3 py-2">Hapus</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payload.koreksiList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Belum ada koreksi fiskal. Tambahkan manual atau klik <strong>Muat Studi Kasus PT Simulasi</strong>.
                  </td>
                </tr>
              ) : (
                payload.koreksiList.map((k) => (
                  <tr key={k.id}>
                    <td className={`px-3 py-2 font-bold ${k.jenis === 'POSITIF' ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {k.jenis}
                    </td>
                    <td className="px-3 py-2">{k.akun}</td>
                    <td className="px-3 py-2 text-slate-500">{k.dasarHukum}</td>
                    <td className="px-3 py-2 text-right font-num font-semibold">{formatRupiah(k.nilai)}</td>
                    {!readOnly && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => patch({ koreksiList: payload.koreksiList.filter((x) => x.id !== k.id) })}
                          className="text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB KREDIT PAJAK */}
      {tab === 'KREDIT' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-[#1A2B5F]">
              Daftar Kredit Pajak Dalam Negeri (PPh 22, 23, 24) & Angsuran PPh 25
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-slate-600">Angsuran PPh 25 Setahun:</span>
              <input
                type="number"
                disabled={readOnly}
                value={payload.angsuranPph25Setahun}
                onChange={(e) => patch({ angsuranPph25Setahun: Number(e.target.value) || 0 })}
                className="w-40 h-8 px-2 text-right font-num border border-slate-300 rounded"
              />
            </div>
          </div>

          {!readOnly && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">Pasal</label>
                <select
                  value={krPasal}
                  onChange={(e) => setKrPasal(e.target.value as KreditPajakBadanItem['pasal'])}
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                >
                  <option value="PPh 23">PPh 23</option>
                  <option value="PPh 22">PPh 22</option>
                  <option value="PPh 24">PPh 24</option>
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold mb-1">Pemotong / Pemungut Pajak</label>
                <input
                  type="text"
                  value={krPemotong}
                  onChange={(e) => setKrPemotong(e.target.value)}
                  placeholder="Contoh: PT Klien Korporasi"
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">No. Bukti Potong</label>
                <input
                  type="text"
                  value={krNomor}
                  onChange={(e) => setKrNomor(e.target.value)}
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold mb-1">Nilai Kredit (Rp)</label>
                <input
                  type="number"
                  value={krNilai}
                  onChange={(e) => setKrNilai(Number(e.target.value) || 0)}
                  className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddKredit}
                  className="w-full h-8 bg-[#1A2B5F] text-white font-bold rounded cursor-pointer"
                >
                  + Tambah
                </button>
              </div>
            </div>
          )}

          <table className="w-full">
            <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2">Pasal</th>
                <th className="text-left px-3 py-2">Pemotong / Pemungut</th>
                <th className="text-left px-3 py-2">Nomor Bukti</th>
                <th className="text-right px-3 py-2">Nilai Kredit Pajak</th>
                {!readOnly && <th className="text-right px-3 py-2">Hapus</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payload.kreditPajakList.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-semibold">{c.pasal}</td>
                  <td className="px-3 py-2">{c.pemotong}</td>
                  <td className="px-3 py-2 font-num">{c.nomorBukti}</td>
                  <td className="px-3 py-2 text-right font-num font-semibold text-emerald-700">{formatRupiah(c.nilai)}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => patch({ kreditPajakList: payload.kreditPajakList.filter((x) => x.id !== c.id) })}
                        className="text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {payload.kreditPajakList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                    Belum ada bukti kredit pajak PPh 22/23/24.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 font-bold text-sm">
              Pelunasan PPh Pasal 29 Badan
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">PPh Pasal 29 Kurang Bayar</span>
                  <strong className="font-num text-red-700">{formatRupiah(summary.selisih)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Saldo Deposit Badan</span>
                  <strong className="font-num text-[#1A2B5F]">{formatRupiah(depositBalance)}</strong>
                </div>
              </div>
              <button
                type="button"
                disabled={depositBalance < summary.selisih}
                onClick={() => {
                  setPayModal(false);
                  requestTte({
                    title: 'Pemindahbukuan Deposit & Lapor SPT Tahunan PPh Badan',
                    description: `Memotong saldo deposit sebesar ${formatRupiah(summary.selisih)} dan langsung menerbitkan BPE.`,
                    onConfirm: () => {
                      const res = submitTaxReturn(taxReturn.id, 'DEPOSIT');
                      if (res.ok) onBack();
                    },
                  });
                }}
                className="w-full p-3 text-left border border-[#1A2B5F] bg-[#1A2B5F]/5 rounded-md disabled:opacity-40 cursor-pointer"
              >
                <div className="font-bold text-[#1A2B5F]">1. Pemindahbukuan Saldo Deposit Pajak</div>
                <div className="text-slate-600 mt-0.5">Langsung lunas & status SPT menjadi DILAPORKAN.</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayModal(false);
                  requestTte({
                    title: 'Buat Kode Billing PPh Pasal 29 Badan',
                    description: `Menerbitkan ID Billing sebesar ${formatRupiah(summary.selisih)}. Lunasi di menu Pembayaran untuk menerbitkan BPE.`,
                    onConfirm: () => {
                      const res = submitTaxReturn(taxReturn.id, 'BILLING');
                      if (res.ok) onBack();
                    },
                  });
                }}
                className="w-full p-3 text-left border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <div className="font-bold text-slate-900">2. Buat Kode Billing (15 Digit)</div>
                <div className="text-slate-600 mt-0.5">Lunasi melalui tombol Simulasi Bayar Billing di menu Pembayaran.</div>
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
