import React, { useMemo, useState } from 'react';
import { Building2, Plus, Printer, Trash2 } from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import {
  EFAKTUR_ITEM_CODES,
  EFAKTUR_TRANSACTION_CODES,
  formatNpwp16,
  formatRupiah,
  generateId,
  MASA_NAMES,
} from '../../lib/taxCalculations';
import { EFakturCategory, EFakturItem } from '../../types/tax';

type EfakturTab = 'OUTPUT' | 'INPUT' | 'SPECIAL' | 'RETURN';

export const EFakturView: React.FC = () => {
  const {
    snapshot,
    switchRole,
    createEFaktur,
    approveEFaktur,
    requestAmendEFaktur,
    requestCancelEFaktur,
    toggleCreditInputEFaktur,
    deleteEFaktur,
    requestTte,
    openPreviewDoc,
  } = useSimulator();

  const [activeTab, setActiveTab] = useState<EfakturTab>('OUTPUT');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Create Form State
  const [category, setCategory] = useState<EFakturCategory>('OUTPUT');
  const [txCode, setTxCode] = useState('01');
  const [invoiceDate, setInvoiceDate] = useState('2025-01-25');
  const [masaPajak, setMasaPajak] = useState(1);
  const [tahunPajak, setTahunPajak] = useState(2025);
  const [counterpartyNpwp, setCounterpartyNpwp] = useState('0122334455667000');
  const [counterpartyName, setCounterpartyName] = useState('PT MITRA NIAGA INDONESIA');
  const [referenceDoc, setReferenceDoc] = useState('INV-KB-2025-002');
  const [sp2dNumber, setSp2dNumber] = useState('');
  const [useDppNilaiLain, setUseDppNilaiLain] = useState(false);
  const [items, setItems] = useState<EFakturItem[]>([
    {
      id: 'row_1',
      itemType: 'JASA',
      itemCode: '210100',
      name: 'Jasa Konsultansi Perpajakan & Akuntansi',
      unit: 'Paket',
      unitPrice: 50_000_000,
      qty: 1,
      discount: 0,
      dpp: 50_000_000,
      useDppNilaiLain: false,
      dppNilaiLain: 50_000_000,
      ppn: 5_500_000,
      ppnbm: 0,
    },
  ]);

  const invoices = snapshot?.efaktur ?? [];
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const tabMatch =
        activeTab === 'OUTPUT'
          ? inv.category === 'OUTPUT'
          : activeTab === 'INPUT'
          ? inv.category === 'INPUT'
          : activeTab === 'SPECIAL'
          ? inv.category === 'SPECIAL_OUTPUT' || inv.category === 'SPECIAL_INPUT'
          : inv.category === 'OUTPUT_RETURN' || inv.category === 'INPUT_RETURN';
      const q = search.trim().toLowerCase();
      if (!q) return tabMatch;
      return (
        tabMatch &&
        (inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.counterpartyName.toLowerCase().includes(q) ||
          inv.counterpartyNpwp.includes(q))
      );
    });
  }, [activeTab, invoices, search]);

  if (!snapshot) return null;

  const isBadan = snapshot.workspace.activeRole === 'BADAN';

  const recalcItem = (row: EFakturItem, nilaiLain: boolean): EFakturItem => {
    const gross = Math.max(0, row.unitPrice * row.qty - row.discount);
    const dppLain = nilaiLain ? Math.round((gross * 11) / 12) : gross;
    // Tarif efektif: 11% dari DPP normal, atau 12% dari DPP Nilai Lain (11/12) -> tetap 11%
    const ppn = txCode === '07' || txCode === '08' ? 0 : Math.round(nilaiLain ? dppLain * 0.12 : gross * 0.11);
    return { ...row, dpp: gross, useDppNilaiLain: nilaiLain, dppNilaiLain: dppLain, ppn };
  };

  const computedItems = items.map((it) => recalcItem(it, useDppNilaiLain));
  const totalDpp = computedItems.reduce((a, b) => a + b.dpp, 0);
  const totalDppLain = computedItems.reduce((a, b) => a + b.dppNilaiLain, 0);
  const totalPpn = computedItems.reduce((a, b) => a + b.ppn, 0);

  const openCreateForTab = () => {
    if (activeTab === 'OUTPUT') setCategory('OUTPUT');
    else if (activeTab === 'INPUT') setCategory('INPUT');
    else if (activeTab === 'SPECIAL') setCategory('SPECIAL_OUTPUT');
    else setCategory('OUTPUT_RETURN');
    setShowModal(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isInput = category === 'INPUT' || category === 'SPECIAL_INPUT' || category === 'INPUT_RETURN';
    createEFaktur({
      category,
      transactionCode: txCode,
      invoiceNumber: isInput ? `010025${Math.floor(100000000 + Math.random() * 899999999)}` : `DRAFT-${Date.now().toString().slice(-4)}`,
      invoiceDate,
      masaPajak,
      tahunPajak,
      counterpartyNpwp: counterpartyNpwp.replace(/\D/g, '').padEnd(16, '0').slice(0, 16),
      counterpartyName: counterpartyName.trim() || 'LAWAN TRANSAKSI SIMULASI',
      status: isInput ? 'APPROVED' : 'CREATED',
      creditStatus: isInput ? 'CREDITED' : 'NA',
      dppTotal: totalDpp,
      dppNilaiLain: totalDppLain,
      ppnTotal: totalPpn,
      ppnbmTotal: 0,
      items: computedItems,
      referenceDoc,
      sp2dNumber,
      amendmentOf: '',
    });
    setShowModal(false);
  };

  const statusColor = (status: string) => {
    if (status === 'APPROVED' || status === 'AMENDED') return 'text-emerald-700 font-semibold';
    if (status === 'CANCELED') return 'text-red-700 font-semibold';
    if (status.startsWith('WAITING')) return 'text-amber-700 font-semibold';
    return 'text-slate-600 font-semibold';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Modul 1 · e-Faktur (PPN)</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F]">
            Administrasi Faktur Pajak Elektronik
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Kelola Pajak Keluaran, Pajak Masukan (Kredit/Tidak Kredit), Dokumen Tertentu (Ekspor/Impor), dan Retur.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForTab}
          disabled={!isBadan}
          className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] disabled:opacity-40 inline-flex items-center gap-2 self-start cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Rekam Faktur / Dokumen Baru</span>
        </button>
      </div>

      {/* Impersonate Guard Notice */}
      {!isBadan && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-xs text-amber-900">
            <strong>Akses e-Faktur Memerlukan Peran PKP Badan:</strong> Saat ini Anda berada pada Akun Utama Orang Pribadi. Lakukan Impersonate ke <strong>{snapshot.workspace.badanProfile.nama}</strong> untuk mengelola e-Faktur.
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

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {[
            { id: 'OUTPUT', label: 'Pajak Keluaran' },
            { id: 'INPUT', label: 'Pajak Masukan' },
            { id: 'SPECIAL', label: 'Dokumen Tertentu (Ekspor/Impor)' },
            { id: 'RETURN', label: 'Retur Faktur' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as EfakturTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari NSFP / NPWP / Lawan Transaksi..."
          className="h-9 px-3 text-xs bg-white border border-slate-300 rounded-md w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F]"
        />
      </div>

      {/* Data Grid */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#1A2B5F] text-white">
              <tr>
                <th className="text-left font-semibold px-4 py-3">NSFP / Nomor</th>
                <th className="text-left font-semibold px-4 py-3">Kode</th>
                <th className="text-left font-semibold px-4 py-3">Masa</th>
                <th className="text-left font-semibold px-4 py-3">Lawan Transaksi</th>
                <th className="text-right font-semibold px-4 py-3">DPP</th>
                <th className="text-right font-semibold px-4 py-3">PPN</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Belum ada data pada kategori ini. Klik <strong>Rekam Faktur / Dokumen Baru</strong> untuk menambah transaksi.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">
                      {inv.invoiceNumber}
                      <div className="text-[11px] font-normal text-slate-500">{inv.invoiceDate}</div>
                    </td>
                    <td className="px-4 py-2.5 font-num">{inv.transactionCode}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {MASA_NAMES[inv.masaPajak - 1]} {inv.tahunPajak}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-900">{inv.counterpartyName}</div>
                      <div className="text-[11px] font-num text-slate-500">{formatNpwp16(inv.counterpartyNpwp)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-num">{formatRupiah(inv.dppTotal)}</td>
                    <td className="px-4 py-2.5 text-right font-num font-semibold text-slate-900">
                      {formatRupiah(inv.ppnTotal)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className={statusColor(inv.status)}>{inv.status}</div>
                      {inv.category === 'INPUT' && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {inv.creditStatus === 'CREDITED' ? 'Dikreditkan (B-2)' : 'Tidak Dikreditkan (B-3)'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-2">
                      {inv.status === 'CREATED' && isBadan && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              requestTte({
                                title: `Upload & Setujui Faktur Pajak (${inv.counterpartyName})`,
                                description: `Menandatangani Faktur Pajak dengan PPN sebesar ${formatRupiah(inv.ppnTotal)} untuk memperoleh NSFP dan status APPROVED.`,
                                onConfirm: () => approveEFaktur(inv.id),
                              })
                            }
                            className="px-2.5 py-1 bg-[#1A2B5F] text-white font-semibold rounded hover:bg-[#111D42] cursor-pointer"
                          >
                            Submit & TTE
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEFaktur(inv.id)}
                            className="p-1 text-red-600 hover:text-red-800 align-middle cursor-pointer"
                            title="Hapus Draft"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </>
                      )}

                      {(inv.status === 'APPROVED' || inv.status === 'AMENDED') && inv.category === 'OUTPUT' && isBadan && (
                        <>
                          <button
                            type="button"
                            onClick={() => requestAmendEFaktur(inv.id)}
                            className="text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                          >
                            Pengganti
                          </button>
                          <button
                            type="button"
                            onClick={() => requestCancelEFaktur(inv.id)}
                            className="text-red-600 font-semibold hover:underline cursor-pointer"
                          >
                            Batal
                          </button>
                        </>
                      )}

                      {inv.category === 'INPUT' && isBadan && (
                        <button
                          type="button"
                          onClick={() => toggleCreditInputEFaktur(inv.id)}
                          className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                            inv.creditStatus === 'CREDITED'
                              ? 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                              : 'bg-emerald-700 text-white hover:bg-emerald-800'
                          }`}
                        >
                          {inv.creditStatus === 'CREDITED' ? 'Batal Kredit' : 'Kreditkan'}
                        </button>
                      )}

                      {(inv.status === 'APPROVED' || inv.status === 'AMENDED') && (
                        <button
                          type="button"
                          onClick={() =>
                            openPreviewDoc({
                              kind: 'EFAKTUR',
                              title: 'Faktur Pajak Elektronik (e-Faktur)',
                              subtitle: `Kategori ${inv.category} · Kode Transaksi ${inv.transactionCode} · ${inv.status}`,
                              docNumber: inv.invoiceNumber,
                              date: inv.invoiceDate,
                              taxpayerName: snapshot.workspace.badanProfile.nama,
                              taxpayerNpwp: snapshot.workspace.badanProfile.npwp,
                              rows: [
                                { label: 'Lawan Transaksi', value: inv.counterpartyName },
                                { label: 'NPWP / NIK Lawan Transaksi', value: formatNpwp16(inv.counterpartyNpwp) },
                                { label: 'Masa / Tahun Pajak', value: `${MASA_NAMES[inv.masaPajak - 1]} ${inv.tahunPajak}` },
                                { label: 'Total Harga Jual / DPP', value: formatRupiah(inv.dppTotal) },
                                { label: 'DPP Nilai Lain', value: formatRupiah(inv.dppNilaiLain) },
                                { label: 'PPN Terutang', value: formatRupiah(inv.ppnTotal), highlight: true },
                                { label: 'Dokumen Referensi', value: inv.referenceDoc || '-' },
                              ],
                            })
                          }
                          className="p-1 text-slate-600 hover:text-[#1A2B5F] align-middle cursor-pointer"
                          title="Pratinjau / Cetak Faktur"
                        >
                          <Printer className="w-3.5 h-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create e-Faktur Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full my-8 overflow-hidden">
            <div className="bg-[#1A2B5F] text-white px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-bold">Rekam Faktur Pajak / Dokumen PPN Baru</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-xs text-slate-200 hover:text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Dokumen</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as EFakturCategory)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="OUTPUT">Pajak Keluaran (Output Tax)</option>
                    <option value="INPUT">Pajak Masukan (Input Tax)</option>
                    <option value="SPECIAL_OUTPUT">Dokumen Lain Ekspor (A-1)</option>
                    <option value="SPECIAL_INPUT">Dokumen Lain Impor / PIB (B-1)</option>
                    <option value="OUTPUT_RETURN">Retur Pajak Keluaran</option>
                    <option value="INPUT_RETURN">Retur Pajak Masukan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Transaksi</label>
                  <select
                    value={txCode}
                    onChange={(e) => setTxCode(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                  >
                    {EFAKTUR_TRANSACTION_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Faktur</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPWP / NIK Lawan</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={counterpartyNpwp}
                    onChange={(e) => setCounterpartyNpwp(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lawan Transaksi</label>
                  <input
                    type="text"
                    value={counterpartyName}
                    onChange={(e) => setCounterpartyName(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Referensi (No. Invoice / PEB / PIB)</label>
                  <input
                    type="text"
                    value={referenceDoc}
                    onChange={(e) => setReferenceDoc(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded"
                  />
                </div>
                {txCode === '02' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nomor SP2D (Bendahara Pemerintah)</label>
                    <input
                      type="text"
                      value={sp2dNumber}
                      onChange={(e) => setSp2dNumber(e.target.value)}
                      placeholder="Contoh: SP2D-2025-00912"
                      className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                    />
                  </div>
                )}
              </div>

              {/* Detail Transaksi Barang / Jasa */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[#1A2B5F]">Detail Transaksi Barang / Jasa</span>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useDppNilaiLain}
                        onChange={(e) => setUseDppNilaiLain(e.target.checked)}
                      />
                      <span>Gunakan DPP Nilai Lain (11/12 × 12%)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((prev) => [
                          ...prev,
                          {
                            id: generateId('it'),
                            itemType: 'BARANG',
                            itemCode: '000000',
                            name: 'Barang Kena Pajak Tambahan',
                            unit: 'Unit',
                            unitPrice: 10_000_000,
                            qty: 1,
                            discount: 0,
                            dpp: 10_000_000,
                            useDppNilaiLain,
                            dppNilaiLain: 10_000_000,
                            ppn: 1_100_000,
                            ppnbm: 0,
                          },
                        ])
                      }
                      className="text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                    >
                      + Tambah Baris
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {items.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-12 gap-2 items-end p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <div className="col-span-3">
                        <label className="block text-[11px] text-slate-500 mb-0.5">Kode Barang/Jasa</label>
                        <select
                          value={row.itemCode}
                          onChange={(e) => {
                            const found = EFAKTUR_ITEM_CODES.find((c) => c.code === e.target.value);
                            setItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      itemCode: e.target.value,
                                      itemType: found?.type || it.itemType,
                                      name: found?.name || it.name,
                                    }
                                  : it
                              )
                            );
                          }}
                          className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                        >
                          {EFAKTUR_ITEM_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} — {c.type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <label className="block text-[11px] text-slate-500 mb-0.5">Nama Barang / Jasa</label>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)))
                          }
                          className="w-full h-8 px-2 border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] text-slate-500 mb-0.5">Harga Satuan</label>
                        <input
                          type="number"
                          min={0}
                          value={row.unitPrice}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, unitPrice: Number(e.target.value) || 0 } : it))
                            )
                          }
                          className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-[11px] text-slate-500 mb-0.5">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={row.qty}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, Number(e.target.value) || 1) } : it))
                            )
                          }
                          className="w-full h-8 px-2 border border-slate-300 rounded bg-white font-num"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="text-[11px] text-slate-500">PPN</div>
                        <div className="font-num font-bold text-slate-900">
                          {formatRupiah(computedItems[idx].ppn)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="mt-4 p-3 bg-[#1A2B5F]/5 border border-slate-200 rounded flex flex-wrap justify-between gap-4">
                  <div>
                    <span className="text-slate-600">Total DPP: </span>
                    <strong className="font-num text-slate-900">{formatRupiah(totalDpp)}</strong>
                  </div>
                  {useDppNilaiLain && (
                    <div>
                      <span className="text-slate-600">DPP Nilai Lain (11/12): </span>
                      <strong className="font-num text-slate-900">{formatRupiah(totalDppLain)}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-600">Total PPN: </span>
                    <strong className="font-num text-[#1A2B5F]">{formatRupiah(totalPpn)}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1A2B5F] text-white font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
                >
                  Simpan Draft Faktur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
