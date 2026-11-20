import React, { useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import { useSimulator } from '../../../context/SimulatorContext';
import { createTuanAPresetOpPayload } from '../../../lib/seedData';
import { calculateSptOpSummary, formatRupiah, generateId, PTKP_VALUES } from '../../../lib/taxCalculations';
import { HartaItem, SptOpTahunanPayload, TaxReturn } from '../../../types/tax';

interface Props {
  taxReturn: TaxReturn;
  onBack: () => void;
}

const HARTA_SUBCATEGORIES: { id: HartaItem['subCategory']; label: string; defaultKode: string }[] = [
  { id: 'KAS', label: 'Kas & Setara Kas', defaultKode: '011' },
  { id: 'PIUTANG', label: 'Piutang', defaultKode: '021' },
  { id: 'INVESTASI', label: 'Investasi / Saham / Obligasi', defaultKode: '031' },
  { id: 'HARTA_BERGERAK', label: 'Harta Bergerak (Kendaraan)', defaultKode: '043' },
  { id: 'HARTA_TIDAK_BERGERAK', label: 'Harta Tidak Bergerak (Tanah/Bangunan)', defaultKode: '061' },
  { id: 'HARTA_LAINNYA', label: 'Harta Lainnya (Logam Mulia/dll)', defaultKode: '051' },
];

export const SptOpTahunanEditor: React.FC<Props> = ({ taxReturn, onBack }) => {
  const {
    snapshot,
    updateTaxReturnPayload,
    postTaxReturnData,
    submitTaxReturn,
    requestTte,
    pushToast,
  } = useSimulator();

  const [activeTab, setActiveTab] = useState<'INDUK' | 'L1' | 'L2'>('INDUK');
  const [payModal, setPayModal] = useState(false);

  // Quick-add states for L-1 & L-2
  const [newHartaSub, setNewHartaSub] = useState<HartaItem['subCategory']>('KAS');
  const [newHartaDesc, setNewHartaDesc] = useState('');
  const [newHartaYear, setNewHartaYear] = useState(2025);
  const [newHartaVal, setNewHartaVal] = useState(50_000_000);

  const [newUtangLender, setNewUtangLender] = useState('');
  const [newUtangYear, setNewUtangYear] = useState(2025);
  const [newUtangSaldo, setNewUtangSaldo] = useState(50_000_000);

  const [newKelNama, setNewKelNama] = useState('');
  const [newKelNik, setNewKelNik] = useState('');
  const [newKelHub, setNewKelHub] = useState('Anak Kandung');

  const [newFinalJenis, setNewFinalJenis] = useState('Peredaran Bruto UMKM (PP 55/2022 — 0,5%)');
  const [newFinalDpp, setNewFinalDpp] = useState(120_000_000);
  const [newFinalTarif, setNewFinalTarif] = useState(0.5);

  if (!snapshot) return null;

  const payload = taxReturn.payload as SptOpTahunanPayload;
  const readOnly = taxReturn.status === 'DILAPORKAN';
  const summary = calculateSptOpSummary(payload);
  const depositBalance = snapshot.workspace.opProfile.depositBalance;

  const patch = (updates: Partial<SptOpTahunanPayload>) => {
    if (readOnly) return;
    updateTaxReturnPayload(taxReturn.id, { ...payload, ...updates });
  };

  const handleLoadTuanA = () => {
    if (readOnly) return;
    updateTaxReturnPayload(taxReturn.id, createTuanAPresetOpPayload());
    pushToast(
      'success',
      'Data Studi Kasus Tuan A (Bruto Rp533,5 jt, PKP Rp473,5 jt, PPh Rp87,375 jt Nihil, Harta & Utang) dimuat.'
    );
  };

  const handleAddHarta = () => {
    if (!newHartaDesc.trim()) return;
    const cat = HARTA_SUBCATEGORIES.find((c) => c.id === newHartaSub)!;
    patch({
      hartaList: [
        ...payload.hartaList,
        {
          id: generateId('harta'),
          subCategory: newHartaSub,
          kodeHarta: cat.defaultKode,
          deskripsi: newHartaDesc.trim(),
          tahunPerolehan: newHartaYear,
          hargaPerolehan: newHartaVal,
          nilaiSaatIni: newHartaVal,
          keterangan: 'Milik Sendiri',
        },
      ],
    });
    setNewHartaDesc('');
  };

  const handleAddUtang = () => {
    if (!newUtangLender.trim()) return;
    patch({
      utangList: [
        ...payload.utangList,
        {
          id: generateId('utg'),
          kodeUtang: '101',
          namaPemberiPinjaman: newUtangLender.trim(),
          tahunPinjam: newUtangYear,
          saldoAkhir: newUtangSaldo,
        },
      ],
    });
    setNewUtangLender('');
  };

  const handleAddKeluarga = () => {
    if (!newKelNama.trim()) return;
    patch({
      keluargaList: [
        ...payload.keluargaList,
        {
          id: generateId('kel'),
          nama: newKelNama.trim(),
          nik: newKelNik.replace(/\D/g, '').padEnd(16, '0').slice(0, 16),
          hubungan: newKelHub,
          pekerjaan: 'Pelajar / Anggota Keluarga',
        },
      ],
    });
    setNewKelNama('');
    setNewKelNik('');
  };

  const handleAddFinal = () => {
    const pph = Math.round((newFinalDpp * newFinalTarif) / 100);
    patch({
      hasPenghasilanFinal: true,
      penghasilanFinalList: [
        ...payload.penghasilanFinalList,
        {
          id: generateId('fin'),
          jenis: newFinalJenis,
          dasarPengenaan: newFinalDpp,
          tarifPersen: newFinalTarif,
          pphTerutang: pph,
        },
      ],
    });
  };

  const handleTriggerSubmit = () => {
    if (!payload.declarationChecked) {
      pushToast('warning', 'Centang Pernyataan Bagian K pada tab Induk SPT terlebih dahulu.');
      setActiveTab('INDUK');
      return;
    }
    if (summary.selisih > 0) {
      setPayModal(true);
    } else {
      requestTte({
        title: `Lapor SPT Tahunan Orang Pribadi (${taxReturn.tahunPajak})`,
        description: `Status SPT: ${summary.taxPosition} (${formatRupiah(summary.amountDue)}). Menandatangani dengan Kode Otorisasi DJP untuk menerbitkan BPE.`,
        onConfirm: () => {
          submitTaxReturn(taxReturn.id, 'NONE');
          onBack();
        },
      });
    }
  };

  const myBpaSlips = snapshot.ebupot.filter(
    (s) => s.recipientNik === snapshot.workspace.nik && s.status === 'TELAH_TERBIT'
  );

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header Toolbar */}
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
              SPT Tahunan PPh Orang Pribadi · Tahun Pajak {taxReturn.tahunPajak} ·{' '}
              {taxReturn.pembetulanKe === 0 ? 'Normal' : `Pembetulan ke-${taxReturn.pembetulanKe}`}
            </div>
            <h2 className="text-lg font-bold text-[#1A2B5F]">{snapshot.workspace.opProfile.nama}</h2>
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadTuanA}
              className="px-3 py-2 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Muat Preset Tuan A</span>
            </button>
            <button
              type="button"
              onClick={() => postTaxReturnData(taxReturn.id)}
              className="px-3.5 py-2 border border-[#1A2B5F] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Posting SPT (BPA1)</span>
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

      {/* Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">Penghasilan Neto Total</div>
          <div className="mt-1 font-num font-bold text-base text-slate-900">
            {formatRupiah(summary.totalPenghasilanNeto)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">PKP ({payload.ptkpStatus}: {formatRupiah(summary.ptkp)})</div>
          <div className="mt-1 font-num font-bold text-base text-slate-900">{formatRupiah(summary.pkpRounded)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">PPh Terutang / Kredit Pajak</div>
          <div className="mt-1 font-num font-bold text-base text-[#1A2B5F]">
            {formatRupiah(summary.pphTerutang)} / {formatRupiah(summary.totalKredit)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-slate-500">Status SPT ({summary.taxPosition})</div>
          <div
            className={`mt-1 font-num font-bold text-base ${
              summary.selisih > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {formatRupiah(summary.amountDue)}
          </div>
        </div>
      </div>

      {/* Tabs: Induk / L-1 / L-2 */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
        {[
          { id: 'INDUK', label: 'Induk SPT (Bagian A–K)' },
          { id: 'L1', label: `Lampiran L-1 (Harta ${payload.hartaList.length} · Utang ${payload.utangList.length})` },
          { id: 'L2', label: `Lampiran L-2 (Final ${payload.penghasilanFinalList.length} · LN)` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              activeTab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB INDUK A-K */}
      {activeTab === 'INDUK' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 text-xs">
          {/* Header & Bagian A */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
              Bagian A. Identitas & Header SPT
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sumber Penghasilan</label>
                <select
                  disabled={readOnly}
                  value={payload.sumberPenghasilan}
                  onChange={(e) =>
                    patch({ sumberPenghasilan: e.target.value as SptOpTahunanPayload['sumberPenghasilan'] })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                >
                  <option value="PEKERJAAN">Pekerjaan (Karyawan)</option>
                  <option value="USAHA_BEBAS">Kegiatan Usaha / Pekerjaan Bebas</option>
                  <option value="CAMPURAN">Pekerjaan & Usaha / Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Pencatatan</label>
                <select
                  disabled={readOnly}
                  value={payload.metodePembukuan}
                  onChange={(e) =>
                    patch({ metodePembukuan: e.target.value as SptOpTahunanPayload['metodePembukuan'] })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                >
                  <option value="PENCATATAN">Pencatatan (NPPN / Karyawan)</option>
                  <option value="PEMBUKUAN">Pembukuan</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Perpajakan Suami-Istri</label>
                <select
                  disabled={readOnly}
                  value={payload.statusKewajibanSuamiIstri}
                  onChange={(e) =>
                    patch({
                      statusKewajibanSuamiIstri: e.target.value as SptOpTahunanPayload['statusKewajibanSuamiIstri'],
                    })
                  }
                  className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                >
                  <option value="KK">KK — Kepala Keluarga / Tidak Kawin</option>
                  <option value="HB">HB — Hidup Berpisah</option>
                  <option value="PH">PH — Pisah Harta</option>
                  <option value="MT">MT — Memilih Terpisah</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status PTKP</label>
                <select
                  disabled={readOnly}
                  value={payload.ptkpStatus}
                  onChange={(e) => patch({ ptkpStatus: e.target.value })}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                >
                  {Object.entries(PTKP_VALUES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {k} ({formatRupiah(v)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bagian B: Pertanyaan Dinamis Ya/Tidak & Penghasilan Neto */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
              Bagian B. Ikhtisar Penghasilan Neto (Pertanyaan Dinamis Coretax)
            </h3>

            {/* 1. Pekerjaan */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-slate-900">
                  1. Apakah Anda menerima penghasilan dalam negeri dari pekerjaan (Karyawan / BPA1)?
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      disabled={readOnly}
                      checked={payload.hasPenghasilanPekerjaan}
                      onChange={() => patch({ hasPenghasilanPekerjaan: true })}
                    />
                    <span>Ya</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      disabled={readOnly}
                      checked={!payload.hasPenghasilanPekerjaan}
                      onChange={() => patch({ hasPenghasilanPekerjaan: false })}
                    />
                    <span>Tidak</span>
                  </label>
                </div>
              </div>

              {payload.hasPenghasilanPekerjaan && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-slate-600 mb-1">Penghasilan Bruto Setahun</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={payload.brutoPekerjaan}
                      onChange={(e) => patch({ brutoPekerjaan: Number(e.target.value) || 0 })}
                      className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Biaya Jabatan (Maks 6 Juta)</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={payload.biayaJabatan}
                      onChange={(e) => patch({ biayaJabatan: Number(e.target.value) || 0 })}
                      className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Iuran Pensiun / THT</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={payload.iuranPensiun}
                      onChange={(e) => patch({ iuranPensiun: Number(e.target.value) || 0 })}
                      className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Penghasilan Neto Pekerjaan</label>
                    <div className="h-9 px-2.5 bg-slate-100 border border-slate-200 rounded flex items-center font-num font-bold text-[#1A2B5F]">
                      {formatRupiah(summary.netoPekerjaan)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Usaha / Pekerjaan Bebas */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-slate-900">
                  2. Apakah Anda menerima penghasilan dari usaha atau pekerjaan bebas (Norma / Pembukuan)?
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      disabled={readOnly}
                      checked={payload.hasPenghasilanUsaha}
                      onChange={() => patch({ hasPenghasilanUsaha: true })}
                    />
                    <span>Ya</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      disabled={readOnly}
                      checked={!payload.hasPenghasilanUsaha}
                      onChange={() => patch({ hasPenghasilanUsaha: false })}
                    />
                    <span>Tidak</span>
                  </label>
                </div>
              </div>

              {payload.hasPenghasilanUsaha && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-slate-600 mb-1">Peredaran Bruto Usaha / Bebas</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      value={payload.peredaranBrutoUsaha}
                      onChange={(e) => patch({ peredaranBrutoUsaha: Number(e.target.value) || 0 })}
                      className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Persentase Norma (NPPN %)</label>
                    <input
                      type="number"
                      disabled={readOnly}
                      min={1}
                      max={100}
                      value={payload.normaPersen}
                      onChange={(e) => patch({ normaPersen: Number(e.target.value) || 0 })}
                      className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Penghasilan Neto Usaha</label>
                    <div className="h-9 px-2.5 bg-slate-100 border border-slate-200 rounded flex items-center font-num font-bold text-[#1A2B5F]">
                      {formatRupiah(summary.netoUsaha)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bagian C-E: Perhitungan PPh Pasal 17 & Kredit Pajak */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
              Bagian C – E. Perhitungan PPh Terutang (Tarif Progresif Pasal 17 UU HPP) & Kredit Pajak
            </h3>

            <table className="w-full border-collapse">
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2 text-slate-700">Jumlah Penghasilan Neto (DN + LN)</td>
                  <td className="py-2 text-right font-num font-semibold">{formatRupiah(summary.totalPenghasilanNeto)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-700">Penghasilan Tidak Kena Pajak (PTKP {payload.ptkpStatus})</td>
                  <td className="py-2 text-right font-num">{formatRupiah(summary.ptkp)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-semibold text-slate-900">Penghasilan Kena Pajak (PKP dibulatkan ribuan)</td>
                  <td className="py-2 text-right font-num font-bold">{formatRupiah(summary.pkpRounded)}</td>
                </tr>
                {summary.layers.map((l) => (
                  <tr key={l.label} className="bg-slate-50/70">
                    <td className="py-1.5 pl-4 text-slate-600">
                      {l.label} ({l.rate}% × {formatRupiah(l.base)})
                    </td>
                    <td className="py-1.5 text-right font-num text-slate-700">{formatRupiah(l.tax)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 font-bold text-[#1A2B5F]">PPh Terutang Setahun</td>
                  <td className="py-2.5 text-right font-num font-bold text-[#1A2B5F]">{formatRupiah(summary.pphTerutang)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-700">Kredit Pajak yang Dipotong Pihak Lain (BPA1 / BPA2)</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      disabled={readOnly}
                      value={payload.kreditPajakDipungut}
                      onChange={(e) => patch({ kreditPajakDipungut: Number(e.target.value) || 0 })}
                      className="w-44 h-8 px-2 text-right font-num border border-slate-300 rounded"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-700">PPh yang Dibayar Sendiri (Angsuran PPh Pasal 25)</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      disabled={readOnly}
                      value={payload.angsuranPph25}
                      onChange={(e) => patch({ angsuranPph25: Number(e.target.value) || 0 })}
                      className="w-44 h-8 px-2 text-right font-num border border-slate-300 rounded"
                    />
                  </td>
                </tr>
                <tr className="bg-amber-50/70">
                  <td className="py-3 font-bold text-[#1A2B5F]">
                    PPh Kurang / (Lebih) Bayar — {summary.taxPosition}
                  </td>
                  <td className="py-3 text-right font-num font-bold text-base text-[#1A2B5F]">
                    {formatRupiah(summary.selisih)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bagian K: Pernyataan */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-[#1A2B5F] mb-2">Bagian K. Pernyataan Wajib Pajak</h3>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={payload.declarationChecked}
                onChange={(e) => patch({ declarationChecked: e.target.checked })}
                className="mt-0.5"
              />
              <span className="text-slate-700 leading-relaxed">
                Dengan menyadari sepenuhnya akan segala akibatnya termasuk sanksi-sanksi sesuai ketentuan peraturan perundang-undangan yang berlaku, saya menyatakan bahwa apa yang telah saya beritahukan di atas beserta lampiran-lampirannya adalah benar, lengkap, dan jelas.
              </span>
            </label>
          </div>
        </div>
      )}

      {/* TAB LAMPIRAN L-1 */}
      {activeTab === 'L1' && (
        <div className="space-y-5 text-xs">
          {/* A. Daftar Harta (6 Sub-Tabel & Ikhtisar) */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#1A2B5F]">
                  L-1 Bagian A. Daftar Harta pada Akhir Tahun Pajak
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Mencakup 6 sub-kategori: Kas, Piutang, Investasi, Harta Bergerak, Harta Tidak Bergerak, dan Harta Lainnya.
                </p>
              </div>
              <div className="text-right">
                <div className="text-slate-500">Ikhtisar Total Harta</div>
                <div className="font-num font-bold text-sm text-[#1A2B5F]">{formatRupiah(summary.totalHarta)}</div>
              </div>
            </div>

            {!readOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Sub-Kategori Harta</label>
                  <select
                    value={newHartaSub}
                    onChange={(e) => setNewHartaSub(e.target.value as HartaItem['subCategory'])}
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                  >
                    {HARTA_SUBCATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Deskripsi Harta</label>
                  <input
                    type="text"
                    value={newHartaDesc}
                    onChange={(e) => setNewHartaDesc(e.target.value)}
                    placeholder="Contoh: Tabungan Bank / Mobil MPV"
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tahun</label>
                  <input
                    type="number"
                    value={newHartaYear}
                    onChange={(e) => setNewHartaYear(Number(e.target.value))}
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nilai (Rp)</label>
                  <input
                    type="number"
                    value={newHartaVal}
                    onChange={(e) => setNewHartaVal(Number(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddHarta}
                    className="w-full h-8 bg-[#1A2B5F] text-white font-bold rounded hover:bg-[#111D42] inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>
            )}

            <table className="w-full border-collapse">
              <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2">Kategori</th>
                  <th className="text-left px-3 py-2">Deskripsi Harta</th>
                  <th className="text-left px-3 py-2">Tahun</th>
                  <th className="text-right px-3 py-2">Nilai Akhir Tahun</th>
                  {!readOnly && <th className="text-right px-3 py-2">Hapus</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payload.hartaList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                      Belum ada daftar harta. Tambahkan secara manual atau klik <strong>Muat Preset Tuan A</strong>.
                    </td>
                  </tr>
                ) : (
                  payload.hartaList.map((h) => (
                    <tr key={h.id}>
                      <td className="px-3 py-2 font-medium">{h.subCategory.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2">{h.deskripsi}</td>
                      <td className="px-3 py-2 font-num">{h.tahunPerolehan}</td>
                      <td className="px-3 py-2 text-right font-num font-semibold">{formatRupiah(h.nilaiSaatIni)}</td>
                      {!readOnly && (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              patch({ hartaList: payload.hartaList.filter((item) => item.id !== h.id) })
                            }
                            className="text-red-600 hover:text-red-800 cursor-pointer"
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
          </section>

          {/* B. Daftar Utang & C. Keluarga */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-[#1A2B5F]">L-1 Bagian B. Daftar Utang</h3>
                <span className="font-num font-bold text-[#1A2B5F]">{formatRupiah(summary.totalUtang)}</span>
              </div>
              {!readOnly && (
                <div className="grid grid-cols-12 gap-2 items-end">
                  <input
                    type="text"
                    placeholder="Nama Bank / Pemberi Pinjaman"
                    value={newUtangLender}
                    onChange={(e) => setNewUtangLender(e.target.value)}
                    className="col-span-5 h-8 px-2 border border-slate-300 rounded"
                  />
                  <input
                    type="number"
                    value={newUtangYear}
                    onChange={(e) => setNewUtangYear(Number(e.target.value))}
                    className="col-span-2 h-8 px-2 border border-slate-300 rounded font-num"
                  />
                  <input
                    type="number"
                    value={newUtangSaldo}
                    onChange={(e) => setNewUtangSaldo(Number(e.target.value) || 0)}
                    className="col-span-3 h-8 px-2 border border-slate-300 rounded font-num"
                  />
                  <button
                    type="button"
                    onClick={handleAddUtang}
                    className="col-span-2 h-8 bg-[#1A2B5F] text-white font-bold rounded cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              )}
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  {payload.utangList.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2">{u.namaPemberiPinjaman} ({u.tahunPinjam})</td>
                      <td className="py-2 text-right font-num font-semibold">{formatRupiah(u.saldoAkhir)}</td>
                      {!readOnly && (
                        <td className="py-2 text-right w-8">
                          <button
                            type="button"
                            onClick={() => patch({ utangList: payload.utangList.filter((x) => x.id !== u.id) })}
                            className="text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {payload.utangList.length === 0 && (
                    <tr>
                      <td className="py-4 text-center text-slate-500">Tidak ada daftar utang.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-[#1A2B5F]">L-1 Bagian C. Anggota Keluarga</h3>
                <span className="text-slate-500">{payload.keluargaList.length} orang</span>
              </div>
              {!readOnly && (
                <div className="grid grid-cols-12 gap-2 items-end">
                  <input
                    type="text"
                    placeholder="Nama Anggota Keluarga"
                    value={newKelNama}
                    onChange={(e) => setNewKelNama(e.target.value)}
                    className="col-span-4 h-8 px-2 border border-slate-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="NIK 16 Digit"
                    value={newKelNik}
                    onChange={(e) => setNewKelNik(e.target.value)}
                    className="col-span-4 h-8 px-2 border border-slate-300 rounded font-num"
                  />
                  <input
                    type="text"
                    placeholder="Hubungan"
                    value={newKelHub}
                    onChange={(e) => setNewKelHub(e.target.value)}
                    className="col-span-2 h-8 px-2 border border-slate-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeluarga}
                    className="col-span-2 h-8 bg-[#1A2B5F] text-white font-bold rounded cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              )}
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  {payload.keluargaList.map((k) => (
                    <tr key={k.id}>
                      <td className="py-2 font-medium">{k.nama}</td>
                      <td className="py-2 font-num text-slate-600">{k.nik}</td>
                      <td className="py-2 text-slate-600">{k.hubungan}</td>
                      {!readOnly && (
                        <td className="py-2 text-right w-8">
                          <button
                            type="button"
                            onClick={() => patch({ keluargaList: payload.keluargaList.filter((x) => x.id !== k.id) })}
                            className="text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {payload.keluargaList.length === 0 && (
                    <tr>
                      <td className="py-4 text-center text-slate-500">Belum ada anggota keluarga (status TK/0).</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          {/* E. Daftar Bukti Potong Prepopulated */}
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
              L-1 Bagian E. Daftar Bukti Pemotongan Pajak (Prepopulated dari Dokumen Saya)
            </h3>
            <table className="w-full">
              <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2">Nomor Bukti Potong</th>
                  <th className="text-left px-3 py-2">Pemotong Pajak</th>
                  <th className="text-right px-3 py-2">Bruto</th>
                  <th className="text-right px-3 py-2">PPh Dipotong</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {myBpaSlips.map((sl) => (
                  <tr key={sl.id}>
                    <td className="px-3 py-2 font-num font-semibold text-[#1A2B5F]">{sl.slipNumber}</td>
                    <td className="px-3 py-2">{sl.issuerName}</td>
                    <td className="px-3 py-2 text-right font-num">{formatRupiah(sl.grossAmount)}</td>
                    <td className="px-3 py-2 text-right font-num font-semibold text-emerald-700">
                      {formatRupiah(sl.pphAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* TAB LAMPIRAN L-2 */}
      {activeTab === 'L2' && (
        <div className="space-y-5 text-xs">
          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-[#1A2B5F]">
                L-2 Bagian A. Penghasilan yang Dikenakan PPh Final (UMKM 0,5%, Deposito, Sewa)
              </h3>
              <span className="font-num font-bold text-[#1A2B5F]">Total PPh Final: {formatRupiah(summary.totalPphFinal)}</span>
            </div>

            {!readOnly && (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 bg-slate-50 border border-slate-200 rounded">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Penghasilan Final</label>
                  <input
                    type="text"
                    value={newFinalJenis}
                    onChange={(e) => setNewFinalJenis(e.target.value)}
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dasar Pengenaan (Rp)</label>
                  <input
                    type="number"
                    value={newFinalDpp}
                    onChange={(e) => setNewFinalDpp(Number(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tarif (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newFinalTarif}
                    onChange={(e) => setNewFinalTarif(Number(e.target.value) || 0)}
                    className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddFinal}
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
                  <th className="text-left px-3 py-2">Jenis Penghasilan Final</th>
                  <th className="text-right px-3 py-2">DPP</th>
                  <th className="text-right px-3 py-2">Tarif</th>
                  <th className="text-right px-3 py-2">PPh Final</th>
                  {!readOnly && <th className="text-right px-3 py-2">Hapus</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payload.penghasilanFinalList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                      Tidak ada penghasilan dikenakan PPh Final.
                    </td>
                  </tr>
                ) : (
                  payload.penghasilanFinalList.map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2">{f.jenis}</td>
                      <td className="px-3 py-2 text-right font-num">{formatRupiah(f.dasarPengenaan)}</td>
                      <td className="px-3 py-2 text-right font-num">{f.tarifPersen}%</td>
                      <td className="px-3 py-2 text-right font-num font-semibold">{formatRupiah(f.pphTerutang)}</td>
                      {!readOnly && (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                penghasilanFinalList: payload.penghasilanFinalList.filter((x) => x.id !== f.id),
                              })
                            }
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
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2">
              L-2 Bagian C. Penghasilan Neto Luar Negeri & Kredit Pajak PPh Pasal 24
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Penghasilan Neto Luar Negeri (Rp)</label>
                <input
                  type="number"
                  disabled={readOnly}
                  value={payload.penghasilanLNBruto}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    patch({ penghasilanLNBruto: val, hasPenghasilanLN: val > 0 });
                  }}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kredit Pajak Luar Negeri (PPh Pasal 24)</label>
                <input
                  type="number"
                  disabled={readOnly}
                  value={payload.kreditPajakPph24}
                  onChange={(e) => patch({ kreditPajakPph24: Number(e.target.value) || 0 })}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Payment Choice Modal for OP Kurang Bayar */}
      {payModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 font-bold text-sm">
              Pelunasan PPh Pasal 29 Orang Pribadi
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">PPh Kurang Bayar (Pasal 29)</span>
                  <strong className="font-num text-red-700">{formatRupiah(summary.selisih)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Saldo Deposit Pajak OP</span>
                  <strong className="font-num text-[#1A2B5F]">{formatRupiah(depositBalance)}</strong>
                </div>
              </div>
              <button
                type="button"
                disabled={depositBalance < summary.selisih}
                onClick={() => {
                  setPayModal(false);
                  requestTte({
                    title: 'Pemindahbukuan Deposit & Lapor SPT Tahunan OP',
                    description: `Memotong saldo deposit sebesar ${formatRupiah(summary.selisih)} dan menerbitkan BPE.`,
                    onConfirm: () => {
                      const res = submitTaxReturn(taxReturn.id, 'DEPOSIT');
                      if (res.ok) onBack();
                    },
                  });
                }}
                className="w-full p-3 text-left border border-[#1A2B5F] bg-[#1A2B5F]/5 rounded-md disabled:opacity-40 cursor-pointer"
              >
                <div className="font-bold text-[#1A2B5F]">1. Pemindahbukuan Saldo Deposit</div>
                <div className="text-slate-600 mt-0.5">Langsung lunas & BPE terbit.</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayModal(false);
                  requestTte({
                    title: 'Buat Kode Billing PPh Pasal 29 OP',
                    description: `Menerbitkan Kode Billing sebesar ${formatRupiah(summary.selisih)}.`,
                    onConfirm: () => {
                      const res = submitTaxReturn(taxReturn.id, 'BILLING');
                      if (res.ok) onBack();
                    },
                  });
                }}
                className="w-full p-3 text-left border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
              >
                <div className="font-bold text-slate-900">2. Buat Kode Billing (15 Digit)</div>
                <div className="text-slate-600 mt-0.5">Lunasi di menu Pembayaran untuk menerbitkan BPE.</div>
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
