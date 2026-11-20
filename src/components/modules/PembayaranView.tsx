import React, { useState } from 'react';
import { CheckCircle2, Plus, Wallet } from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import { formatRupiah, MASA_NAMES } from '../../lib/taxCalculations';

export const PembayaranView: React.FC = () => {
  const {
    snapshot,
    createStandaloneBilling,
    payBillingCode,
    topUpDeposit,
  } = useSimulator();

  const [activeTab, setActiveTab] = useState<'billing' | 'deposit' | 'ledger'>('billing');
  const [kapKjs, setKapKjs] = useState('411125-100');
  const [desc, setDesc] = useState('Angsuran PPh Pasal 25 Masa');
  const [masa, setMasa] = useState(1);
  const [tahun, setTahun] = useState(2025);
  const [amount, setAmount] = useState(5_000_000);
  const [topUpAmt, setTopUpAmt] = useState(50_000_000);

  if (!snapshot) return null;

  const role = snapshot.workspace.activeRole;
  const activeDeposit =
    role === 'BADAN'
      ? snapshot.workspace.badanProfile.depositBalance
      : snapshot.workspace.opProfile.depositBalance;

  const roleBillings = snapshot.billing.filter((b) => b.taxpayerRole === role);
  const roleLedger = snapshot.ledger.filter((l) => l.taxpayerRole === role);

  const handleCreateBilling = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    createStandaloneBilling({
      kapKjs,
      description: desc,
      masaPajak: masa,
      tahunPajak: tahun,
      amount,
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Pembayaran & Buku Besar</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F]">
            Kode Billing, Deposit Pajak & Buku Besar Wajib Pajak
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Lunasi Kode Billing dari pelaporan SPT (Menunggu Pembayaran) untuk menerbitkan NTPN & BPE secara otomatis.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {[
            { id: 'billing', label: 'Kode Billing' },
            { id: 'deposit', label: 'Deposit Pajak' },
            { id: 'ledger', label: 'Buku Besar (GL)' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                activeTab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Balance Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">
            Saldo Deposit Pajak Aktif ({role === 'BADAN' ? snapshot.workspace.badanProfile.nama : snapshot.workspace.opProfile.nama})
          </div>
          <div className="mt-1 text-2xl font-bold font-num text-[#1A2B5F]">{formatRupiah(activeDeposit)}</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={100000}
            step={1000000}
            value={topUpAmt}
            onChange={(e) => setTopUpAmt(Number(e.target.value) || 0)}
            className="h-9 px-3 border border-slate-300 rounded-md font-num text-xs w-40"
          />
          <button
            type="button"
            onClick={() => topUpDeposit(topUpAmt)}
            className="h-9 px-4 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Top-Up Deposit Simulasi</span>
          </button>
        </div>
      </div>

      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Active Billing List */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1A2B5F]">Daftar Kode Billing ({role})</h2>
              <span className="text-xs text-slate-500">
                {roleBillings.filter((b) => b.status === 'BELUM_BAYAR').length} belum dibayar
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#1A2B5F] text-white">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">ID Billing (15 Digit)</th>
                    <th className="text-left font-semibold px-4 py-2.5">KAP-KJS</th>
                    <th className="text-left font-semibold px-4 py-2.5">Uraian Setoran</th>
                    <th className="text-right font-semibold px-4 py-2.5">Nominal</th>
                    <th className="text-left font-semibold px-4 py-2.5">Status / NTPN</th>
                    <th className="text-right font-semibold px-4 py-2.5">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roleBillings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Belum ada Kode Billing pada akun ini. Buat Kode Billing mandiri di bawah atau melalui pelaporan SPT Kurang Bayar.
                      </td>
                    </tr>
                  ) : (
                    roleBillings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-num font-bold text-[#1A2B5F]">{b.billingNumber}</td>
                        <td className="px-4 py-2.5 font-num">{b.kapKjs}</td>
                        <td className="px-4 py-2.5">
                          <div>{b.description}</div>
                          <div className="text-[11px] text-slate-500">
                            Masa {MASA_NAMES[b.masaPajak - 1]} {b.tahunPajak}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-num font-semibold">{formatRupiah(b.amount)}</td>
                        <td className="px-4 py-2.5">
                          {b.status === 'LUNAS' ? (
                            <div>
                              <span className="font-semibold text-emerald-700">LUNAS</span>
                              <div className="text-[11px] font-num text-slate-500">NTPN: {b.ntpn}</div>
                            </div>
                          ) : (
                            <span className="font-semibold text-amber-700">BELUM BAYAR</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {b.status === 'BELUM_BAYAR' ? (
                            <button
                              type="button"
                              onClick={() => payBillingCode(b.id)}
                              className="px-3 py-1.5 bg-emerald-700 text-white font-bold rounded hover:bg-emerald-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Simulasi Bayar Billing</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">Tercatat di GL</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Standalone Billing Generator */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-bold text-[#1A2B5F] mb-3">Layanan Mandiri Pembuatan Kode Billing</h2>
            <form onSubmit={handleCreateBilling} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">KAP-KJS</label>
                <select
                  value={kapKjs}
                  onChange={(e) => setKapKjs(e.target.value)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                >
                  <option value="411125-100">411125-100 (PPh 25 OP)</option>
                  <option value="411126-100">411126-100 (PPh 25 Badan)</option>
                  <option value="411128-420">411128-420 (PPh Final UMKM 0,5%)</option>
                  <option value="411211-100">411211-100 (PPN Dalam Negeri)</option>
                  <option value="411618-100">411618-100 (Deposit Pajak)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Masa / Tahun</label>
                <div className="flex gap-1.5">
                  <select
                    value={masa}
                    onChange={(e) => setMasa(Number(e.target.value))}
                    className="flex-1 h-9 px-2 border border-slate-300 rounded bg-white"
                  >
                    {MASA_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={tahun}
                    onChange={(e) => setTahun(Number(e.target.value))}
                    className="w-20 h-9 px-2 border border-slate-300 rounded font-num"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uraian</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Setor (Rp)</label>
                <input
                  type="number"
                  min={1000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full h-9 px-2.5 border border-slate-300 rounded font-num"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 bg-[#1A2B5F] text-white font-bold rounded-md hover:bg-[#111D42] inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Billing</span>
              </button>
            </form>
          </section>
        </div>
      )}

      {activeTab === 'deposit' && (
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-[#1A2B5F]">Mekanisme Deposit Pajak Coretax</h2>
          <p className="text-slate-600 leading-relaxed">
            Pada sistem Coretax, Wajib Pajak dapat menyetorkan saldo Deposit Pajak terlebih dahulu menggunakan KAP{' '}
            <span className="font-num font-semibold">411618-100</span>. Saat melakukan pelaporan SPT Kurang Bayar,
            peserta dapat memilih opsi <strong>Pemindahbukuan Saldo Deposit</strong> sehingga pajak langsung lunas dan
            BPE terbit seketika tanpa menunggu pembayaran Kode Billing.
          </p>
        </section>
      )}

      {activeTab === 'ledger' && (
        <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-bold text-[#1A2B5F]">Buku Besar Wajib Pajak (My General Ledger)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#1A2B5F] text-white">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Tanggal</th>
                  <th className="text-left font-semibold px-4 py-2.5">Referensi / NTPN</th>
                  <th className="text-left font-semibold px-4 py-2.5">Uraian Transaksi</th>
                  <th className="text-right font-semibold px-4 py-2.5">Debit</th>
                  <th className="text-right font-semibold px-4 py-2.5">Kredit</th>
                  <th className="text-right font-semibold px-4 py-2.5">Saldo Deposit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {roleLedger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-num">{entry.entryDate}</td>
                    <td className="px-4 py-2.5 font-num font-semibold text-[#1A2B5F]">{entry.referenceNumber}</td>
                    <td className="px-4 py-2.5 text-slate-700">{entry.description}</td>
                    <td className="px-4 py-2.5 text-right font-num text-red-700">
                      {entry.debit > 0 ? formatRupiah(entry.debit) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-num text-emerald-700">
                      {entry.credit > 0 ? formatRupiah(entry.credit) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-num font-bold text-slate-900">
                      {formatRupiah(entry.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
