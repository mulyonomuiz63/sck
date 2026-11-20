import React, { useMemo, useState } from 'react';
import { Building2, CheckSquare, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import {
  calculateTerPph21,
  formatNpwp16,
  formatRupiah,
  MASA_NAMES,
  PPH21_OBJECT_CODES,
  PPH23_OBJECT_CODES,
  PTKP_VALUES,
} from '../../lib/taxCalculations';
import { EBupotType } from '../../types/tax';

export const EBupotView: React.FC = () => {
  const {
    snapshot,
    switchRole,
    createEBupot,
    importEBupotBatch,
    issueEBupotSlips,
    cancelEBupotSlip,
    deleteEBupotSlip,
    requestTte,
    openPreviewDoc,
  } = useSimulator();

  const [activeTab, setActiveTab] = useState<EBupotType>('MP');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Create form state
  const [masaPajak, setMasaPajak] = useState(1);
  const [tahunPajak, setTahunPajak] = useState(2025);
  const [recipientNik, setRecipientNik] = useState('3273011508930002');
  const [recipientName, setRecipientName] = useState('SITI RAHMAWATI');
  const [ptkpStatus, setPtkpStatus] = useState('TK/0');
  const [objectCode, setObjectCode] = useState('21-100-01');
  const [grossAmount, setGrossAmount] = useState(18_500_000);
  const [referenceDoc, setReferenceDoc] = useState('PAYROLL-JAN-2025');

  // Import text state
  const [importText, setImportText] = useState(
    '3273011001910001,ANDI PRATAMA,TK/0,21-100-01,12500000,PAYROLL-01\n3273012004880003,DEWI LESTARI,K/1,21-100-01,16000000,PAYROLL-02'
  );

  const slips = snapshot?.ebupot ?? [];
  const filteredSlips = useMemo(() => {
    if (!snapshot) return [];
    return slips.filter((s) => {
      if (activeTab === 'BPA1') return s.slipType === 'BPA1' || s.slipType === 'BPA2';
      return s.slipType === activeTab;
    });
  }, [activeTab, slips, snapshot]);

  if (!snapshot) return null;

  const isBadan = snapshot.workspace.activeRole === 'BADAN';
  const badan = snapshot.workspace.badanProfile;

  // Live tax calculation preview in create form
  const calcPreview = (() => {
    if (activeTab === 'MP') {
      const ter = calculateTerPph21(grossAmount, ptkpStatus);
      return {
        terCategory: ter.category,
        rate: ter.ratePercent,
        pph: ter.pph,
        objectName: 'Pegawai Tetap (TER Bulanan PP 58/2023)',
      };
    }
    if (activeTab === 'BPPU') {
      const obj = PPH23_OBJECT_CODES.find((c) => c.code === objectCode) || PPH23_OBJECT_CODES[0];
      return {
        terCategory: 'NA' as const,
        rate: obj.rate,
        pph: Math.floor((grossAmount * obj.rate) / 100),
        objectName: obj.name,
      };
    }
    if (activeTab === 'BP21') {
      // Bukan Pegawai (PMK 168/2023: 50% x Bruto x Tarif Pasal 17 -> 5% untuk <= 60jt -> 2.5% efektif)
      const dpp = Math.floor(grossAmount * 0.5);
      const pph = Math.floor(dpp * 0.05);
      return {
        terCategory: 'NA' as const,
        rate: 2.5,
        pph,
        objectName: PPH21_OBJECT_CODES.find((c) => c.code === objectCode)?.name || 'Tenaga Ahli / Bukan Pegawai',
      };
    }
    // BPA1 / BPA2
    return {
      terCategory: 'A' as const,
      rate: 15,
      pph: Math.floor(grossAmount * 0.15),
      objectName: 'Bukti Potong Tahunan Pegawai Tetap (BPA1/BPA2)',
    };
  })();

  const openCreateModal = () => {
    if (activeTab === 'BPPU') {
      setObjectCode('24-104-29');
      setRecipientNik('0266778899001000');
      setRecipientName('PT SOLUSI TEKNOLOGI DIGITAL');
      setGrossAmount(25_000_000);
      setReferenceDoc('SPK-2025/KB/022');
    } else if (activeTab === 'BP21') {
      setObjectCode('21-100-07');
      setRecipientNik('3173021409850009');
      setRecipientName('DR. HENDRA WIJAYA (NARASUMBER)');
      setGrossAmount(10_000_000);
      setReferenceDoc('INV-AHLI-2025-01');
    } else {
      setObjectCode('21-100-01');
      setRecipientNik('3273011508930002');
      setRecipientName('SITI RAHMAWATI');
      setGrossAmount(18_500_000);
      setReferenceDoc('PAYROLL-JAN-2025');
    }
    setShowCreate(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEBupot({
      slipType: activeTab,
      slipNumber: `DRAFT-${activeTab}-${Date.now().toString().slice(-4)}`,
      masaPajak,
      tahunPajak,
      recipientNik: recipientNik.replace(/\D/g, '').padEnd(16, '0').slice(0, 16),
      recipientName: recipientName.trim() || 'PENERIMA PENGHASILAN',
      ptkpStatus: activeTab === 'BPPU' ? 'NA' : ptkpStatus,
      terCategory: calcPreview.terCategory,
      objectCode,
      objectName: calcPreview.objectName,
      grossAmount,
      taxRate: calcPreview.rate,
      pphAmount: calcPreview.pph,
      referenceDoc,
      status: 'BELUM_TERBIT',
      issuerNpwp: badan.npwp,
      issuerName: badan.nama,
    });
    setShowCreate(false);
  };

  const handleBatchImport = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = importText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((line) => {
      const [nik = '3273010000000001', nama = 'PEGAWAI IMPOR', ptkp = 'TK/0', code = '21-100-01', brutoStr = '10000000', ref = 'IMPORT-CSV'] =
        line.split(',').map((s) => s.trim());
      const bruto = Number(brutoStr) || 0;
      const isBppu = code.startsWith('24-');
      const ter = !isBppu ? calculateTerPph21(bruto, ptkp) : null;
      return {
        slipType: (isBppu ? 'BPPU' : 'MP') as EBupotType,
        slipNumber: `IMP-${Date.now().toString().slice(-4)}`,
        masaPajak,
        tahunPajak,
        recipientNik: nik.replace(/\D/g, '').padEnd(16, '0').slice(0, 16),
        recipientName: nama,
        ptkpStatus: isBppu ? 'NA' : ptkp,
        terCategory: isBppu ? ('NA' as const) : ter!.category,
        objectCode: code,
        objectName: isBppu ? 'Jasa Unifikasi PPh 23 (Impor)' : 'Pegawai Tetap TER (Impor)',
        grossAmount: bruto,
        taxRate: isBppu ? 2 : ter!.ratePercent,
        pphAmount: isBppu ? Math.floor(bruto * 0.02) : ter!.pph,
        referenceDoc: ref,
        status: 'BELUM_TERBIT' as const,
        issuerNpwp: badan.npwp,
        issuerName: badan.nama,
      };
    });
    if (parsed.length > 0) {
      importEBupotBatch(parsed);
      setShowImport(false);
    }
  };

  const draftIdsInView = filteredSlips.filter((s) => s.status === 'BELUM_TERBIT').map((s) => s.id);
  const selectedDraftIds = selectedIds.filter((id) => draftIdsInView.includes(id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Modul 3 · e-Bupot PPh 21 & PPh 23 (Unifikasi)</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F]">
            Bukti Pemotongan Elektronik (e-Bupot)
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Buat bukti potong MP Pegawai Tetap (TER PP 58/2023), BP 21, BP A1/A2, dan BPPU PPh 23, lalu terbitkan (TTE) untuk Posting SPT Masa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!isBadan}
            onClick={() => setShowImport(true)}
            className="px-3.5 py-2 border border-slate-300 bg-white text-[#1A2B5F] text-xs font-semibold rounded-md hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Impor CSV / Template</span>
          </button>
          <button
            type="button"
            disabled={!isBadan}
            onClick={openCreateModal}
            className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create e-Bupot {activeTab}</span>
          </button>
        </div>
      </div>

      {!isBadan && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-amber-900">
            <strong>Impersonate Diperlukan:</strong> Penerbitan e-Bupot perusahaan dilakukan melalui peran Wajib Pajak Badan (<strong>{badan.nama}</strong>).
          </div>
          <button
            type="button"
            onClick={() => switchRole('BADAN')}
            className="px-3.5 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Impersonate WP Badan</span>
          </button>
        </div>
      )}

      {/* Submenu Tabs + Batch Terbitkan Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {[
            { id: 'MP', label: 'MP Pegawai Tetap (TER)' },
            { id: 'BP21', label: 'BP 21 (Bukan Pegawai)' },
            { id: 'BPA1', label: 'BP A1 / A2 (Tahunan)' },
            { id: 'BPPU', label: 'BPPU (Unifikasi PPh 23)' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id as EBupotType);
                setSelectedIds([]);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isBadan && selectedDraftIds.length > 0 && (
          <button
            type="button"
            onClick={() =>
              requestTte({
                title: `Terbitkan ${selectedDraftIds.length} Bukti Potong (${activeTab})`,
                description:
                  'Bukti Potong yang diterbitkan akan memperoleh nomor resmi simulasi dan otomatis tersedia untuk Posting SPT Masa.',
                onConfirm: () => {
                  issueEBupotSlips(selectedDraftIds);
                  setSelectedIds([]);
                },
              })
            }
            className="px-4 py-2 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Terbitkan {selectedDraftIds.length} Slip Terpilih (TTE)</span>
          </button>
        )}
      </div>

      {/* Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#1A2B5F] text-white">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={draftIdsInView.length > 0 && selectedDraftIds.length === draftIdsInView.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? draftIdsInView : [])}
                    aria-label="Pilih semua draft"
                  />
                </th>
                <th className="text-left font-semibold px-3 py-3">Nomor Bupot</th>
                <th className="text-left font-semibold px-3 py-3">Masa</th>
                <th className="text-left font-semibold px-3 py-3">Penerima Penghasilan</th>
                <th className="text-left font-semibold px-3 py-3">Kode Objek</th>
                <th className="text-right font-semibold px-3 py-3">Bruto / DPP</th>
                <th className="text-right font-semibold px-3 py-3">Tarif</th>
                <th className="text-right font-semibold px-3 py-3">PPh Dipotong</th>
                <th className="text-left font-semibold px-3 py-3">Status</th>
                <th className="text-right font-semibold px-3 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSlips.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    Belum ada Bukti Potong pada kategori {activeTab}. Klik <strong>+ Create e-Bupot {activeTab}</strong>.
                  </td>
                </tr>
              ) : (
                filteredSlips.map((sl) => (
                  <tr key={sl.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center">
                      {sl.status === 'BELUM_TERBIT' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(sl.id)}
                          onChange={() => toggleSelect(sl.id)}
                          aria-label={`Pilih ${sl.recipientName}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-num font-semibold text-[#1A2B5F]">{sl.slipNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {MASA_NAMES[sl.masaPajak - 1]} {sl.tahunPajak}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-900">{sl.recipientName}</div>
                      <div className="text-[11px] font-num text-slate-500">
                        {formatNpwp16(sl.recipientNik)} {sl.ptkpStatus !== 'NA' ? `· ${sl.ptkpStatus} (TER ${sl.terCategory})` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-num">{sl.objectCode}</td>
                    <td className="px-3 py-2.5 text-right font-num">{formatRupiah(sl.grossAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-num">{sl.taxRate}%</td>
                    <td className="px-3 py-2.5 text-right font-num font-semibold text-slate-900">
                      {formatRupiah(sl.pphAmount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`font-semibold ${
                          sl.status === 'TELAH_TERBIT'
                            ? 'text-emerald-700'
                            : sl.status === 'DIBATALKAN'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {sl.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-2">
                      {sl.status === 'BELUM_TERBIT' && isBadan && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              requestTte({
                                title: `Terbitkan e-Bupot ${sl.slipType} — ${sl.recipientName}`,
                                description: `PPh Dipotong sebesar ${formatRupiah(sl.pphAmount)} (Tarif ${sl.taxRate}%).`,
                                onConfirm: () => issueEBupotSlips([sl.id]),
                              })
                            }
                            className="px-2.5 py-1 bg-[#1A2B5F] text-white font-semibold rounded hover:bg-[#111D42] cursor-pointer"
                          >
                            Terbitkan
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEBupotSlip(sl.id)}
                            className="p-1 text-red-600 hover:text-red-800 align-middle cursor-pointer"
                            title="Hapus Draft"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </>
                      )}
                      {sl.status === 'TELAH_TERBIT' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openPreviewDoc({
                                kind: 'EBUPOT',
                                title: `Bukti Pemotongan Elektronik (${sl.slipType})`,
                                subtitle: sl.objectName,
                                docNumber: sl.slipNumber,
                                date: sl.createdAtIso.slice(0, 10),
                                taxpayerName: sl.recipientName,
                                taxpayerNpwp: sl.recipientNik,
                                rows: [
                                  { label: 'Pemotong Pajak', value: sl.issuerName },
                                  { label: 'NPWP Pemotong', value: formatNpwp16(sl.issuerNpwp) },
                                  { label: 'Masa / Tahun Pajak', value: `${MASA_NAMES[sl.masaPajak - 1]} ${sl.tahunPajak}` },
                                  { label: 'Kode Objek Pajak', value: sl.objectCode },
                                  { label: 'Penghasilan Bruto / DPP', value: formatRupiah(sl.grossAmount) },
                                  { label: 'Tarif Pajak', value: `${sl.taxRate}%` },
                                  { label: 'PPh yang Dipotong', value: formatRupiah(sl.pphAmount), highlight: true },
                                  { label: 'Dokumen Referensi', value: sl.referenceDoc || '-' },
                                ],
                              })
                            }
                            className="p-1 text-slate-600 hover:text-[#1A2B5F] align-middle cursor-pointer"
                            title="Cetak Bukti Potong"
                          >
                            <Printer className="w-3.5 h-3.5 inline" />
                          </button>
                          {isBadan && sl.issuerNpwp === badan.npwp && (
                            <button
                              type="button"
                              onClick={() => cancelEBupotSlip(sl.id)}
                              className="text-red-600 font-semibold hover:underline cursor-pointer"
                            >
                              Batalkan
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create e-Bupot Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold">Buat e-Bupot {activeTab} Baru</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-slate-200 hover:text-white cursor-pointer">
                Tutup
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Masa Pajak</label>
                  <select
                    value={masaPajak}
                    onChange={(e) => setMasaPajak(Number(e.target.value))}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                  >
                    {MASA_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun Pajak</label>
                  <input
                    type="number"
                    value={tahunPajak}
                    onChange={(e) => setTahunPajak(Number(e.target.value))}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NIK / NPWP Penerima (16 Digit)</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={recipientNik}
                    onChange={(e) => setRecipientNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Penerima / Rekanan</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Objek Pajak</label>
                  <select
                    value={objectCode}
                    onChange={(e) => setObjectCode(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                  >
                    {activeTab === 'BPPU'
                      ? PPH23_OBJECT_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.name} ({c.rate}%)
                          </option>
                        ))
                      : PPH21_OBJECT_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                  </select>
                </div>

                {activeTab !== 'BPPU' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status PTKP (Menentukan TER)</label>
                    <select
                      value={ptkpStatus}
                      onChange={(e) => setPtkpStatus(e.target.value)}
                      className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                    >
                      {Object.keys(PTKP_VALUES).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dokumen Referensi (NPD / SPK)</label>
                    <input
                      type="text"
                      value={referenceDoc}
                      onChange={(e) => setReferenceDoc(e.target.value)}
                      className="w-full h-9 px-2.5 border border-slate-300 rounded"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Penghasilan Bruto / DPP (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(Number(e.target.value) || 0)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                  />
                </div>
                {activeTab !== 'BPPU' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dokumen Referensi</label>
                    <input
                      type="text"
                      value={referenceDoc}
                      onChange={(e) => setReferenceDoc(e.target.value)}
                      className="w-full h-9 px-2.5 border border-slate-300 rounded"
                    />
                  </div>
                )}
              </div>

              {/* Automatic Tax Calculation Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Kategori Tarif</span>
                  <span className="font-semibold text-slate-900">
                    {activeTab === 'MP'
                      ? `TER Kategori ${calcPreview.terCategory} (${calcPreview.rate}%)`
                      : `Tarif ${calcPreview.rate}%`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[#1A2B5F]">PPh Dipotong Otomatis</span>
                  <span className="font-num font-bold text-[#1A2B5F]">{formatRupiah(calcPreview.pph)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1A2B5F] text-white font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
                >
                  Simpan ke Belum Terbit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold">Impor Data Massal e-Bupot (CSV / Template)</h2>
              <button type="button" onClick={() => setShowImport(false)} className="text-xs text-slate-200 hover:text-white cursor-pointer">
                Tutup
              </button>
            </div>
            <form onSubmit={handleBatchImport} className="p-5 space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Format per baris: <span className="font-num">NIK_16_DIGIT,NAMA,PTKP,KODE_OBJEK,BRUTO,REFERENSI</span>.
                Gunakan kode <span className="font-num">21-100-01</span> untuk MP TER atau <span className="font-num">24-104-29</span> untuk BPPU PPh 23.
              </p>
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded font-num text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2B5F]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImport(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1A2B5F] text-white font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
                >
                  Impor Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
