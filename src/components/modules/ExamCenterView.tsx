import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useSimulator } from '../../context/SimulatorContext';
import { examApi } from '../../lib/apiClient';
import { CertificateConfig, ExamAttempt, ExamCase, NavSection } from '../../types/tax';

const MODULE_LABELS: Record<ExamCase['moduleType'], string> = {
  PPN: 'e-Faktur & SPT Masa PPN',
  PPH21_TAHUNAN: 'PPh 21 Tahunan Karyawan',
  EBUPOT_21_23: 'e-Bupot & SPT Masa PPh 21/23',
  PPH_OP_UMUM: 'SPT Tahunan Orang Pribadi',
  PPH_BADAN: 'SPT Tahunan PPh Badan',
};

const MODULE_QUICK_NAV: Record<ExamCase['moduleType'], { label: string; nav: NavSection }[]> = {
  PPN: [
    { label: 'Buka e-Faktur', nav: 'efaktur' },
    { label: 'Buka SPT Masa PPN', nav: 'spt' },
    { label: 'Buka Pembayaran', nav: 'pembayaran' },
  ],
  PPH21_TAHUNAN: [
    { label: 'Cek BPA1 di Portal Saya', nav: 'portal_saya' },
    { label: 'Buka SPT Tahunan OP', nav: 'spt' },
  ],
  EBUPOT_21_23: [
    { label: 'Buka e-Bupot', nav: 'ebupot' },
    { label: 'Buka SPT Masa PPh', nav: 'spt' },
    { label: 'Buka Pembayaran', nav: 'pembayaran' },
  ],
  PPH_OP_UMUM: [
    { label: 'Buka SPT Tahunan OP', nav: 'spt' },
    { label: 'Buka Pembayaran', nav: 'pembayaran' },
  ],
  PPH_BADAN: [
    { label: 'Buka SPT PPh Badan', nav: 'spt' },
    { label: 'Buka Pembayaran', nav: 'pembayaran' },
  ],
};

const MODULE_START_ROLE: Record<ExamCase['moduleType'], 'OP' | 'BADAN'> = {
  PPN: 'BADAN',
  PPH21_TAHUNAN: 'OP',
  EBUPOT_21_23: 'BADAN',
  PPH_OP_UMUM: 'OP',
  PPH_BADAN: 'BADAN',
};

const MODULE_START_NAV: Record<ExamCase['moduleType'], NavSection> = {
  PPN: 'efaktur',
  PPH21_TAHUNAN: 'portal_saya',
  EBUPOT_21_23: 'ebupot',
  PPH_OP_UMUM: 'spt',
  PPH_BADAN: 'spt',
};

export const ExamCenterView: React.FC = () => {
  const {
    snapshot,
    setActiveNav,
    switchRole,
    pushToast,
    replaceSnapshot,
    openPreviewDoc,
    activeExamCaseId,
    setActiveExamCase,
  } = useSimulator();

  const [cases, setCases] = useState<ExamCase[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [certificateConfig, setCertificateConfig] = useState<CertificateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(activeExamCaseId);
  const [resetBeforeStart, setResetBeforeStart] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const nik = snapshot?.workspace.nik || '';

  const loadExams = useCallback(async () => {
    if (!nik) return;
    setLoading(true);
    try {
      const res = await examApi.getParticipantExams(nik);
      if (res.ok && res.data) {
        setCases(res.data.cases);
        setAttempts(res.data.attempts);
        if (res.data.certificateConfig) {
          setCertificateConfig(res.data.certificateConfig);
        }
        const inProg = res.data.attempts.find((a) => a.status === 'IN_PROGRESS');
        if (inProg) {
          const matchedCase = res.data.cases.find((c) => c.id === inProg.caseId) || null;
          setActiveExamCase(matchedCase);
          setSelectedCaseId((prev) => prev || inProg.caseId);
        } else {
          setActiveExamCase(null);
          if (res.data.cases.length > 0) {
            setSelectedCaseId((prev) => prev || res.data!.cases[0].id);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [nik, setActiveExamCase]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || cases[0] || null,
    [cases, selectedCaseId]
  );

  const attemptsByCase = useMemo(() => {
    const map = new Map<string, ExamAttempt[]>();
    for (const a of attempts) {
      const list = map.get(a.caseId) || [];
      list.push(a);
      map.set(a.caseId, list);
    }
    return map;
  }, [attempts]);

  const selectedAttempts = selectedCase ? attemptsByCase.get(selectedCase.id) || [] : [];
  const inProgressAttempt = selectedAttempts.find((a) => a.status === 'IN_PROGRESS') || null;
  const completedAttempts = selectedAttempts.filter((a) => a.status !== 'IN_PROGRESS');
  const latestCompleted = completedAttempts[0] || null;
  const hasPassedSelected = completedAttempts.some((a) => a.status === 'PASSED');

  const summaryStats = useMemo(() => {
    const passedCaseIds = new Set(attempts.filter((a) => a.status === 'PASSED').map((a) => a.caseId));
    return {
      totalCases: cases.length,
      passedCases: passedCaseIds.size,
      totalAttempts: attempts.filter((a) => a.status !== 'IN_PROGRESS').length,
    };
  }, [attempts, cases.length]);

  const handleStartExam = async (examCase: ExamCase) => {
    setBusyAction(true);
    try {
      const res = await examApi.startExam(nik, examCase.id, resetBeforeStart);
      if (!res.ok || !res.data) {
        pushToast('error', res.error || 'Gagal memulai ujian.');
        return;
      }
      if (res.data.snapshot) {
        replaceSnapshot(res.data.snapshot);
      }
      setActiveExamCase(examCase);
      setSelectedCaseId(examCase.id);
      const targetRole = MODULE_START_ROLE[examCase.moduleType];
      if (res.data.snapshot?.workspace.activeRole !== targetRole) {
        switchRole(targetRole);
      }
      pushToast(
        'success',
        `Menu simulasi dibuka untuk soal "${examCase.code}". Kerjakan sesuai instruksi di bagian atas layar.`
      );
      setActiveNav(MODULE_START_NAV[examCase.moduleType]);
    } finally {
      setBusyAction(false);
    }
  };

  const earnedCertificates = useMemo(() => {
    const byCase = new Map<string, ExamAttempt>();
    for (const a of attempts) {
      if (a.status === 'PASSED') {
        const prev = byCase.get(a.caseId);
        if (!prev || a.score > prev.score) {
          byCase.set(a.caseId, a);
        }
      }
    }
    return Array.from(byCase.values());
  }, [attempts]);

  const handleSubmitExam = async (examCase: ExamCase) => {
    setBusyAction(true);
    try {
      const res = await examApi.submitExam(nik, examCase.id);
      if (!res.ok || !res.data) {
        pushToast('error', res.error || 'Gagal memeriksa jawaban ujian.');
        return;
      }
      const graded = res.data.attempt;
      setActiveExamCase(null);
      await loadExams();
      if (graded.status === 'PASSED') {
        pushToast(
          'success',
          graded.certificateNumber
            ? `Selamat! Anda LULUS ${examCase.code} (skor ${graded.score}/${graded.maxScore}). Sertifikat ${graded.certificateNumber} telah terbit otomatis.`
            : `Selamat! Anda LULUS ${examCase.code} dengan skor ${graded.score}/${graded.maxScore}.`
        );
      } else {
        pushToast(
          'warning',
          `Skor Anda ${graded.score}/${graded.maxScore} (KKM ${graded.passingScore}). Periksa rincian indikator yang belum terpenuhi.`
        );
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handlePrintCertificate = (examCase: ExamCase, attempt: ExamAttempt) => {
    if (!snapshot) return;
    const isPassed = attempt.status === 'PASSED';
    if (isPassed && certificateConfig) {
      openPreviewDoc({
        kind: 'SERTIFIKAT',
        title: certificateConfig.certificateTitle,
        subtitle: `${examCase.code} — ${examCase.title}`,
        docNumber:
          attempt.certificateNumber ||
          `${certificateConfig.numberPrefix || 'CERT-KB'}/${new Date().getFullYear()}/${attempt.nik.slice(-4)}`,
        date: (attempt.certificateIssuedAt || attempt.submittedAt).slice(0, 10),
        taxpayerName: attempt.participantName,
        taxpayerNpwp: attempt.nik,
        rows: [],
        footerNote: certificateConfig.footerNote,
        certificateMeta: {
          config: certificateConfig,
          score: attempt.score,
          maxScore: attempt.maxScore,
          passingScore: attempt.passingScore,
          packageCode: attempt.packageCode,
          moduleLabel: MODULE_LABELS[examCase.moduleType],
          caseCode: examCase.code,
          caseTitle: examCase.title,
          issuedAt: attempt.certificateIssuedAt || attempt.submittedAt,
        },
      });
      return;
    }

    openPreviewDoc({
      kind: 'BPE',
      title: 'Bukti Hasil Ujian Praktik Simulasi Coretax',
      subtitle: `${examCase.code} — ${examCase.title}`,
      docNumber: `HASIL-${examCase.code}-${attempt.nik.slice(-6)}`,
      date: attempt.submittedAt.slice(0, 10),
      taxpayerName: attempt.participantName,
      taxpayerNpwp: attempt.nik,
      rows: [
        { label: 'Paket Pelatihan', value: attempt.packageCode },
        { label: 'Modul Ujian', value: MODULE_LABELS[examCase.moduleType] },
        { label: 'Percobaan Ke-', value: `${attempt.attemptNumber} dari ${examCase.maxAttempts}` },
        { label: 'Nilai KKM', value: `${attempt.passingScore} / ${attempt.maxScore}` },
        { label: 'Skor Akhir Peserta', value: `${attempt.score} / ${attempt.maxScore}`, highlight: true },
        {
          label: 'Status Kelulusan',
          value: isPassed ? 'LULUS UJIAN PRAKTIK' : 'BELUM LULUS',
          highlight: true,
        },
        { label: 'Waktu Penilaian Otomatis', value: attempt.submittedAt.replace('T', ' ').slice(0, 19) },
      ],
      footerNote:
        'Dokumen ini diterbitkan secara otomatis oleh Mesin Auto-Grading Simulasi Coretax KelasBrevet berdasarkan audit transaksi pada database.',
    });
  };

  if (!snapshot) return null;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#B45309]">Evaluasi Praktik Otomatis · KelasBrevet</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1A2B5F] text-balance">
            Ujian Praktik &amp; Penilaian Kelulusan Otomatis
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>NIK: <strong className="font-num text-slate-900">{snapshot.workspace.nik}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Paket: <strong className="text-[#1A2B5F]">{snapshot.enrollment?.packageCode || 'BREVET_AB'}</strong></span>
            {snapshot.enrollment?.expiresAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>Aktif s.d. <strong className="font-num">{snapshot.enrollment.expiresAt}</strong></span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadExams()}
          disabled={loading}
          className="self-start h-9 px-3.5 bg-white border border-slate-300 text-xs font-semibold text-slate-700 rounded-md hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Kasus Ujian Tersedia</div>
          <div className="mt-1 text-2xl font-bold font-num text-[#1A2B5F]">{summaryStats.totalCases}</div>
          <div className="mt-1 text-xs text-slate-500">Sesuai paket pelatihan aktif</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Kasus Dinyatakan Lulus</div>
          <div className="mt-1 text-2xl font-bold font-num text-emerald-700">
            {summaryStats.passedCases} / {summaryStats.totalCases}
          </div>
          <div className="mt-1 text-xs text-slate-500">Otomatis tercatat di rekap admin</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Sertifikat Diterbitkan</div>
          <div className="mt-1 text-2xl font-bold font-num text-[#1A2B5F]">{earnedCertificates.length}</div>
          <div className="mt-1 text-xs text-slate-500">Otomatis terbit begitu Anda lulus</div>
        </div>
      </div>

      {/* Earned Official Certificates Shelf */}
      {earnedCertificates.length > 0 && (
        <section className="bg-white border border-emerald-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A2B5F]">
              <Award className="w-4 h-4 text-[#B45309]" />
              <span>Sertifikat Kelulusan Saya ({earnedCertificates.length})</span>
            </div>
            <span className="text-xs text-slate-500">Diterbitkan otomatis oleh sistem</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {earnedCertificates.map((att) => {
              const examCase = cases.find((c) => c.id === att.caseId);
              if (!examCase) return null;
              return (
                <div
                  key={att.id}
                  className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-md flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#1A2B5F] truncate">
                      {examCase.code} — {examCase.title}
                    </div>
                    <div className="mt-0.5 text-[11px] font-num text-slate-600">
                      No: <strong className="text-slate-900">{att.certificateNumber || 'TERBIT'}</strong> · Skor:{' '}
                      <strong className="text-emerald-700">{att.score}/{att.maxScore}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrintCertificate(examCase, att)}
                    className="h-8 px-3 bg-[#1A2B5F] text-white text-xs font-semibold rounded-md hover:bg-[#111D42] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5 text-[#F5C518]" />
                    <span>Cetak Sertifikat</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
          Memuat daftar soal ujian praktik...
        </div>
      ) : cases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
          Belum ada soal ujian praktik aktif untuk paket Anda. Hubungi admin KelasBrevet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Case Selector List */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-bold text-[#1A2B5F]">Daftar Kasus Ujian Praktik</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {cases.map((c) => {
                const list = attemptsByCase.get(c.id) || [];
                const active = selectedCase?.id === c.id;
                const isRunning = list.some((a) => a.status === 'IN_PROGRESS');
                const passed = list.some((a) => a.status === 'PASSED');
                const bestScore = list
                  .filter((a) => a.status !== 'IN_PROGRESS')
                  .reduce((m, a) => Math.max(m, a.score), -1);

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full text-left p-4 transition-colors cursor-pointer ${
                      active ? 'bg-[#1A2B5F] text-white' : 'hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={`font-num font-semibold ${active ? 'text-[#F5C518]' : 'text-[#B45309]'}`}>
                        {c.code}
                      </span>
                      <span
                        className={`font-semibold ${
                          passed
                            ? active
                              ? 'text-emerald-300'
                              : 'text-emerald-700'
                            : isRunning
                            ? active
                              ? 'text-[#F5C518]'
                              : 'text-amber-700'
                            : active
                            ? 'text-slate-300'
                            : 'text-slate-500'
                        }`}
                      >
                        {passed
                          ? `LULUS (${bestScore})`
                          : isRunning
                          ? 'SEDANG DIKERJAKAN'
                          : bestScore >= 0
                          ? `BELUM LULUS (${bestScore})`
                          : 'BELUM MULAI'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-bold leading-snug">{c.title}</div>
                    <div className={`mt-1.5 text-[11px] ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                      {MODULE_LABELS[c.moduleType]} · KKM <span className="font-num">{c.passingScore}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: Selected Case Details, Action Bar & Auto-Grading Audit */}
          {selectedCase && (
            <section className="lg:col-span-8 space-y-5">
              {/* Case Brief Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-num font-semibold text-[#B45309]">{selectedCase.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{MODULE_LABELS[selectedCase.moduleType]}</span>
                      <span aria-hidden="true">·</span>
                      <span>KKM <strong className="font-num text-slate-800">{selectedCase.passingScore}</strong></span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Percobaan <strong className="font-num text-slate-800">{completedAttempts.length}/{selectedCase.maxAttempts}</strong>
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold text-[#1A2B5F] leading-snug">{selectedCase.title}</h2>
                  </div>

                  {hasPassedSelected && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 shrink-0">
                      <Award className="w-4 h-4" />
                      <span>LULUS</span>
                    </div>
                  )}
                </div>

                {/* Scenario Text */}
                <div>
                  <h3 className="text-xs font-bold text-slate-800 mb-2">Instruksi &amp; Studi Kasus Ujian</h3>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedCase.scenarioText}
                  </div>
                </div>

                {/* Grading Criteria Preview (Weights) */}
                <div>
                  <h3 className="text-xs font-bold text-slate-800 mb-2">
                    Komponen Penilaian Otomatis ({selectedCase.rubric.length} Indikator)
                  </h3>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                    {selectedCase.rubric.map((rule, idx) => (
                      <div key={rule.id} className="px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs">
                        <span className="text-slate-700">
                          <span className="font-num font-semibold text-slate-500 mr-2">{idx + 1}.</span>
                          {rule.label}
                        </span>
                        <span className="font-num font-semibold text-[#1A2B5F] whitespace-nowrap shrink-0">
                          {rule.weight} poin
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Area */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  {inProgressAttempt ? (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-xs text-amber-950">
                          <div className="font-bold">
                            Ujian Percobaan #{inProgressAttempt.attemptNumber} Sedang Berlangsung
                          </div>
                          <div className="mt-0.5 text-amber-800">
                            Kerjakan transaksi pada menu simulator di bawah ini, lalu kembali ke sini untuk klik{' '}
                            <strong>Selesai &amp; Periksa Nilai</strong>.
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={() => void handleSubmitExam(selectedCase)}
                          className="h-10 px-4 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] disabled:opacity-50 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <ClipboardCheck className="w-4 h-4 text-[#F5C518]" />
                          <span>{busyAction ? 'Menilai...' : 'Selesai & Periksa Nilai'}</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 mr-1">Buka modul praktik:</span>
                        {MODULE_QUICK_NAV[selectedCase.moduleType].map((q) => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => setActiveNav(q.nav)}
                            className="h-8 px-3 bg-white border border-slate-300 text-xs font-semibold text-[#1A2B5F] rounded-md hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <span>{q.label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={resetBeforeStart}
                          onChange={(e) => setResetBeforeStart(e.target.checked)}
                          className="rounded border-slate-300 text-[#1A2B5F]"
                        />
                        <span>Reset data simulasi ke kondisi awal sebelum memulai ujian</span>
                      </label>

                      <div className="flex items-center gap-2.5">
                        {completedAttempts.length < selectedCase.maxAttempts ? (
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handleStartExam(selectedCase)}
                            className="h-10 px-4 bg-[#1A2B5F] text-white text-xs font-bold rounded-md hover:bg-[#111D42] disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                          >
                            {completedAttempts.length > 0 ? (
                              <RotateCcw className="w-3.5 h-3.5 text-[#F5C518]" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-[#F5C518]" />
                            )}
                            <span>
                              {busyAction
                                ? 'Membuka Simulator...'
                                : completedAttempts.length > 0
                                ? `Ulangi Ujian & Buka Simulator (#${completedAttempts.length + 1})`
                                : 'Mulai Ujian & Buka Simulator'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            Batas percobaan ({selectedCase.maxAttempts}x) telah tercapai
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Latest Graded Result Card */}
              {latestCompleted && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div
                    className={`px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      latestCompleted.status === 'PASSED'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {latestCompleted.status === 'PASSED' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div
                          className={`text-sm font-bold ${
                            latestCompleted.status === 'PASSED' ? 'text-emerald-900' : 'text-red-900'
                          }`}
                        >
                          {latestCompleted.status === 'PASSED'
                            ? 'LULUS UJIAN PRAKTIK'
                            : `BELUM LULUS (Nilai Minimal / KKM: ${latestCompleted.passingScore})`}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Percobaan #{latestCompleted.attemptNumber} · Dinilai otomatis pada{' '}
                          <span className="font-num">{latestCompleted.submittedAt.replace('T', ' ').slice(0, 19)}</span>
                          {latestCompleted.certificateNumber && (
                            <>
                              {' '}· No. Sertifikat:{' '}
                              <strong className="font-num text-[#1A2B5F]">{latestCompleted.certificateNumber}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">Skor Akhir</div>
                        <div
                          className={`text-2xl font-bold font-num ${
                            latestCompleted.status === 'PASSED' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {latestCompleted.score} / {latestCompleted.maxScore}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrintCertificate(selectedCase, latestCompleted)}
                        className={`h-9 px-3.5 text-xs font-bold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          latestCompleted.status === 'PASSED'
                            ? 'bg-[#1A2B5F] text-white hover:bg-[#111D42]'
                            : 'bg-white border border-slate-300 text-[#1A2B5F] hover:bg-slate-50'
                        }`}
                      >
                        {latestCompleted.status === 'PASSED' ? (
                          <>
                            <Award className="w-3.5 h-3.5 text-[#F5C518]" />
                            <span>Unduh / Cetak Sertifikat</span>
                          </>
                        ) : (
                          <>
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Cetak Hasil</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Detailed Auto-Grading Breakdown Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="text-left font-semibold px-4 py-2.5">Indikator Penilaian</th>
                          <th className="text-left font-semibold px-4 py-2.5">Temuan di Simulator Anda</th>
                          <th className="text-right font-semibold px-4 py-2.5">Poin</th>
                          <th className="text-right font-semibold px-4 py-2.5">Hasil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {latestCompleted.results.map((r) => (
                          <tr key={r.ruleId} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              <div>{r.label}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Target: {r.expectedSummary}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{r.actualSummary}</td>
                            <td className="px-4 py-3 text-right font-num font-semibold text-slate-900">
                              {r.earned}/{r.weight}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {r.passed ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Benar</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-red-700">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Belum Sesuai</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* History Table if multiple attempts */}
              {completedAttempts.length > 1 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-[#1A2B5F]">
                    Riwayat Percobaan Kasus Ini
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/70 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="text-left font-semibold px-4 py-2">Percobaan</th>
                        <th className="text-left font-semibold px-4 py-2">Waktu Selesai</th>
                        <th className="text-right font-semibold px-4 py-2">Skor</th>
                        <th className="text-right font-semibold px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {completedAttempts.map((att) => (
                        <tr key={att.id}>
                          <td className="px-4 py-2.5 font-num font-semibold">#{att.attemptNumber}</td>
                          <td className="px-4 py-2.5 font-num text-slate-600">
                            {att.submittedAt.replace('T', ' ').slice(0, 19)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-num font-bold">
                            {att.score}/{att.maxScore}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold ${
                              att.status === 'PASSED' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {att.status === 'PASSED' ? 'LULUS' : 'BELUM LULUS'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
