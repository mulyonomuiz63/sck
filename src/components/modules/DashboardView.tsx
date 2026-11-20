import React from 'react';
import { ArrowRight, Building2, ClipboardCheck, FileText, User } from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import { GUIDED_CASES } from '../../lib/seedData';
import { formatNpwp16, formatRupiah, MASA_NAMES } from '../../lib/taxCalculations';

export const DashboardView: React.FC = () => {
  const {
    snapshot,
    setActiveNav,
    switchRole,
    openPreviewDoc,
  } = useSimulator();

  if (!snapshot) return null;

  const { workspace, efaktur, ebupot, taxReturns, billing } = snapshot;
  const isBadan = workspace.activeRole === 'BADAN';
  const activeDeposit = isBadan
    ? workspace.badanProfile.depositBalance
    : workspace.opProfile.depositBalance;

  const approvedOutputs = efaktur.filter((i) => i.category === 'OUTPUT' && (i.status === 'APPROVED' || i.status === 'AMENDED')).length;
  const issuedBupots = ebupot.filter((s) => s.status === 'TELAH_TERBIT').length;
  const reportedSpts = taxReturns.filter((r) => r.status === 'DILAPORKAN');
  const unpaidBillings = billing.filter((b) => b.status === 'BELUM_BAYAR');

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">
            Beranda · Simulasi Coretax Lisensi KelasBrevet
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F]">
            {isBadan ? workspace.badanProfile.nama : workspace.opProfile.nama}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-num">{formatNpwp16(isBadan ? workspace.badanProfile.npwp : workspace.opProfile.npwp)}</span>
            <span aria-hidden="true">·</span>
            <span>{isBadan ? 'Wajib Pajak Badan (Impersonate)' : 'Wajib Pajak Orang Pribadi'}</span>
            <span aria-hidden="true">·</span>
            <span>{isBadan ? workspace.badanProfile.klu : workspace.opProfile.klu}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => switchRole(isBadan ? 'OP' : 'BADAN')}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-300 bg-white text-[#1A2B5F] rounded-md hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            {isBadan ? <User className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
            <span>{isBadan ? 'Kembali ke Akun OP' : 'Impersonate WP Badan'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('ujian')}
            className="px-4 py-2 text-xs font-bold bg-[#F5C518] text-[#1A2B5F] rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Ujian Praktik</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('spt')}
            className="px-4 py-2 text-xs font-bold bg-[#1A2B5F] text-white rounded-md hover:bg-[#111D42] whitespace-nowrap cursor-pointer"
          >
            Buat Konsep SPT
          </button>
        </div>
      </div>

      {/* KPI Strip — 4-column flat border grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Saldo Deposit Pajak ({isBadan ? 'Badan' : 'OP'})</div>
          <div className="mt-2 text-xl font-bold font-num text-[#1A2B5F]">{formatRupiah(activeDeposit)}</div>
          <button
            type="button"
            onClick={() => setActiveNav('pembayaran')}
            className="mt-2 text-xs font-semibold text-[#B45309] hover:underline cursor-pointer"
          >
            Kelola Deposit & Billing
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">SPT Dilaporkan (BPE Terbit)</div>
          <div className="mt-2 text-xl font-bold font-num text-emerald-700">{reportedSpts.length}</div>
          <div className="mt-2 text-xs text-slate-500">
            {taxReturns.filter((r) => r.status === 'KONSEP').length} konsep aktif · {unpaidBillings.length} menunggu bayar
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">e-Faktur Keluaran Disetujui</div>
          <div className="mt-2 text-xl font-bold font-num text-slate-900">{approvedOutputs}</div>
          <div className="mt-2 text-xs text-slate-500">
            Total {efaktur.length} dokumen e-Faktur di simulasi
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">e-Bupot Telah Terbit</div>
          <div className="mt-2 text-xl font-bold font-num text-slate-900">{issuedBupots}</div>
          <div className="mt-2 text-xs text-slate-500">
            {ebupot.filter((s) => s.status === 'BELUM_TERBIT').length} menunggu penerbitan (TTE)
          </div>
        </div>
      </section>

      {/* 5 Curriculum Modules Launcher — Clean & Concise */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#1A2B5F]">Modul Simulasi Coretax</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUIDED_CASES.map((gc) => {
            const targetNav = gc.steps[0]?.targetNav || 'spt';
            return (
              <div
                key={gc.id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {gc.moduleCode} · {gc.recommendedRole === 'BADAN' ? 'WP Badan' : 'WP OP'}
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-slate-900 leading-snug">{gc.title}</h3>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (workspace.activeRole !== gc.recommendedRole) {
                        switchRole(gc.recommendedRole);
                      }
                      setActiveNav(targetNav);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#1A2B5F] hover:text-[#B45309] cursor-pointer"
                  >
                    <span>Buka Modul</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Reported SPTs & BPE Archive */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-sm font-bold text-[#1A2B5F]">Riwayat Pelaporan SPT & BPE Terbaru</h2>
          <button
            type="button"
            onClick={() => setActiveNav('spt')}
            className="text-xs font-semibold text-[#1A2B5F] hover:underline cursor-pointer"
          >
            Lihat Semua SPT
          </button>
        </div>

        {reportedSpts.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Belum ada SPT yang dilaporkan</p>
            <p className="mt-1 text-xs text-slate-500">
              Mulai dari Kasus 1 (SPT Tahunan OP Tuan A) atau buat konsep SPT baru pada menu Surat Pemberitahuan.
            </p>
            <button
              type="button"
              onClick={() => setActiveNav('spt')}
              className="mt-4 px-4 py-2 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
            >
              Buka Menu SPT
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1A2B5F]/5 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Nomor BPE</th>
                  <th className="text-left font-semibold px-4 py-2.5">Jenis SPT</th>
                  <th className="text-left font-semibold px-4 py-2.5">Masa / Tahun</th>
                  <th className="text-left font-semibold px-4 py-2.5">Posisi Pajak</th>
                  <th className="text-right font-semibold px-4 py-2.5">Nominal</th>
                  <th className="text-right font-semibold px-4 py-2.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {reportedSpts.slice(0, 6).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{r.bpeNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.returnType}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.returnType.includes('TAHUNAN')
                        ? `Tahun ${r.tahunPajak}`
                        : `${MASA_NAMES[r.masaPajak - 1]} ${r.tahunPajak}`}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-700">{r.taxPosition}</td>
                    <td className="px-4 py-2.5 text-right font-num">{formatRupiah(r.amountDue)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          openPreviewDoc({
                            kind: 'BPE',
                            title: 'Bukti Penerimaan Elektronik (BPE)',
                            subtitle: `Pelaporan ${r.returnType} — Status DILAPORKAN`,
                            docNumber: r.bpeNumber,
                            date: r.submittedAt.slice(0, 10),
                            taxpayerName:
                              r.taxpayerRole === 'BADAN' ? workspace.badanProfile.nama : workspace.opProfile.nama,
                            taxpayerNpwp:
                              r.taxpayerRole === 'BADAN' ? workspace.badanProfile.npwp : workspace.opProfile.npwp,
                            rows: [
                              { label: 'Jenis Surat Pemberitahuan', value: r.returnType },
                              {
                                label: 'Masa / Tahun Pajak',
                                value: r.returnType.includes('TAHUNAN')
                                  ? `Tahun ${r.tahunPajak}`
                                  : `${MASA_NAMES[r.masaPajak - 1]} ${r.tahunPajak}`,
                              },
                              { label: 'Status Pembetulan', value: r.pembetulanKe === 0 ? 'Normal' : `Pembetulan ke-${r.pembetulanKe}` },
                              { label: 'Status SPT', value: r.taxPosition },
                              { label: 'Jumlah Kurang / Lebih Bayar', value: formatRupiah(r.amountDue), highlight: true },
                              { label: 'Tanggal Penyampaian', value: r.submittedAt.replace('T', ' ').slice(0, 19) },
                            ],
                          })
                        }
                        className="text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                      >
                        Cetak BPE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
