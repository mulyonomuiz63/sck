import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Lock,
  LogOut,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { adminApi, AdminOverviewPayload } from '../../lib/apiClient';
import {
  CertificateConfig,
  EBupotType,
  EnrolledParticipant,
  ExamAttempt,
  ExamCase,
  ExamModuleType,
  ExamRubricRule,
  ExamRuleType,
  ParticipantStatus,
  TaxPosition,
  TaxReturnType,
} from '../../types/tax';
import { CertificateSheet } from '../CertificateSheet';

const DEFAULT_CERT_DRAFT: CertificateConfig = {
  autoIssueEnabled: true,
  organizationName: 'KelasBrevet — Lembaga Pendidikan Perpajakan',
  certificateTitle: 'SERTIFIKAT KELULUSAN UJIAN PRAKTIK CORETAX',
  programSubtitle: 'Program Pelatihan & Sertifikasi Praktik Administrasi Perpajakan Brevet A & B',
  numberPrefix: 'CERT-KB',
  issueCity: 'Jakarta',
  signer1Name: 'Dr. Hendra Wijaya, BKP',
  signer1Title: 'Direktur Program KelasBrevet',
  signer2Name: 'Rina Kusuma, M.Ak., BKP',
  signer2Title: 'Kepala Penguji Praktik Coretax',
  logoDataUrl: '',
  signature1DataUrl: '',
  signature2DataUrl: '',
  footerNote:
    'Sertifikat ini diterbitkan secara otomatis oleh Sistem Ujian Praktik Simulator Coretax KelasBrevet berdasarkan audit transaksi pada database.',
};

const MODULE_LABELS_ADMIN: Record<ExamModuleType, string> = {
  PPN: 'e-Faktur & SPT Masa PPN',
  PPH21_TAHUNAN: 'PPh 21 Tahunan Karyawan',
  EBUPOT_21_23: 'e-Bupot & SPT Masa PPh 21/23',
  PPH_OP_UMUM: 'SPT Tahunan Orang Pribadi',
  PPH_BADAN: 'SPT Tahunan PPh Badan',
};

const ADMIN_TOKEN_KEY = 'kelasbrevet_admin_token_v1';

const RULE_TYPE_OPTIONS: { value: ExamRuleType; label: string }[] = [
  { value: 'SPT_REPORTED', label: 'SPT Dilaporkan (BPE Terbit)' },
  { value: 'SPT_POSITION_MATCH', label: 'Posisi SPT Cocok (Nihil / KB / LB)' },
  { value: 'SPT_AMOUNT_DUE_MATCH', label: 'Nominal Kurang/Lebih Bayar SPT Cocok' },
  { value: 'SPT_OP_HARTA_UTANG_MIN', label: 'SPT OP: Penghasilan & Harta/Utang L-1 Terisi' },
  { value: 'SPT_BADAN_FISCAL_CHECK', label: 'SPT Badan: Laba Rugi & Koreksi Fiskal Terisi' },
  { value: 'EFAKTUR_OUTPUT_APPROVED_MIN', label: 'e-Faktur Keluaran Disetujui (APPROVED)' },
  { value: 'EFAKTUR_INPUT_CREDITED_MIN', label: 'e-Faktur Masukan Dikreditkan (CREDITED)' },
  { value: 'EFAKTUR_MATCH_AMOUNT', label: 'e-Faktur Cocok Nominal DPP / PPN' },
  { value: 'EBUPOT_ISSUED_MIN', label: 'e-Bupot Terbit Minimal (TELAH_TERBIT)' },
  { value: 'EBUPOT_TOTAL_PPH_MATCH', label: 'e-Bupot Total PPh Terbit Cocok Nominal' },
  { value: 'PAYMENT_SETTLED', label: 'Pembayaran Pajak Lunas (Deposit / NTPN Billing)' },
];

function createEmptyCase(): ExamCase {
  return {
    id: '',
    code: `UJIAN-BARU-${Math.floor(10 + Math.random() * 89)}`,
    title: '',
    moduleType: 'PPN',
    packageAccess: 'ALL',
    passingScore: 75,
    maxAttempts: 3,
    isActive: true,
    scenarioText: '',
    rubric: [
      {
        id: `rule_${Date.now()}`,
        type: 'SPT_REPORTED',
        label: 'SPT telah dilaporkan hingga nomor BPE terbit',
        weight: 100,
        returnType: 'PPN',
        masaPajak: 1,
        tahunPajak: 2025,
      },
    ],
  };
}

interface AdminPortalViewProps {
  onExitAdmin: () => void;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({ onExitAdmin }) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [username, setUsername] = useState('admin@kelasbrevet.com');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'results' | 'participants' | 'cases' | 'certificate' | 'integration'
  >('results');
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Filters for Results tab
  const [resQuery, setResQuery] = useState('');
  const [resCaseFilter, setResCaseFilter] = useState('ALL');
  const [resStatusFilter, setResStatusFilter] = useState('ALL');
  const [inspectAttempt, setInspectAttempt] = useState<ExamAttempt | null>(null);
  const [previewCertAttempt, setPreviewCertAttempt] = useState<ExamAttempt | null>(null);

  // Participants form & CSV import
  const [partQuery, setPartQuery] = useState('');
  const [partForm, setPartForm] = useState<EnrolledParticipant>({
    nik: '',
    fullName: '',
    email: '',
    phone: '',
    packageCode: 'BREVET_AB',
    orderId: '',
    status: 'ACTIVE',
    expiresAt: '',
    source: 'ADMIN',
  });
  const [csvText, setCsvText] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);

  // Case editor state
  const [editingCase, setEditingCase] = useState<ExamCase | null>(null);

  // Certificate settings state
  const [certDraft, setCertDraft] = useState<CertificateConfig>(DEFAULT_CERT_DRAFT);
  const [savingCert, setSavingCert] = useState(false);

  // Integration simulator & settings state
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [codeLang, setCodeLang] = useState<'php' | 'node'>('php');
  const [simForm, setSimForm] = useState({
    nik: '3273019901010008',
    fullName: 'Siti Rahmawati (Uji Pembelian)',
    email: 'siti.rahmawati@example.com',
    packageCode: 'BREVET_AB',
    orderId: 'INV-KB-TEST-01',
  });
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<{
    participant: EnrolledParticipant;
    loginUrl: string;
  } | null>(null);

  const showNotice = useCallback((tone: 'success' | 'error', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadOverview = useCallback(
    async (activeToken: string) => {
      if (!activeToken) return;
      setLoading(true);
      try {
        const res = await adminApi.getOverview(activeToken);
        if (res.status === 401) {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setToken('');
          setAuthError('Sesi Admin telah berakhir. Silakan login kembali.');
          return;
        }
        if (res.ok && res.data) {
          setOverview(res.data);
          setWebhookUrlInput(res.data.settings.webhookCallbackUrl || '');
          if (res.data.settings.certificate) {
            setCertDraft({ ...DEFAULT_CERT_DRAFT, ...res.data.settings.certificate });
          }
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (token) {
      void loadOverview(token);
    }
  }, [token, loadOverview]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await adminApi.login(username, password);
      if (!res.ok || !res.data?.token) {
        setAuthError(res.error || 'Username atau password admin salah.');
        return;
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      setPassword('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken('');
    setOverview(null);
  };

  // --- Computed Metrics ---
  const stats = useMemo(() => {
    if (!overview) {
      return { activeParticipants: 0, totalCompleted: 0, passedCount: 0, passRate: 0 };
    }
    const activeParticipants = overview.participants.filter((p) => p.status === 'ACTIVE').length;
    const completed = overview.attempts.filter((a) => a.status !== 'IN_PROGRESS');
    const passedCount = completed.filter((a) => a.status === 'PASSED').length;
    const passRate = completed.length > 0 ? Math.round((passedCount / completed.length) * 100) : 0;
    return { activeParticipants, totalCompleted: completed.length, passedCount, passRate };
  }, [overview]);

  const filteredAttempts = useMemo(() => {
    if (!overview) return [];
    const q = resQuery.trim().toLowerCase();
    return overview.attempts.filter((a) => {
      if (resCaseFilter !== 'ALL' && a.caseId !== resCaseFilter) return false;
      if (resStatusFilter !== 'ALL' && a.status !== resStatusFilter) return false;
      if (q) {
        const hay = `${a.nik} ${a.participantName} ${a.packageCode} ${a.caseCode || ''} ${a.caseTitle || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [overview, resCaseFilter, resQuery, resStatusFilter]);

  const filteredParticipants = useMemo(() => {
    if (!overview) return [];
    const q = partQuery.trim().toLowerCase();
    if (!q) return overview.participants;
    return overview.participants.filter((p) =>
      `${p.nik} ${p.fullName} ${p.email} ${p.packageCode} ${p.orderId}`.toLowerCase().includes(q)
    );
  }, [overview, partQuery]);

  // --- Actions ---
  const handleToggleWhitelist = async () => {
    if (!overview) return;
    const nextVal = !overview.settings.whitelistEnforced;
    const res = await adminApi.updateSettings(token, { whitelistEnforced: nextVal });
    if (res.ok) {
      showNotice(
        'success',
        nextVal
          ? 'Mode Whitelist Ketat AKTIF: hanya NIK terdaftar paket kelasbrevet.com yang dapat masuk.'
          : 'Mode Akses Terbuka AKTIF: semua NIK 16 digit dapat mencoba simulator.'
      );
      await loadOverview(token);
    } else {
      showNotice('error', res.error || 'Gagal menyimpan pengaturan.');
    }
  };

  const handleSaveWebhookUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminApi.updateSettings(token, { webhookCallbackUrl: webhookUrlInput });
    if (res.ok) {
      showNotice('success', 'URL Callback hasil ujian ke kelasbrevet.com berhasil disimpan.');
      await loadOverview(token);
    } else {
      showNotice('error', res.error || 'Gagal menyimpan URL callback.');
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNik = partForm.nik.replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      showNotice('error', 'NIK peserta harus tepat 16 digit angka.');
      return;
    }
    const res = await adminApi.saveParticipant(token, { ...partForm, nik: cleanNik });
    if (res.ok) {
      showNotice('success', `NIK ${cleanNik} (${partForm.fullName || 'Peserta'}) berhasil disimpan ke whitelist.`);
      setPartForm({
        nik: '',
        fullName: '',
        email: '',
        phone: '',
        packageCode: 'BREVET_AB',
        orderId: '',
        status: 'ACTIVE',
        expiresAt: '',
        source: 'ADMIN',
      });
      await loadOverview(token);
    } else {
      showNotice('error', res.error || 'Gagal menyimpan peserta.');
    }
  };

  const handleCsvImport = async () => {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: EnrolledParticipant[] = [];
    for (const line of lines) {
      const cols = line.split(/[,;\t]/).map((c) => c.trim());
      const nik = (cols[0] || '').replace(/\D/g, '');
      if (nik.length !== 16) continue;
      parsed.push({
        nik,
        fullName: cols[1] || `PESERTA ${nik.slice(-4)}`,
        email: cols[2] || '',
        phone: cols[3] || '',
        packageCode: (cols[4] || 'BREVET_AB').toUpperCase(),
        expiresAt: cols[5] || '',
        orderId: cols[6] || '',
        status: 'ACTIVE',
        source: 'CSV_IMPORT',
      });
    }
    if (parsed.length === 0) {
      showNotice('error', 'Tidak ditemukan baris dengan NIK 16 digit yang valid.');
      return;
    }
    const res = await adminApi.importParticipants(token, parsed);
    if (res.ok && res.data) {
      showNotice('success', `${res.data.imported} peserta berhasil diimpor ke whitelist aktif.`);
      setCsvText('');
      setShowCsvImport(false);
      await loadOverview(token);
    } else {
      showNotice('error', res.error || 'Gagal mengimpor CSV.');
    }
  };

  const handleToggleParticipantStatus = async (p: EnrolledParticipant) => {
    const next: ParticipantStatus = p.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await adminApi.updateParticipantStatus(token, p.nik, next);
    if (res.ok) {
      showNotice('success', `Status NIK ${p.nik} diubah menjadi ${next}.`);
      await loadOverview(token);
    }
  };

  const handleDeleteParticipant = async (nik: string) => {
    const res = await adminApi.deleteParticipant(token, nik);
    if (res.ok) {
      showNotice('success', `NIK ${nik} dihapus dari daftar whitelist.`);
      await loadOverview(token);
    }
  };

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;
    if (!editingCase.code.trim() || !editingCase.title.trim()) {
      showNotice('error', 'Kode dan Judul Kasus wajib diisi.');
      return;
    }
    if (editingCase.rubric.length === 0) {
      showNotice('error', 'Tambahkan minimal 1 kriteria penilaian otomatis.');
      return;
    }
    const res = await adminApi.saveExamCase(token, editingCase);
    if (res.ok) {
      showNotice('success', `Soal ujian "${editingCase.code}" berhasil disimpan.`);
      setEditingCase(null);
      await loadOverview(token);
    } else {
      showNotice('error', res.error || 'Gagal menyimpan kasus ujian.');
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    const res = await adminApi.deleteExamCase(token, caseId);
    if (res.ok) {
      showNotice('success', 'Kasus ujian dihapus.');
      await loadOverview(token);
    }
  };

  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCert(true);
    try {
      const res = await adminApi.updateSettings(token, { certificate: certDraft });
      if (res.ok) {
        showNotice('success', 'Pengaturan sertifikat kelulusan berhasil disimpan. Semua sertifikat peserta akan memakai format ini.');
        await loadOverview(token);
      } else {
        showNotice('error', res.error || 'Gagal menyimpan pengaturan sertifikat.');
      }
    } finally {
      setSavingCert(false);
    }
  };

  const handleCertImageUpload = (
    field: 'logoDataUrl' | 'signature1DataUrl' | 'signature2DataUrl',
    file: File | undefined
  ) => {
    if (!file) return;
    if (file.size > 350 * 1024) {
      showNotice('error', 'Ukuran gambar maksimal 350 KB agar ringan disimpan di database.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setCertDraft((prev) => ({ ...prev, [field]: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSimulatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await adminApi.simulatePurchase(token, simForm);
      if (res.ok && res.data) {
        setSimResult({ participant: res.data.participant, loginUrl: res.data.loginUrl });
        showNotice(
          'success',
          `Simulasi berhasil! Peserta ${res.data.participant.fullName} (${res.data.participant.nik}) langsung aktif di daftar Peserta NIK.`
        );
        await loadOverview(token);
      } else {
        showNotice('error', res.error || 'Simulasi pembelian gagal.');
      }
    } finally {
      setSimRunning(false);
    }
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    showNotice('success', `${label} berhasil disalin ke clipboard.`);
  };

  const handleExportCsv = () => {
    const headers = [
      'NIK',
      'Nama Peserta',
      'Paket',
      'Kode Kasus',
      'Judul Kasus',
      'Percobaan',
      'Skor',
      'KKM',
      'Status Kelulusan',
      'No Sertifikat',
      'Waktu Selesai',
    ];
    const rows = filteredAttempts.map((a) => [
      `="${a.nik}"`,
      `"${(a.participantName || '').replace(/"/g, '""')}"`,
      a.packageCode,
      a.caseCode || a.caseId,
      `"${(a.caseTitle || '').replace(/"/g, '""')}"`,
      String(a.attemptNumber),
      String(a.score),
      String(a.passingScore),
      a.status === 'PASSED' ? 'LULUS' : a.status === 'FAILED' ? 'BELUM_LULUS' : 'SEDANG_DIKERJAKAN',
      a.certificateNumber || '-',
      a.submittedAt || '-',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rekap-kelulusan-kelasbrevet-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Admin Login Gate ---
  if (!token) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        <header className="bg-[#1A2B5F] text-white border-b-4 border-[#F5C518]">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <span className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
              KelasBrevet Admin
            </span>
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs font-semibold text-slate-200 hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Portal Peserta</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#B45309]">
              <Lock className="w-4 h-4" />
              <span>Panel Pengelola &amp; Evaluasi</span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-[#1A2B5F]">Masuk Portal Admin KelasBrevet</h1>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Kelola whitelist NIK peserta pembeli paket, susun kasus ujian praktik &amp; rubrik penilaian
              otomatis, serta pantau kelulusan seluruh peserta.
            </p>

            {authError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
                {authError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username / Email Admin</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password Admin</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin"
                  className="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B5F]"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-10 bg-[#1A2B5F] text-white text-sm font-bold rounded-md hover:bg-[#111D42] disabled:opacity-50 cursor-pointer"
              >
                {authLoading ? 'Memverifikasi...' : 'Masuk Dashboard Admin'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://simulator.kelasbrevet.com';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 h-16 bg-[#1A2B5F] text-white border-b-2 border-[#F5C518]">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-8">
          <span className="text-base font-bold tracking-tight whitespace-nowrap shrink-0">
            KelasBrevet Admin
          </span>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold">
            {[
              { id: 'results', label: 'Rekap Nilai' },
              { id: 'participants', label: 'Peserta NIK' },
              { id: 'cases', label: 'Bank Soal' },
              { id: 'certificate', label: 'Sertifikat' },
              { id: 'integration', label: 'Koneksi kelasbrevet.com' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  activeTab === t.id
                    ? 'border-[#F5C518] text-[#F5C518]'
                    : 'border-transparent text-slate-200 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onExitAdmin}
              className="h-9 px-3 bg-white/10 text-white text-xs font-semibold rounded-md hover:bg-white/20 whitespace-nowrap cursor-pointer"
            >
              Portal Peserta
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-3 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Mobile Tabs */}
        <div className="flex md:hidden items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
          {[
            { id: 'results', label: 'Rekap Nilai' },
            { id: 'participants', label: 'Peserta NIK' },
            { id: 'cases', label: 'Bank Soal' },
            { id: 'certificate', label: 'Sertifikat' },
            { id: 'integration', label: 'Koneksi Web' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                activeTab === t.id ? 'bg-white text-[#1A2B5F] shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Notice Banner */}
        {notice && (
          <div
            className={`px-4 py-3 rounded-md border text-xs font-medium flex items-center justify-between gap-4 ${
              notice.tone === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* KPI Overview Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Peserta Terdaftar Aktif</div>
            <div className="mt-1 text-2xl font-bold font-num text-[#1A2B5F]">{stats.activeParticipants}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              Mode akses: <strong>{overview?.settings.whitelistEnforced ? 'Whitelist Ketat' : 'Terbuka'}</strong>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Total Ujian Selesai Dinilai</div>
            <div className="mt-1 text-2xl font-bold font-num text-slate-900">{stats.totalCompleted}</div>
            <div className="mt-1 text-[11px] text-slate-500">Dinilai otomatis oleh sistem</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Peserta Lulus</div>
            <div className="mt-1 text-2xl font-bold font-num text-emerald-700">{stats.passedCount}</div>
            <div className="mt-1 text-[11px] text-slate-500">Tingkat kelulusan {stats.passRate}%</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs text-slate-500">Bank Soal Aktif</div>
            <div className="mt-1 text-2xl font-bold font-num text-[#1A2B5F]">
              {overview?.examCases.filter((c) => c.isActive).length || 0}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Total {overview?.examCases.length || 0} kasus tersimpan</div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: REKAP NILAI & KELULUSAN                                   */}
        {/* ================================================================ */}
        {activeTab === 'results' && (
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resQuery}
                    onChange={(e) => setResQuery(e.target.value)}
                    placeholder="Cari NIK, nama, paket..."
                    className="w-full h-9 pl-8 pr-3 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <select
                  value={resCaseFilter}
                  onChange={(e) => setResCaseFilter(e.target.value)}
                  className="h-9 px-3 border border-slate-300 rounded-md text-xs bg-white"
                >
                  <option value="ALL">Semua Kasus Ujian</option>
                  {overview?.examCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={resStatusFilter}
                  onChange={(e) => setResStatusFilter(e.target.value)}
                  className="h-9 px-3 border border-slate-300 rounded-md text-xs bg-white"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PASSED">LULUS</option>
                  <option value="FAILED">BELUM LULUS</option>
                  <option value="IN_PROGRESS">SEDANG DIKERJAKAN</option>
                </select>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadOverview(token)}
                  className="h-9 px-3 border border-slate-300 text-xs font-semibold text-slate-700 rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="h-9 px-3.5 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">NIK &amp; Peserta</th>
                    <th className="text-left font-semibold px-4 py-2.5">Paket</th>
                    <th className="text-left font-semibold px-4 py-2.5">Kasus Ujian</th>
                    <th className="text-right font-semibold px-4 py-2.5">Percobaan</th>
                    <th className="text-right font-semibold px-4 py-2.5">Skor / KKM</th>
                    <th className="text-left font-semibold px-4 py-2.5">Kelulusan &amp; Sertifikat</th>
                    <th className="text-left font-semibold px-4 py-2.5">Waktu Selesai</th>
                    <th className="text-right font-semibold px-4 py-2.5">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                        Belum ada data pengerjaan ujian peserta yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAttempts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{a.participantName}</div>
                          <div className="font-num text-[11px] text-slate-500">{a.nik}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1A2B5F]">{a.packageCode}</td>
                        <td className="px-4 py-3">
                          <div className="font-num font-semibold text-slate-800">{a.caseCode || a.caseId}</div>
                          <div className="text-[11px] text-slate-500 max-w-xs truncate">{a.caseTitle}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-num">#{a.attemptNumber}</td>
                        <td className="px-4 py-3 text-right font-num font-bold text-slate-900">
                          {a.score} / {a.passingScore}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {a.status === 'PASSED' ? (
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>LULUS</span>
                              </span>
                              {a.certificateNumber && (
                                <div className="font-num text-[11px] text-slate-500 mt-0.5">
                                  {a.certificateNumber}
                                </div>
                              )}
                            </div>
                          ) : a.status === 'FAILED' ? (
                            <span className="inline-flex items-center gap-1 font-bold text-red-700">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>BELUM LULUS</span>
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-700">DIKERJAKAN</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-num text-slate-600 whitespace-nowrap">
                          {a.submittedAt ? a.submittedAt.replace('T', ' ').slice(0, 19) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setInspectAttempt(a)}
                              className="inline-flex items-center gap-1 text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Audit</span>
                            </button>
                            {a.status === 'PASSED' && (
                              <button
                                type="button"
                                onClick={() => setPreviewCertAttempt(a)}
                                className="inline-flex items-center gap-1 text-[#B45309] font-semibold hover:underline cursor-pointer"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>Sertifikat</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* TAB 2: PESERTA & WHITELIST NIK                                   */}
        {/* ================================================================ */}
        {activeTab === 'participants' && (
          <div className="space-y-6">
            {/* Access Gate Mode Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-[#1A2B5F] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Gerbang Verifikasi Pembeli Paket kelasbrevet.com</span>
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Saat <strong>Whitelist Ketat Aktif</strong>, hanya peserta yang NIK-nya terdaftar aktif (dari webhook
                  pembelian paket atau input admin) yang dapat login ke simulator.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleWhitelist()}
                className={`h-10 px-4 text-xs font-bold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  overview?.settings.whitelistEnforced
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {overview?.settings.whitelistEnforced
                  ? 'Mode: Whitelist Ketat (Aktif)'
                  : 'Mode: Terbuka (Semua NIK Bisa Masuk)'}
              </button>
            </div>

            {/* Add Participant Form */}
            <form onSubmit={handleAddParticipant} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-[#1A2B5F] flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Tambah / Perbarui Peserta NIK Manual</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCsvImport((v) => !v)}
                  className="h-8 px-3 border border-slate-300 text-xs font-semibold text-[#1A2B5F] rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{showCsvImport ? 'Tutup Import CSV' : 'Import Massal CSV'}</span>
                </button>
              </div>

              {showCsvImport && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3">
                  <div className="text-xs text-slate-700">
                    Tempel data CSV (1 peserta per baris):{' '}
                    <span className="font-num font-semibold">NIK16Digit,Nama,Email,NoHP,Paket,ExpiredYYYY-MM-DD</span>
                  </div>
                  <textarea
                    rows={5}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder={`3273010101950001,Siti Rahmawati,siti@email.com,08123456789,BREVET_AB,2026-12-31\n3174020202960002,Andi Wijaya,andi@email.com,08129876543,BREVET_A,2026-12-31`}
                    className="w-full p-3 border border-slate-300 rounded-md font-num text-xs bg-white"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleCsvImport()}
                      className="h-9 px-4 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] cursor-pointer"
                    >
                      Impor Daftar NIK ke MySQL
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                <input
                  type="text"
                  required
                  maxLength={16}
                  placeholder="NIK 16 Digit *"
                  value={partForm.nik}
                  onChange={(e) => setPartForm({ ...partForm, nik: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                  className="h-9 px-3 border border-slate-300 rounded-md font-num"
                />
                <input
                  type="text"
                  required
                  placeholder="Nama Lengkap *"
                  value={partForm.fullName}
                  onChange={(e) => setPartForm({ ...partForm, fullName: e.target.value })}
                  className="h-9 px-3 border border-slate-300 rounded-md"
                />
                <input
                  type="email"
                  placeholder="Email (opsional)"
                  value={partForm.email}
                  onChange={(e) => setPartForm({ ...partForm, email: e.target.value })}
                  className="h-9 px-3 border border-slate-300 rounded-md"
                />
                <select
                  value={partForm.packageCode}
                  onChange={(e) => setPartForm({ ...partForm, packageCode: e.target.value })}
                  className="h-9 px-3 border border-slate-300 rounded-md bg-white"
                >
                  <option value="BREVET_AB">BREVET_AB (Lengkap)</option>
                  <option value="BREVET_A">BREVET_A</option>
                  <option value="BREVET_B">BREVET_B</option>
                  <option value="TRIAL">TRIAL</option>
                </select>
                <input
                  type="date"
                  title="Masa berlaku (kosongkan = tanpa batas)"
                  value={partForm.expiresAt}
                  onChange={(e) => setPartForm({ ...partForm, expiresAt: e.target.value })}
                  className="h-9 px-3 border border-slate-300 rounded-md font-num"
                />
                <button
                  type="submit"
                  className="h-9 px-4 bg-[#1A2B5F] text-white font-bold rounded-md hover:bg-[#111D42] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan NIK</span>
                </button>
              </div>
            </form>

            {/* Participants Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={partQuery}
                    onChange={(e) => setPartQuery(e.target.value)}
                    placeholder="Cari NIK, nama, email, order ID..."
                    className="w-full h-9 pl-8 pr-3 border border-slate-300 rounded-md text-xs"
                  />
                </div>
                <span className="text-xs font-num text-slate-500">{filteredParticipants.length} peserta</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">NIK 16 Digit</th>
                      <th className="text-left font-semibold px-4 py-2.5">Nama &amp; Email</th>
                      <th className="text-left font-semibold px-4 py-2.5">Paket / Order ID</th>
                      <th className="text-left font-semibold px-4 py-2.5">Aktif s.d.</th>
                      <th className="text-left font-semibold px-4 py-2.5">Sumber</th>
                      <th className="text-left font-semibold px-4 py-2.5">Status</th>
                      <th className="text-right font-semibold px-4 py-2.5">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredParticipants.map((p) => (
                      <tr key={p.nik} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-num font-semibold text-[#1A2B5F]">{p.nik}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{p.fullName}</div>
                          <div className="text-[11px] text-slate-500">{p.email || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{p.packageCode}</div>
                          <div className="font-num text-[11px] text-slate-500">{p.orderId || '-'}</div>
                        </td>
                        <td className="px-4 py-3 font-num text-slate-600">{p.expiresAt || 'Tanpa batas'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.source}</td>
                        <td className="px-4 py-3 font-bold">
                          <span
                            className={
                              p.status === 'ACTIVE'
                                ? 'text-emerald-700'
                                : p.status === 'SUSPENDED'
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-3">
                          <button
                            type="button"
                            onClick={() => void handleToggleParticipantStatus(p)}
                            className="text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                          >
                            {p.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteParticipant(p.nik)}
                            className="text-red-700 font-semibold hover:underline cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: BANK SOAL & VISUAL RUBRIC AUTO-GRADER BUILDER             */}
        {/* ================================================================ */}
        {activeTab === 'cases' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#1A2B5F]">Bank Soal &amp; Kunci Penilaian Otomatis</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Atur narasi studi kasus, nilai KKM, paket yang berhak mengakses, serta indikator kunci jawaban otomatis.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCase(createEmptyCase())}
                className="h-10 px-4 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <FilePlus2 className="w-4 h-4 text-[#F5C518]" />
                <span>Buat Soal Ujian Baru</span>
              </button>
            </div>

            {editingCase && (
              <form onSubmit={handleSaveCase} className="bg-white border border-slate-300 rounded-lg p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-[#1A2B5F]">
                    {editingCase.id ? `Edit Soal: ${editingCase.code}` : 'Tambah Soal Ujian Baru'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingCase(null)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kode Soal *</label>
                    <input
                      type="text"
                      required
                      value={editingCase.code}
                      onChange={(e) => setEditingCase({ ...editingCase, code: e.target.value })}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md font-num"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Judul Kasus Ujian *</label>
                    <input
                      type="text"
                      required
                      value={editingCase.title}
                      onChange={(e) => setEditingCase({ ...editingCase, title: e.target.value })}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Modul Pajak</label>
                    <select
                      value={editingCase.moduleType}
                      onChange={(e) =>
                        setEditingCase({ ...editingCase, moduleType: e.target.value as ExamModuleType })
                      }
                      className="w-full h-9 px-3 border border-slate-300 rounded-md bg-white"
                    >
                      <option value="PPN">SPT Masa PPN &amp; e-Faktur</option>
                      <option value="PPH21_TAHUNAN">PPh 21 Tahunan Karyawan</option>
                      <option value="EBUPOT_21_23">e-Bupot &amp; SPT Masa PPh 21/23</option>
                      <option value="PPH_OP_UMUM">SPT Tahunan Orang Pribadi</option>
                      <option value="PPH_BADAN">SPT Tahunan PPh Badan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Akses Paket (pisah koma / ALL)</label>
                    <input
                      type="text"
                      value={editingCase.packageAccess}
                      onChange={(e) => setEditingCase({ ...editingCase, packageAccess: e.target.value })}
                      placeholder="ALL atau BREVET_A,BREVET_AB"
                      className="w-full h-9 px-3 border border-slate-300 rounded-md font-num"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nilai KKM Lulus (1-100)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={editingCase.passingScore}
                      onChange={(e) => setEditingCase({ ...editingCase, passingScore: Number(e.target.value) })}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md font-num"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Maksimal Percobaan</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editingCase.maxAttempts}
                      onChange={(e) => setEditingCase({ ...editingCase, maxAttempts: Number(e.target.value) })}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md font-num"
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingCase.isActive}
                        onChange={(e) => setEditingCase({ ...editingCase, isActive: e.target.checked })}
                      />
                      <span>Aktif (tampil ke peserta)</span>
                    </label>
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 mb-1">Narasi Soal &amp; Data Transaksi</label>
                  <textarea
                    rows={5}
                    value={editingCase.scenarioText}
                    onChange={(e) => setEditingCase({ ...editingCase, scenarioText: e.target.value })}
                    placeholder="Tuliskan instruksi kasus dan angka transaksi yang harus dikerjakan peserta..."
                    className="w-full p-3 border border-slate-300 rounded-md leading-relaxed"
                  />
                </div>

                {/* Rubric Rules Builder */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#1A2B5F]">
                      Rubrik Kunci Jawaban Otomatis · Total Bobot:{' '}
                      <span className="font-num">
                        {editingCase.rubric.reduce((s, r) => s + (Number(r.weight) || 0), 0)} poin
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingCase({
                          ...editingCase,
                          rubric: [
                            ...editingCase.rubric,
                            {
                              id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                              type: 'SPT_REPORTED',
                              label: 'Kriteria penilaian baru',
                              weight: 20,
                              returnType: 'PPN',
                              tahunPajak: 2025,
                            },
                          ],
                        })
                      }
                      className="h-8 px-3 border border-slate-300 text-xs font-semibold text-[#1A2B5F] rounded-md hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Kriteria</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingCase.rubric.map((rule, idx) => {
                      const updateRule = (patch: Partial<ExamRubricRule>) => {
                        setEditingCase({
                          ...editingCase,
                          rubric: editingCase.rubric.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
                        });
                      };
                      return (
                        <div key={rule.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2.5 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                            <div className="md:col-span-4">
                              <select
                                value={rule.type}
                                onChange={(e) => updateRule({ type: e.target.value as ExamRuleType })}
                                className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                              >
                                {RULE_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-5">
                              <input
                                type="text"
                                value={rule.label}
                                onChange={(e) => updateRule({ label: e.target.value })}
                                placeholder="Deskripsi kriteria yang ditampilkan ke peserta"
                                className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={rule.weight}
                                onChange={(e) => updateRule({ weight: Number(e.target.value) })}
                                placeholder="Bobot"
                                className="w-full h-9 px-2.5 border border-slate-300 rounded bg-white font-num"
                              />
                            </div>
                            <div className="md:col-span-1 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCase({
                                    ...editingCase,
                                    rubric: editingCase.rubric.filter((_, i) => i !== idx),
                                  })
                                }
                                className="p-2 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Hapus kriteria"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Dynamic parameter fields */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {['SPT_REPORTED', 'SPT_POSITION_MATCH', 'SPT_AMOUNT_DUE_MATCH'].includes(rule.type) && (
                              <select
                                value={rule.returnType || 'PPN'}
                                onChange={(e) => updateRule({ returnType: e.target.value as TaxReturnType })}
                                className="h-8 px-2 border border-slate-300 rounded bg-white"
                              >
                                <option value="PPN">SPT PPN</option>
                                <option value="PPH21_MASA">SPT PPh 21 Masa</option>
                                <option value="PPH_UNIFIKASI">SPT Unifikasi</option>
                                <option value="PPH_OP_TAHUNAN">SPT OP Tahunan</option>
                                <option value="PPH_BADAN_TAHUNAN">SPT Badan Tahunan</option>
                              </select>
                            )}
                            {rule.type === 'SPT_POSITION_MATCH' && (
                              <select
                                value={rule.expectedPosition || 'NIHIL'}
                                onChange={(e) => updateRule({ expectedPosition: e.target.value as TaxPosition })}
                                className="h-8 px-2 border border-slate-300 rounded bg-white"
                              >
                                <option value="NIHIL">Posisi: NIHIL</option>
                                <option value="KURANG_BAYAR">Posisi: KURANG_BAYAR</option>
                                <option value="LEBIH_BAYAR">Posisi: LEBIH_BAYAR</option>
                              </select>
                            )}
                            {['EBUPOT_ISSUED_MIN', 'EBUPOT_TOTAL_PPH_MATCH'].includes(rule.type) && (
                              <select
                                value={rule.slipType || 'MP'}
                                onChange={(e) => updateRule({ slipType: e.target.value as EBupotType | 'ANY' })}
                                className="h-8 px-2 border border-slate-300 rounded bg-white"
                              >
                                <option value="MP">Slip: MP (TER)</option>
                                <option value="BP21">Slip: BP21</option>
                                <option value="BPA1">Slip: BPA1</option>
                                <option value="BPPU">Slip: BPPU (PPh 23)</option>
                                <option value="ANY">Semua Jenis Slip</option>
                              </select>
                            )}
                            {[
                              'EFAKTUR_OUTPUT_APPROVED_MIN',
                              'EFAKTUR_INPUT_CREDITED_MIN',
                              'EBUPOT_ISSUED_MIN',
                              'SPT_OP_HARTA_UTANG_MIN',
                              'SPT_BADAN_FISCAL_CHECK',
                            ].includes(rule.type) && (
                              <input
                                type="number"
                                min={1}
                                value={rule.minCount ?? 1}
                                onChange={(e) => updateRule({ minCount: Number(e.target.value) })}
                                placeholder="Min. Jumlah"
                                title="Minimal jumlah dokumen/item"
                                className="h-8 px-2 border border-slate-300 rounded bg-white font-num"
                              />
                            )}
                            {[
                              'EFAKTUR_MATCH_AMOUNT',
                              'EBUPOT_TOTAL_PPH_MATCH',
                              'SPT_AMOUNT_DUE_MATCH',
                              'SPT_BADAN_FISCAL_CHECK',
                            ].includes(rule.type) && (
                              <input
                                type="number"
                                value={rule.targetAmount ?? 0}
                                onChange={(e) => updateRule({ targetAmount: Number(e.target.value) })}
                                placeholder="Target Rupiah"
                                title="Target nominal rupiah"
                                className="h-8 px-2 border border-slate-300 rounded bg-white font-num"
                              />
                            )}
                            {rule.type === 'PAYMENT_SETTLED' && (
                              <select
                                value={rule.taxpayerRole || 'BADAN'}
                                onChange={(e) => updateRule({ taxpayerRole: e.target.value as 'OP' | 'BADAN' })}
                                className="h-8 px-2 border border-slate-300 rounded bg-white"
                              >
                                <option value="BADAN">Wajib Pajak Badan</option>
                                <option value="OP">Wajib Pajak OP</option>
                              </select>
                            )}
                            <input
                              type="number"
                              min={0}
                              max={12}
                              value={rule.masaPajak ?? 0}
                              onChange={(e) => updateRule({ masaPajak: Number(e.target.value) || undefined })}
                              placeholder="Masa (0=bebas)"
                              title="Masa Pajak (0 untuk semua masa)"
                              className="h-8 px-2 border border-slate-300 rounded bg-white font-num"
                            />
                            <input
                              type="number"
                              min={0}
                              value={rule.tahunPajak ?? 2025}
                              onChange={(e) => updateRule({ tahunPajak: Number(e.target.value) || undefined })}
                              placeholder="Tahun (mis. 2025)"
                              title="Tahun Pajak"
                              className="h-8 px-2 border border-slate-300 rounded bg-white font-num"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingCase(null)}
                    className="h-9 px-4 border border-slate-300 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-5 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Soal &amp; Rubrik</span>
                  </button>
                </div>
              </form>
            )}

            {/* Existing Cases Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview?.examCases.map((c) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-num font-bold text-[#B45309]">{c.code}</span>
                      <span className={`font-bold ${c.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {c.isActive ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-[#1A2B5F]">{c.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>Paket: <strong className="text-slate-700">{c.packageAccess}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>KKM: <strong className="font-num text-slate-700">{c.passingScore}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>Maks: <strong className="font-num text-slate-700">{c.maxAttempts}x</strong></span>
                      <span aria-hidden="true">·</span>
                      <span><strong className="font-num text-slate-700">{c.rubric.length}</strong> kriteria otomatis</span>
                    </div>
                    <p className="mt-2.5 text-xs text-slate-600 line-clamp-3 leading-relaxed">{c.scenarioText}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingCase(c)}
                      className="font-semibold text-[#1A2B5F] hover:underline cursor-pointer"
                    >
                      Edit Soal &amp; Rubrik
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCase(c.id)}
                      className="font-semibold text-red-700 hover:underline cursor-pointer"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: PENGATURAN SERTIFIKAT KELULUSAN OTOMATIS                  */}
        {/* ================================================================ */}
        {activeTab === 'certificate' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left: Form Pengaturan Sertifikat */}
            <form
              onSubmit={handleSaveCertificate}
              className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
            >
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1A2B5F] flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#B45309]" />
                    <span>Pengaturan Sertifikat Otomatis</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Peserta yang dinyatakan LULUS otomatis langsung menerima sertifikat dengan format ini.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={certDraft.autoIssueEnabled}
                  onChange={(e) => setCertDraft((p) => ({ ...p, autoIssueEnabled: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-[#1A2B5F]">Terbitkan Sertifikat Otomatis Saat Lulus</strong>
                  <span className="block text-slate-500 mt-0.5">
                    Nomor sertifikat resmi berurutan akan otomatis dibuat begitu nilai peserta mencapai KKM.
                  </span>
                </span>
              </label>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lembaga / Penyelenggara</label>
                  <input
                    type="text"
                    required
                    value={certDraft.organizationName}
                    onChange={(e) => setCertDraft((p) => ({ ...p, organizationName: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Judul Sertifikat</label>
                  <input
                    type="text"
                    required
                    value={certDraft.certificateTitle}
                    onChange={(e) => setCertDraft((p) => ({ ...p, certificateTitle: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Keterangan / Subjudul Program</label>
                  <input
                    type="text"
                    value={certDraft.programSubtitle}
                    onChange={(e) => setCertDraft((p) => ({ ...p, programSubtitle: e.target.value }))}
                    className="w-full h-9 px-3 border border-slate-300 rounded-md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Prefix Nomor Sertifikat</label>
                    <input
                      type="text"
                      value={certDraft.numberPrefix}
                      onChange={(e) =>
                        setCertDraft((p) => ({
                          ...p,
                          numberPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''),
                        }))
                      }
                      placeholder="CERT-KB"
                      className="w-full h-9 px-3 border border-slate-300 rounded-md font-num"
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block font-num">
                      Hasil: {certDraft.numberPrefix || 'CERT-KB'}/{new Date().getFullYear()}/0001
                    </span>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kota Terbit</label>
                    <input
                      type="text"
                      value={certDraft.issueCity}
                      onChange={(e) => setCertDraft((p) => ({ ...p, issueCity: e.target.value }))}
                      placeholder="Jakarta"
                      className="w-full h-9 px-3 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Penandatangan 1 (Nama)</label>
                    <input
                      type="text"
                      value={certDraft.signer1Name}
                      onChange={(e) => setCertDraft((p) => ({ ...p, signer1Name: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jabatan 1</label>
                    <input
                      type="text"
                      value={certDraft.signer1Title}
                      onChange={(e) => setCertDraft((p) => ({ ...p, signer1Title: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Penandatangan 2 <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={certDraft.signer2Name}
                      onChange={(e) => setCertDraft((p) => ({ ...p, signer2Name: e.target.value }))}
                      placeholder="Kosongkan jika 1 TTD"
                      className="w-full h-9 px-3 border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jabatan 2</label>
                    <input
                      type="text"
                      value={certDraft.signer2Title}
                      onChange={(e) => setCertDraft((p) => ({ ...p, signer2Title: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Upload Logo & TTD Digital */}
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <div className="font-semibold text-slate-700">Logo Lembaga &amp; Tanda Tangan Digital (PNG/JPG, maks 350 KB)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="p-2.5 border border-dashed border-slate-300 rounded-md text-center hover:bg-slate-50 cursor-pointer">
                      <span className="block font-semibold text-[#1A2B5F]">
                        {certDraft.logoDataUrl ? 'Ganti Logo' : 'Upload Logo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCertImageUpload('logoDataUrl', e.target.files?.[0])}
                      />
                    </label>
                    <label className="p-2.5 border border-dashed border-slate-300 rounded-md text-center hover:bg-slate-50 cursor-pointer">
                      <span className="block font-semibold text-[#1A2B5F]">
                        {certDraft.signature1DataUrl ? 'Ganti TTD 1' : 'Upload TTD 1'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCertImageUpload('signature1DataUrl', e.target.files?.[0])}
                      />
                    </label>
                    <label className="p-2.5 border border-dashed border-slate-300 rounded-md text-center hover:bg-slate-50 cursor-pointer">
                      <span className="block font-semibold text-[#1A2B5F]">
                        {certDraft.signature2DataUrl ? 'Ganti TTD 2' : 'Upload TTD 2'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCertImageUpload('signature2DataUrl', e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  {(certDraft.logoDataUrl || certDraft.signature1DataUrl || certDraft.signature2DataUrl) && (
                    <div className="flex flex-wrap gap-3 text-[11px]">
                      {certDraft.logoDataUrl && (
                        <button
                          type="button"
                          onClick={() => setCertDraft((p) => ({ ...p, logoDataUrl: '' }))}
                          className="text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus Logo
                        </button>
                      )}
                      {certDraft.signature1DataUrl && (
                        <button
                          type="button"
                          onClick={() => setCertDraft((p) => ({ ...p, signature1DataUrl: '' }))}
                          className="text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus TTD 1
                        </button>
                      )}
                      {certDraft.signature2DataUrl && (
                        <button
                          type="button"
                          onClick={() => setCertDraft((p) => ({ ...p, signature2DataUrl: '' }))}
                          className="text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus TTD 2
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Catatan Kaki Verifikasi</label>
                  <textarea
                    rows={2}
                    value={certDraft.footerNote}
                    onChange={(e) => setCertDraft((p) => ({ ...p, footerNote: e.target.value }))}
                    className="w-full p-2.5 border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingCert}
                className="w-full h-10 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{savingCert ? 'Menyimpan...' : 'Simpan Pengaturan Sertifikat'}</span>
              </button>
            </form>

            {/* Right: Live WYSIWYG Preview */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-[#1A2B5F]">
                  Pratinjau Langsung Sertifikat Peserta (Live Preview)
                </div>
                <span className="text-[11px] text-slate-500">
                  Otomatis terisi nama, NIK, nilai, &amp; nomor resmi saat peserta lulus
                </span>
              </div>
              <div className="bg-slate-200/70 p-4 rounded-lg border border-slate-300">
                <CertificateSheet
                  config={certDraft}
                  certificateNumber={`${certDraft.numberPrefix || 'CERT-KB'}/${new Date().getFullYear()}/0001`}
                  participantName="BUDI SANTOSO, S.E."
                  participantNik="3273011205900001"
                  packageCode="BREVET_AB"
                  caseCode="UJIAN-OP-01"
                  caseTitle="Pelaporan SPT Tahunan PPh 21 Karyawan (Tuan A)"
                  moduleLabel="PPh 21 Tahunan Karyawan"
                  score={95}
                  maxScore={100}
                  passingScore={75}
                  issuedAt={new Date().toISOString()}
                  compact
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 5: KONEKSI OTOMATIS DARI KELASBREVET.COM                     */}
        {/* ================================================================ */}
        {activeTab === 'integration' && (
          <div className="space-y-6">
            {/* Simple 3-Step Visual Mental Model */}
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#1A2B5F]">
                  Cara Kerja Koneksi kelasbrevet.com → Simulator Ini
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Alurnya sangat sederhana (satu arah): <strong>kelasbrevet.com</strong> hanya perlu mengirim NIK
                  peserta begitu pembayaran paket lunas. Setelah itu, <strong>semua ujian, penilaian otomatis, rekap
                  nilai, dan penerbitan sertifikat dikelola penuh di Portal Admin Simulator ini</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="font-num font-bold text-[#B45309]">LANGKAH 1</div>
                  <div className="mt-1 font-bold text-[#1A2B5F]">Peserta Beli Paket di kelasbrevet.com</div>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    Saat peserta mendaftar &amp; membayar paket Brevet A/B di website kelasbrevet.com, mereka mengisi
                    16 digit NIK.
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="font-num font-bold text-[#B45309]">LANGKAH 2</div>
                  <div className="mt-1 font-bold text-[#1A2B5F]">Otomatis Kirim NIK ke Simulator</div>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    Website kelasbrevet.com memanggil 1 URL API Simulator (<code className="font-num">/api/integration/enroll</code>)
                    — akun NIK peserta langsung aktif otomatis!
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="font-num font-bold text-[#B45309]">LANGKAH 3</div>
                  <div className="mt-1 font-bold text-[#1A2B5F]">Ujian, Nilai &amp; Sertifikat di Simulator</div>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    Peserta login dengan NIK-nya, mengerjakan soal dari Bank Soal Anda, dinilai otomatis, dan langsung
                    dapat sertifikat bila lulus.
                  </p>
                </div>
              </div>
            </section>

            {/* Interactive 1-Click Test Purchase Simulator */}
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#1A2B5F] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#B45309]" />
                  <span>Uji Coba Langsung: Simulasi Pembeli Baru dari kelasbrevet.com</span>
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Klik tombol di bawah untuk mensimulasikan skenario saat ada peserta baru membeli paket di
                  kelasbrevet.com — lihat akunnya langsung masuk ke tab <strong>Peserta NIK</strong> dan langsung bisa
                  dipakai login!
                </p>
              </div>

              <form onSubmit={handleSimulatePurchase} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                <input
                  type="text"
                  maxLength={16}
                  required
                  value={simForm.nik}
                  onChange={(e) => setSimForm((p) => ({ ...p, nik: e.target.value.replace(/\D/g, '').slice(0, 16) }))}
                  placeholder="NIK 16 Digit"
                  className="h-9 px-3 border border-slate-300 rounded-md font-num"
                />
                <input
                  type="text"
                  required
                  value={simForm.fullName}
                  onChange={(e) => setSimForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Nama Pembeli"
                  className="h-9 px-3 border border-slate-300 rounded-md"
                />
                <input
                  type="email"
                  value={simForm.email}
                  onChange={(e) => setSimForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Email Pembeli"
                  className="h-9 px-3 border border-slate-300 rounded-md"
                />
                <select
                  value={simForm.packageCode}
                  onChange={(e) => setSimForm((p) => ({ ...p, packageCode: e.target.value }))}
                  className="h-9 px-3 border border-slate-300 rounded-md bg-white"
                >
                  <option value="BREVET_AB">BREVET_AB</option>
                  <option value="BREVET_A">BREVET_A</option>
                  <option value="BREVET_B">BREVET_B</option>
                </select>
                <button
                  type="submit"
                  disabled={simRunning || simForm.nik.length !== 16}
                  className="h-9 px-4 bg-[#F5C518] text-[#1A2B5F] font-bold rounded-md hover:bg-[#EAB308] disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {simRunning ? 'Memproses...' : 'Tes Pembelian Masuk'}
                </button>
              </form>

              {simResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md text-xs space-y-2">
                  <div className="font-bold text-emerald-900">
                    Akun Peserta Otomatis Aktif: {simResult.participant.fullName} (NIK: {simResult.participant.nik})
                  </div>
                  <div className="text-emerald-800">
                    Peserta sekarang bisa langsung login di halaman depan pakai NIK{' '}
                    <strong className="font-num">{simResult.participant.nik}</strong>, atau lewat link login 1-klik
                    (SSO) di bawah:
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={simResult.loginUrl}
                      className="flex-1 h-8 px-2.5 bg-white border border-emerald-300 rounded font-num text-[11px] text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => copyText(simResult.loginUrl, 'Link SSO 1-Klik')}
                      className="h-8 px-3 bg-[#1A2B5F] text-white font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link SSO</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Developer Snippet for kelasbrevet.com */}
            <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#1A2B5F] flex items-center gap-2">
                    <Code2 className="w-4 h-4" />
                    <span>Kode Siap Pasang di Website kelasbrevet.com</span>
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Cukup berikan potongan kode ini ke developer / pasang di fungsi &quot;Pembayaran Lunas&quot; website
                    kelasbrevet.com. Header <code className="font-num font-semibold">X-API-KEY</code> harus sama dengan{' '}
                    <code className="font-num font-semibold">INTEGRATION_API_KEY</code> di <code className="font-num">.env</code>.
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start">
                  <button
                    type="button"
                    onClick={() => setCodeLang('php')}
                    className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
                      codeLang === 'php' ? 'bg-[#1A2B5F] text-white' : 'text-slate-600'
                    }`}
                  >
                    PHP / Laravel
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeLang('node')}
                    className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
                      codeLang === 'node' ? 'bg-[#1A2B5F] text-white' : 'text-slate-600'
                    }`}
                  >
                    Node.js / JS
                  </button>
                </div>
              </div>

              {codeLang === 'php' ? (
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-md overflow-x-auto font-num text-xs leading-relaxed">
{`// Panggil kode ini di kelasbrevet.com saat status transaksi peserta = LUNAS / PAID
$ch = curl_init('${originUrl}/api/integration/enroll');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'X-API-KEY: ISI_INTEGRATION_API_KEY_DARI_ENV',
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'nik'          => $user->nik,          // 16 digit NIK peserta
    'full_name'    => $user->name,
    'email'        => $user->email,
    'phone'        => $user->phone,
    'package_code' => 'BREVET_AB',         // BREVET_A / BREVET_B / BREVET_AB
    'order_id'     => $order->invoice_no,
    'expires_at'   => '2026-12-31',        // opsional (kosongkan jika selamanya)
  ]),
]);
$response = curl_exec($ch);
curl_close($ch);`}
                </pre>
              ) : (
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-md overflow-x-auto font-num text-xs leading-relaxed">
{`// Panggil kode ini di kelasbrevet.com saat status transaksi peserta = LUNAS / PAID
await fetch('${originUrl}/api/integration/enroll', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': process.env.SIMULATOR_API_KEY, // sama dengan INTEGRATION_API_KEY
  },
  body: JSON.stringify({
    nik: user.nik,            // 16 digit NIK peserta
    full_name: user.name,
    email: user.email,
    phone: user.phone,
    package_code: 'BREVET_AB', // BREVET_A / BREVET_B / BREVET_AB
    order_id: order.invoiceNo,
    expires_at: '2026-12-31',  // opsional
  }),
});`}
                </pre>
              )}

              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md p-3.5 leading-relaxed">
                <strong>Bonus — Tombol &quot;Buka Simulator&quot; 1-Klik (SSO):</strong> Jika ingin peserta klik tombol di
                dashboard kelasbrevet.com lalu langsung masuk tanpa mengetik NIK lagi, panggil{' '}
                <code className="font-num font-semibold">POST {originUrl}/api/integration/sso-token</code> dengan body{' '}
                <code className="font-num">{`{ "nik": "..." }`}</code>, lalu arahkan peserta ke{' '}
                <code className="font-num font-semibold">loginUrl</code> yang dikembalikan.
              </div>
            </section>

            {/* Optional Advanced Outbound Callback (Collapsed so it doesn't clutter) */}
            <details className="bg-white border border-slate-200 rounded-lg p-5">
              <summary className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                Pengaturan Opsional: Kirim Notifikasi Nilai Balik ke kelasbrevet.com (Tidak Wajib Diisi)
              </summary>
              <form onSubmit={handleSaveWebhookUrl} className="mt-4 space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Biarkan kosong jika semua rekap nilai dan sertifikat cukup dikelola di Portal Admin Simulator ini. Isi
                  hanya jika suatu saat website kelasbrevet.com juga ingin menerima salinan nilai otomatis.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="Kosongkan jika tidak dipakai"
                    className="flex-1 h-9 px-3 border border-slate-300 rounded-md font-num text-xs"
                  />
                  <button
                    type="submit"
                    className="h-9 px-4 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] whitespace-nowrap cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </details>
          </div>
        )}
      </main>

      {/* Admin Printable Certificate Modal */}
      {previewCertAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full my-8 overflow-hidden shadow-xl">
            <div className="no-print px-5 py-3.5 bg-[#1A2B5F] text-white flex items-center justify-between gap-4">
              <span className="text-sm font-bold">
                Sertifikat Kelulusan: {previewCertAttempt.participantName}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCertAttempt(null)}
                  className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div id="printable-tax-document" className="p-5 bg-white">
              {(() => {
                const matchedCase = overview?.examCases.find((c) => c.id === previewCertAttempt.caseId);
                return (
                  <CertificateSheet
                    config={certDraft}
                    certificateNumber={
                      previewCertAttempt.certificateNumber ||
                      `${certDraft.numberPrefix || 'CERT-KB'}/${new Date().getFullYear()}/${previewCertAttempt.nik.slice(-4)}`
                    }
                    participantName={previewCertAttempt.participantName}
                    participantNik={previewCertAttempt.nik}
                    packageCode={previewCertAttempt.packageCode}
                    caseCode={previewCertAttempt.caseCode || matchedCase?.code || previewCertAttempt.caseId}
                    caseTitle={previewCertAttempt.caseTitle || matchedCase?.title || 'Ujian Praktik Coretax'}
                    moduleLabel={
                      matchedCase ? MODULE_LABELS_ADMIN[matchedCase.moduleType] : 'Simulasi Coretax Terintegrasi'
                    }
                    score={previewCertAttempt.score}
                    maxScore={previewCertAttempt.maxScore}
                    passingScore={previewCertAttempt.passingScore}
                    issuedAt={previewCertAttempt.certificateIssuedAt || previewCertAttempt.submittedAt}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {inspectAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-5 py-4 bg-[#1A2B5F] text-white flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-[#F5C518] font-num font-semibold">
                  {inspectAttempt.caseCode} · Percobaan #{inspectAttempt.attemptNumber}
                </div>
                <div className="text-sm font-bold mt-0.5">
                  Audit Jawaban: {inspectAttempt.participantName} ({inspectAttempt.nik})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectAttempt(null)}
                className="text-slate-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 text-xs">
                <div className="space-x-3 text-slate-600">
                  <span>Paket: <strong className="text-slate-900">{inspectAttempt.packageCode}</strong></span>
                  <span>·</span>
                  <span>KKM: <strong className="font-num text-slate-900">{inspectAttempt.passingScore}</strong></span>
                  {inspectAttempt.certificateNumber && (
                    <>
                      <span>·</span>
                      <span>No. Sertifikat: <strong className="font-num text-[#1A2B5F]">{inspectAttempt.certificateNumber}</strong></span>
                    </>
                  )}
                </div>
                <div className="text-sm font-bold font-num">
                  Skor: {inspectAttempt.score}/{inspectAttempt.maxScore} —{' '}
                  <span className={inspectAttempt.status === 'PASSED' ? 'text-emerald-700' : 'text-red-700'}>
                    {inspectAttempt.status === 'PASSED' ? 'LULUS' : 'BELUM LULUS'}
                  </span>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Indikator</th>
                    <th className="text-left font-semibold px-3 py-2">Temuan Aktual Peserta</th>
                    <th className="text-right font-semibold px-3 py-2">Poin</th>
                    <th className="text-right font-semibold px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {inspectAttempt.results.map((r) => (
                    <tr key={r.ruleId}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        <div>{r.label}</div>
                        <div className="text-[11px] text-slate-500">Target: {r.expectedSummary}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{r.actualSummary}</td>
                      <td className="px-3 py-2.5 text-right font-num font-semibold">
                        {r.earned}/{r.weight}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">
                        <span className={r.passed ? 'text-emerald-700' : 'text-red-700'}>
                          {r.passed ? 'BENAR' : 'SALAH'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
