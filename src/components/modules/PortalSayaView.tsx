import React, { useState } from 'react';
import { Cloud, FileDown, KeyRound, RotateCcw, Save } from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import { formatNpwp16, formatRupiah, MASA_NAMES, PTKP_VALUES } from '../../lib/taxCalculations';

export const PortalSayaView: React.FC = () => {
  const {
    snapshot,
    firebaseUser,
    connectGoogleCloud,
    disconnectGoogleCloud,
    updateProfiles,
    openPreviewDoc,
    resetSimulationData,
  } = useSimulator();

  const [activeTab, setActiveTab] = useState<'dokumen' | 'profil' | 'pengaturan'>('dokumen');
  const [opForm, setOpForm] = useState(snapshot?.workspace.opProfile);
  const [badanForm, setBadanForm] = useState(snapshot?.workspace.badanProfile);

  if (!snapshot || !opForm || !badanForm) return null;

  const { workspace, ebupot, taxReturns, efaktur } = snapshot;

  // Build unified Dokumen Saya archive (BPA1/BPA2, BPEs, Approved e-Faktur)
  const myBpaSlips = ebupot.filter(
    (s) => s.status === 'TELAH_TERBIT' && (s.slipType === 'BPA1' || s.slipType === 'BPA2' || s.recipientNik === workspace.nik)
  );
  const reportedReturns = taxReturns.filter((r) => r.status === 'DILAPORKAN');
  const approvedInvoices = efaktur.filter((i) => i.status === 'APPROVED' || i.status === 'AMENDED');

  const handleSaveProfiles = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfiles(opForm, badanForm);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Portal Saya</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F]">
            Dokumen Saya, Profil & Kode Otorisasi
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Unduh Bukti Potong BPA1/BPA2, Bukti Penerimaan Elektronik (BPE), dan kelola data profil simulasi.
          </p>
        </div>

        {/* Segmented Filter Tabs */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {[
            { id: 'dokumen', label: 'Dokumen Saya' },
            { id: 'profil', label: 'Profil & Passphrase' },
            { id: 'pengaturan', label: 'Cloud & Reset' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dokumen' && (
        <div className="space-y-6">
          {/* Bukti Potong Diterima (BPA1/BPA2 — Langkah 1 PDF PPh 21 Tahunan) */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1A2B5F]">
                  Bukti Pemotongan Pajak (BPA1 / BPA2 / e-Bupot)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dokumen ini otomatis tersedia untuk prepopulate saat Posting SPT Tahunan Orang Pribadi.
                </p>
              </div>
              <span className="text-xs font-num text-slate-600">{myBpaSlips.length} dokumen</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Nomor Bukti Potong</th>
                    <th className="text-left font-semibold px-4 py-2.5">Jenis</th>
                    <th className="text-left font-semibold px-4 py-2.5">Pemotong Pajak</th>
                    <th className="text-right font-semibold px-4 py-2.5">Penghasilan Bruto</th>
                    <th className="text-right font-semibold px-4 py-2.5">PPh Dipotong</th>
                    <th className="text-right font-semibold px-4 py-2.5">Unduh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {myBpaSlips.map((sl) => (
                    <tr key={sl.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{sl.slipNumber}</td>
                      <td className="px-4 py-2.5">{sl.slipType} ({sl.tahunPajak})</td>
                      <td className="px-4 py-2.5 text-slate-700">{sl.issuerName}</td>
                      <td className="px-4 py-2.5 text-right font-num">{formatRupiah(sl.grossAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-num font-semibold text-emerald-700">
                        {formatRupiah(sl.pphAmount)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            openPreviewDoc({
                              kind: 'EBUPOT',
                              title: `Bukti Pemotongan PPh Pasal 21 (${sl.slipType})`,
                              subtitle: sl.objectName,
                              docNumber: sl.slipNumber,
                              date: sl.createdAtIso.slice(0, 10),
                              taxpayerName: sl.recipientName,
                              taxpayerNpwp: sl.recipientNik,
                              rows: [
                                { label: 'Pemotong Pajak', value: sl.issuerName },
                                { label: 'NPWP Pemotong', value: formatNpwp16(sl.issuerNpwp) },
                                { label: 'Masa / Tahun Pajak', value: `${MASA_NAMES[sl.masaPajak - 1]} ${sl.tahunPajak}` },
                                { label: 'Status PTKP', value: sl.ptkpStatus },
                                { label: 'Kode Objek Pajak', value: sl.objectCode },
                                { label: 'Jumlah Penghasilan Bruto', value: formatRupiah(sl.grossAmount) },
                                { label: 'PPh Pasal 21 yang Telah Dipotong', value: formatRupiah(sl.pphAmount), highlight: true },
                                { label: 'Dokumen Referensi', value: sl.referenceDoc || '-' },
                              ],
                            })
                          }
                          className="inline-flex items-center gap-1 text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Lihat / PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Arsip BPE Pelaporan SPT */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1A2B5F]">
                Arsip Bukti Penerimaan Elektronik (BPE) & Induk SPT
              </h2>
              <span className="text-xs font-num text-slate-600">{reportedReturns.length} BPE</span>
            </div>
            {reportedReturns.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Belum ada BPE tersimpan. Laporkan SPT pada menu Surat Pemberitahuan (SPT) untuk menerbitkan BPE.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">Nomor BPE</th>
                      <th className="text-left font-semibold px-4 py-2.5">Jenis SPT</th>
                      <th className="text-left font-semibold px-4 py-2.5">Wajib Pajak</th>
                      <th className="text-left font-semibold px-4 py-2.5">Status</th>
                      <th className="text-right font-semibold px-4 py-2.5">Unduh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportedReturns.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{r.bpeNumber}</td>
                        <td className="px-4 py-2.5">{r.returnType}</td>
                        <td className="px-4 py-2.5">
                          {r.taxpayerRole === 'BADAN' ? workspace.badanProfile.nama : workspace.opProfile.nama}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-700">{r.taxPosition}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openPreviewDoc({
                                kind: 'BPE',
                                title: 'Bukti Penerimaan Elektronik (BPE)',
                                subtitle: `SPT ${r.returnType} — KelasBrevet Coretax Simulator`,
                                docNumber: r.bpeNumber,
                                date: r.submittedAt.slice(0, 10),
                                taxpayerName:
                                  r.taxpayerRole === 'BADAN' ? workspace.badanProfile.nama : workspace.opProfile.nama,
                                taxpayerNpwp:
                                  r.taxpayerRole === 'BADAN' ? workspace.badanProfile.npwp : workspace.opProfile.npwp,
                                rows: [
                                  { label: 'Jenis SPT', value: r.returnType },
                                  {
                                    label: 'Periode Pajak',
                                    value: r.returnType.includes('TAHUNAN')
                                      ? `Tahun ${r.tahunPajak}`
                                      : `${MASA_NAMES[r.masaPajak - 1]} ${r.tahunPajak}`,
                                  },
                                  { label: 'Posisi Pajak', value: r.taxPosition },
                                  { label: 'Nominal', value: formatRupiah(r.amountDue), highlight: true },
                                  { label: 'Waktu Lapor', value: r.submittedAt.replace('T', ' ').slice(0, 19) },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Cetak BPE</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Arsip Faktur Pajak Disetujui */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1A2B5F]">Arsip e-Faktur Disetujui (APPROVED / AMENDED)</h2>
              <span className="text-xs font-num text-slate-600">{approvedInvoices.length} faktur</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">NSFP</th>
                    <th className="text-left font-semibold px-4 py-2.5">Kategori</th>
                    <th className="text-left font-semibold px-4 py-2.5">Lawan Transaksi</th>
                    <th className="text-right font-semibold px-4 py-2.5">PPN</th>
                    <th className="text-right font-semibold px-4 py-2.5">Cetak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {approvedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2.5">{inv.category}</td>
                      <td className="px-4 py-2.5">{inv.counterpartyName}</td>
                      <td className="px-4 py-2.5 text-right font-num">{formatRupiah(inv.ppnTotal)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            openPreviewDoc({
                              kind: 'EFAKTUR',
                              title: 'Faktur Pajak Elektronik (Simulasi e-Faktur)',
                              subtitle: `Kode Transaksi ${inv.transactionCode} · Status ${inv.status}`,
                              docNumber: inv.invoiceNumber,
                              date: inv.invoiceDate,
                              taxpayerName: workspace.badanProfile.nama,
                              taxpayerNpwp: workspace.badanProfile.npwp,
                              rows: [
                                { label: 'Lawan Transaksi', value: inv.counterpartyName },
                                { label: 'NPWP / NIK Lawan Transaksi', value: formatNpwp16(inv.counterpartyNpwp) },
                                { label: 'Masa / Tahun Pajak', value: `${MASA_NAMES[inv.masaPajak - 1]} ${inv.tahunPajak}` },
                                { label: 'Dasar Pengenaan Pajak (DPP)', value: formatRupiah(inv.dppTotal) },
                                { label: 'PPN 11%', value: formatRupiah(inv.ppnTotal), highlight: true },
                                { label: 'Referensi', value: inv.referenceDoc || '-' },
                              ],
                            })
                          }
                          className="text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                        >
                          Pratinjau PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'profil' && (
        <form onSubmit={handleSaveProfiles} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profil OP */}
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2.5">
                Profil Wajib Pajak Orang Pribadi (Akun Utama)
              </h2>
              <div className="grid grid-cols-1 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NIK / NPWP 16 Digit</label>
                  <input
                    type="text"
                    disabled
                    value={opForm.nik}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded font-num text-slate-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Wajib Pajak OP</label>
                  <input
                    type="text"
                    value={opForm.nama}
                    onChange={(e) => setOpForm({ ...opForm, nama: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status PTKP</label>
                  <select
                    value={opForm.ptkp}
                    onChange={(e) => setOpForm({ ...opForm, ptkp: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded bg-white"
                  >
                    {Object.entries(PTKP_VALUES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {k} — {formatRupiah(v)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Domisili</label>
                  <input
                    type="text"
                    value={opForm.alamat}
                    onChange={(e) => setOpForm({ ...opForm, alamat: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#B45309]" />
                    <span>Passphrase Kode Otorisasi (TTE OP)</span>
                  </label>
                  <input
                    type="text"
                    value={opForm.passphrase}
                    onChange={(e) => setOpForm({ ...opForm, passphrase: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded font-num"
                  />
                </div>
              </div>
            </section>

            {/* Profil Badan */}
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <h2 className="text-sm font-bold text-[#1A2B5F] border-b border-slate-200 pb-2.5">
                Profil Wajib Pajak Badan (Impersonate PT Simulasi)
              </h2>
              <div className="grid grid-cols-1 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">NPWP Badan (16 Digit)</label>
                  <input
                    type="text"
                    disabled
                    value={badanForm.npwp}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded font-num text-slate-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan (WP Badan)</label>
                  <input
                    type="text"
                    value={badanForm.nama}
                    onChange={(e) => setBadanForm({ ...badanForm, nama: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Pengusaha Kena Pajak (PKP)</label>
                  <select
                    value={badanForm.statusPkp}
                    onChange={(e) => setBadanForm({ ...badanForm, statusPkp: e.target.value as 'AKTIF' | 'NON_PKP' })}
                    className="w-full h-9 px-3 border border-slate-300 rounded bg-white"
                  >
                    <option value="AKTIF">PKP Aktif (Dapat menerbitkan e-Faktur)</option>
                    <option value="NON_PKP">Non-PKP</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Perusahaan</label>
                  <input
                    type="text"
                    value={badanForm.alamat}
                    onChange={(e) => setBadanForm({ ...badanForm, alamat: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#B45309]" />
                    <span>Passphrase Kode Otorisasi (TTE Badan)</span>
                  </label>
                  <input
                    type="text"
                    value={badanForm.passphrase}
                    onChange={(e) => setBadanForm({ ...badanForm, passphrase: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded font-num"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan Profil</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'pengaturan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <h2 className="text-sm font-bold text-[#1A2B5F] flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              <span>Sinkronisasi Database Cloud</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Progres simulasi NIK Anda tersimpan otomatis di browser. Hubungkan akun Google agar
              seluruh transaksi e-Faktur, e-Bupot, dan SPT tersinkronisasi lintas perangkat.
            </p>
            {firebaseUser ? (
              <div className="pt-2 space-y-3">
                <div className="text-xs text-emerald-700 font-semibold">
                  Terhubung sebagai {firebaseUser.email}
                </div>
                <button
                  type="button"
                  onClick={() => void disconnectGoogleCloud()}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Putuskan Sinkronisasi Cloud
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void connectGoogleCloud()}
                className="px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
              >
                Hubungkan Akun Google
              </button>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
            <h2 className="text-sm font-bold text-red-700 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Reset Data Simulasi KelasBrevet</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kembalikan seluruh faktur, e-Bupot, SPT, kode billing, dan saldo deposit pada NIK{' '}
              <span className="font-num font-semibold">{workspace.nik}</span> ke kondisi awal studi kasus.
            </p>
            <button
              type="button"
              onClick={() => void resetSimulationData()}
              className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 cursor-pointer"
            >
              Reset Sekarang
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
