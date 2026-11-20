import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { mysqlApi } from '../lib/apiClient';
import {
  createDefaultSptBadanPayload,
  createDefaultSptOpPayload,
  createDefaultSptPph21MasaPayload,
  createDefaultSptPpnPayload,
  createDefaultSptUnifikasiPayload,
  createSeedSnapshot,
} from '../lib/seedData';
import {
  calculateSptBadanSummary,
  calculateSptOpSummary,
  generateBillingNumber,
  generateBpeNumber,
  generateId,
  generateNsfp,
  generateNtpn,
  generateSlipNumber,
} from '../lib/taxCalculations';
import {
  AnySptPayload,
  BillingCode,
  EBupotSlip,
  EFakturInvoice,
  LedgerEntry,
  NavSection,
  PrintableDocument,
  SimulatorSnapshot,
  SptBadanTahunanPayload,
  SptOpTahunanPayload,
  SptPph21MasaPayload,
  SptPpnPayload,
  SptUnifikasiPayload,
  TaxpayerProfileBadan,
  TaxpayerProfileOP,
  TaxpayerRole,
  TaxReturn,
  TaxReturnType,
} from '../types/tax';

interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface TteRequest {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
}

interface SimulatorContextValue {
  isLoggedIn: boolean;
  snapshot: SimulatorSnapshot | null;
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  toasts: ToastMessage[];
  pushToast: (tone: ToastMessage['tone'], text: string) => void;
  dismissToast: (id: string) => void;
  tteRequest: TteRequest | null;
  requestTte: (req: TteRequest) => void;
  closeTte: () => void;
  verifyPassphrase: (input: string) => boolean;
  previewDoc: PrintableDocument | null;
  openPreviewDoc: (docData: PrintableDocument) => void;
  closePreviewDoc: () => void;
  // Auth & session
  loginWithNik: (nik: string, customName?: string) => Promise<void>;
  logoutSimulator: () => void;
  // Workspace actions
  switchRole: (role: TaxpayerRole) => void;
  toggleGuidedMode: () => void;
  setActiveCaseId: (caseId: string) => void;
  updateProfiles: (op: Partial<TaxpayerProfileOP>, badan: Partial<TaxpayerProfileBadan>) => void;
  resetSimulationData: () => Promise<void>;
  // e-Faktur actions
  createEFaktur: (invoice: Omit<EFakturInvoice, 'id' | 'ownerId' | 'workspaceId' | 'createdAtIso'>) => EFakturInvoice;
  approveEFaktur: (invoiceId: string) => void;
  requestAmendEFaktur: (invoiceId: string) => void;
  requestCancelEFaktur: (invoiceId: string) => void;
  approveBuyerNotification: (invoiceId: string) => void;
  toggleCreditInputEFaktur: (invoiceId: string, sp2dNumber?: string) => void;
  deleteEFaktur: (invoiceId: string) => void;
  // e-Bupot actions
  createEBupot: (slip: Omit<EBupotSlip, 'id' | 'ownerId' | 'workspaceId' | 'createdAtIso'>) => EBupotSlip;
  importEBupotBatch: (slips: Omit<EBupotSlip, 'id' | 'ownerId' | 'workspaceId' | 'createdAtIso'>[]) => number;
  issueEBupotSlips: (slipIds: string[]) => void;
  cancelEBupotSlip: (slipId: string) => void;
  deleteEBupotSlip: (slipId: string) => void;
  // SPT actions
  createTaxReturn: (params: {
    returnType: TaxReturnType;
    masaPajak: number;
    tahunPajak: number;
    pembetulanKe: number;
  }) => TaxReturn;
  updateTaxReturnPayload: (returnId: string, payload: AnySptPayload) => void;
  postTaxReturnData: (returnId: string) => void;
  submitTaxReturn: (returnId: string, paymentMethod: 'NONE' | 'DEPOSIT' | 'BILLING') => { ok: boolean; message: string };
  deleteTaxReturn: (returnId: string) => void;
  // Payment & Ledger actions
  createStandaloneBilling: (params: {
    kapKjs: string;
    description: string;
    masaPajak: number;
    tahunPajak: number;
    amount: number;
  }) => BillingCode;
  payBillingCode: (billingId: string) => void;
  topUpDeposit: (amount: number) => void;
}

const SimulatorContext = createContext<SimulatorContextValue | null>(null);

const STORAGE_KEY_PREFIX = 'kelasbrevet_coretax_sim_v2_';
const ACTIVE_NIK_KEY = 'kelasbrevet_coretax_active_nik';

function saveLocalCache(nik: string, data: SimulatorSnapshot) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${nik}`, JSON.stringify(data));
    localStorage.setItem(ACTIVE_NIK_KEY, nik);
  } catch {
    // ignore storage quota errors
  }
}

function loadLocalCache(nik: string): SimulatorSnapshot | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${nik}`);
    if (!raw) return null;
    return JSON.parse(raw) as SimulatorSnapshot;
  } catch {
    return null;
  }
}

function computeReturnPosition(returnType: TaxReturnType, payload: AnySptPayload): {
  taxPosition: 'NIHIL' | 'KURANG_BAYAR' | 'LEBIH_BAYAR';
  amountDue: number;
} {
  if (returnType === 'PPN') {
    const p = payload as SptPpnPayload;
    const pajakKeluaran = p.a2DipungutSendiriPpn;
    const pajakMasukan = p.b1ImporPpn + p.b2MasukanKreditPpn + p.kompensasiMasaLalu;
    const selisih = pajakKeluaran - pajakMasukan + p.ppnKms + p.ppnbmTerutang;
    return {
      taxPosition: selisih > 0 ? 'KURANG_BAYAR' : selisih < 0 ? 'LEBIH_BAYAR' : 'NIHIL',
      amountDue: Math.abs(Math.round(selisih)),
    };
  }
  if (returnType === 'PPH21_MASA') {
    const p = payload as SptPph21MasaPayload;
    const total = p.pphPegawaiTetap + p.pphBukanPegawai + p.pphBpa1 - p.kompensasiSebelumnya;
    return {
      taxPosition: total > 0 ? 'KURANG_BAYAR' : total < 0 ? 'LEBIH_BAYAR' : 'NIHIL',
      amountDue: Math.abs(Math.round(total)),
    };
  }
  if (returnType === 'PPH_UNIFIKASI') {
    const p = payload as SptUnifikasiPayload;
    const total = p.pph23Terutang + p.pph4Ayat2Terutang + p.pph22Terutang;
    return {
      taxPosition: total > 0 ? 'KURANG_BAYAR' : 'NIHIL',
      amountDue: Math.abs(Math.round(total)),
    };
  }
  if (returnType === 'PPH_OP_TAHUNAN') {
    const s = calculateSptOpSummary(payload as SptOpTahunanPayload);
    return { taxPosition: s.taxPosition, amountDue: s.amountDue };
  }
  const s = calculateSptBadanSummary(payload as SptBadanTahunanPayload);
  return { taxPosition: s.taxPosition, amountDue: s.amountDue };
}

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState<SimulatorSnapshot | null>(null);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [tteRequest, setTteRequest] = useState<TteRequest | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PrintableDocument | null>(null);
  const snapshotRef = useRef<SimulatorSnapshot | null>(null);
  const sptSaveTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const pushToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = generateId('toast');
    setToasts((prev) => [...prev.slice(-3), { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Hydrate active NIK session from MySQL backend (with instant local cache fallback)
  useEffect(() => {
    let cancelled = false;
    const lastNik = localStorage.getItem(ACTIVE_NIK_KEY);
    if (!lastNik || !/^\d{16}$/.test(lastNik)) return;

    const cached = loadLocalCache(lastNik);
    if (cached) {
      setSnapshot(cached);
    }

    (async () => {
      const fromDb = (await mysqlApi.getWorkspace(lastNik)) || (await mysqlApi.loginNik(lastNik, cached?.workspace.opProfile.nama));
      if (!cancelled && fromDb) {
        saveLocalCache(lastNik, fromDb);
        setSnapshot(fromDb);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Clean up any pending debounced SPT timers on unmount
  useEffect(() => {
    const timers = sptSaveTimersRef.current;
    return () => {
      for (const t of Object.values(timers)) {
        window.clearTimeout(t);
      }
    };
  }, []);

  const updateSnapshot = useCallback(
    (updater: (prev: SimulatorSnapshot) => SimulatorSnapshot) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveLocalCache(next.workspace.nik, next);
        return next;
      });
    },
    []
  );

  const scheduleTaxReturnSave = useCallback((nik: string, updatedReturn: TaxReturn, immediate = false) => {
    const existingTimer = sptSaveTimersRef.current[updatedReturn.id];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete sptSaveTimersRef.current[updatedReturn.id];
    }
    if (immediate) {
      void mysqlApi.saveTaxReturn(nik, updatedReturn);
      return;
    }
    sptSaveTimersRef.current[updatedReturn.id] = window.setTimeout(() => {
      delete sptSaveTimersRef.current[updatedReturn.id];
      void mysqlApi.saveTaxReturn(nik, updatedReturn);
    }, 350);
  }, []);

  const loginWithNik = useCallback(
    async (nikRaw: string, customName?: string) => {
      const nik = nikRaw.replace(/\D/g, '');
      if (nik.length !== 16) {
        pushToast('error', 'NIK harus terdiri dari tepat 16 digit angka.');
        return;
      }

      // Primary source of truth: MySQL backend API
      const fromDb = await mysqlApi.loginNik(nik, customName);
      const loaded = fromDb || loadLocalCache(nik) || createSeedSnapshot(nik, 'mysql_user', customName);

      saveLocalCache(nik, loaded);
      setSnapshot(loaded);
      setActiveNav('dashboard');
      pushToast(
        'success',
        `Selamat datang, ${loaded.workspace.opProfile.nama}. Akun OP & Impersonate Badan siap digunakan.`
      );
    },
    [pushToast]
  );

  const logoutSimulator = useCallback(() => {
    localStorage.removeItem(ACTIVE_NIK_KEY);
    setSnapshot(null);
    setActiveNav('dashboard');
    pushToast('info', 'Anda telah keluar dari sesi simulasi NIK.');
  }, [pushToast]);

  const switchRole = useCallback(
    (role: TaxpayerRole) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      updateSnapshot((prev) => ({
        ...prev,
        workspace: { ...prev.workspace, activeRole: role },
      }));
      void mysqlApi.updateWorkspace(cur.workspace.nik, { activeRole: role });
      pushToast(
        'info',
        role === 'BADAN'
          ? 'Mode Impersonate Aktif: PT SIMULASI KELASBREVET NUSANTARA (WP Badan).'
          : 'Kembali ke Akun Utama: Wajib Pajak Orang Pribadi (OP).'
      );
    },
    [pushToast, updateSnapshot]
  );

  const toggleGuidedMode = useCallback(() => {
    const cur = snapshotRef.current;
    if (!cur) return;
    const nextGuided = !cur.workspace.guidedMode;
    updateSnapshot((prev) => ({
      ...prev,
      workspace: { ...prev.workspace, guidedMode: nextGuided },
    }));
    void mysqlApi.updateWorkspace(cur.workspace.nik, { guidedMode: nextGuided });
  }, [updateSnapshot]);

  const setActiveCaseId = useCallback(
    (caseId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      updateSnapshot((prev) => ({
        ...prev,
        workspace: { ...prev.workspace, activeCaseId: caseId, guidedMode: true },
      }));
      void mysqlApi.updateWorkspace(cur.workspace.nik, { activeCaseId: caseId, guidedMode: true });
    },
    [updateSnapshot]
  );

  const updateProfiles = useCallback(
    (op: Partial<TaxpayerProfileOP>, badan: Partial<TaxpayerProfileBadan>) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const nextOp = { ...cur.workspace.opProfile, ...op };
      const nextBadan = { ...cur.workspace.badanProfile, ...badan };
      updateSnapshot((prev) => ({
        ...prev,
        workspace: {
          ...prev.workspace,
          opProfile: nextOp,
          badanProfile: nextBadan,
        },
      }));
      void mysqlApi.updateWorkspace(cur.workspace.nik, {
        opProfile: nextOp,
        badanProfile: nextBadan,
      });
      pushToast('success', 'Perubahan profil wajib pajak & kode otorisasi berhasil disimpan.');
    },
    [pushToast, updateSnapshot]
  );

  const resetSimulationData = useCallback(async () => {
    const current = snapshotRef.current;
    if (!current) return;
    const nik = current.workspace.nik;
    const freshFromDb = await mysqlApi.resetWorkspace(nik);
    const fresh = freshFromDb || createSeedSnapshot(nik, 'mysql_user', current.workspace.opProfile.nama);
    saveLocalCache(nik, fresh);
    setSnapshot(fresh);
    pushToast('info', 'Seluruh data simulasi telah direset ke kondisi awal studi kasus KelasBrevet.');
  }, [pushToast]);

  // --- e-Faktur Actions ---
  const createEFaktur = useCallback(
    (invoiceInput: Omit<EFakturInvoice, 'id' | 'ownerId' | 'workspaceId' | 'createdAtIso'>): EFakturInvoice => {
      const cur = snapshotRef.current!;
      const newInv: EFakturInvoice = {
        ...invoiceInput,
        id: generateId('inv'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        createdAtIso: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({ ...prev, efaktur: [newInv, ...prev.efaktur] }));
      void mysqlApi.saveEFaktur(cur.workspace.nik, newInv);
      pushToast('success', `Draft e-Faktur (${newInv.invoiceNumber}) berhasil disimpan.`);
      return newInv;
    },
    [pushToast, updateSnapshot]
  );

  const approveEFaktur = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!cur || !target) return;
      const nsfp =
        target.category === 'OUTPUT' || target.category === 'OUTPUT_RETURN'
          ? generateNsfp(target.transactionCode, Boolean(target.amendmentOf))
          : target.invoiceNumber;

      const updated: EFakturInvoice = { ...target, status: 'APPROVED', invoiceNumber: nsfp };
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? updated : i)),
      }));
      void mysqlApi.saveEFaktur(cur.workspace.nik, updated);
      pushToast('success', `Faktur Pajak disetujui (APPROVED). NSFP: ${nsfp}`);
    },
    [pushToast, updateSnapshot]
  );

  const requestAmendEFaktur = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!cur || !target) return;
      const updated: EFakturInvoice = { ...target, status: 'WAITING_FOR_AMENDMENT' };
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? updated : i)),
      }));
      void mysqlApi.saveEFaktur(cur.workspace.nik, updated);
      pushToast(
        'info',
        'Permintaan Faktur Pengganti dikirim. Klik ikon Lonceng Notifikasi di atas untuk mensimulasikan persetujuan pembeli.'
      );
    },
    [pushToast, updateSnapshot]
  );

  const requestCancelEFaktur = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!cur || !target) return;
      const updated: EFakturInvoice = { ...target, status: 'WAITING_FOR_CANCELLATION' };
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? updated : i)),
      }));
      void mysqlApi.saveEFaktur(cur.workspace.nik, updated);
      pushToast(
        'info',
        'Permintaan Pembatalan Faktur dikirim. Klik ikon Lonceng Notifikasi di atas untuk mensimulasikan persetujuan pembeli.'
      );
    },
    [pushToast, updateSnapshot]
  );

  const approveBuyerNotification = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!cur || !target) return;

      if (target.status === 'WAITING_FOR_CANCELLATION') {
        const updated: EFakturInvoice = { ...target, status: 'CANCELED' };
        updateSnapshot((prev) => ({
          ...prev,
          efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? updated : i)),
        }));
        void mysqlApi.saveEFaktur(cur.workspace.nik, updated);
        pushToast('success', `Pembeli menyetujui pembatalan. Faktur ${target.invoiceNumber} kini berstatus CANCELED.`);
      } else if (target.status === 'WAITING_FOR_AMENDMENT') {
        const amendedNsfp = generateNsfp(target.transactionCode, true);
        const updated: EFakturInvoice = { ...target, status: 'AMENDED', invoiceNumber: amendedNsfp };
        updateSnapshot((prev) => ({
          ...prev,
          efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? updated : i)),
        }));
        void mysqlApi.saveEFaktur(cur.workspace.nik, updated);
        pushToast('success', `Pembeli menyetujui penggantian. NSFP Pengganti: ${amendedNsfp} (AMENDED).`);
      }
    },
    [pushToast, updateSnapshot]
  );

  const toggleCreditInputEFaktur = useCallback(
    (invoiceId: string, sp2dNumber?: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!cur || !target) return;
      const nextCredit = target.creditStatus === 'CREDITED' ? 'UNCREDITED' : 'CREDITED';
      const nextSp2d = sp2dNumber !== undefined ? sp2dNumber : target.sp2dNumber;
      const updated: EFakturInvoice = { ...target, creditStatus: nextCredit, sp2dNumber: nextSp2d };

      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? updated : i)),
      }));
      void mysqlApi.saveEFaktur(cur.workspace.nik, updated);
      pushToast(
        'success',
        nextCredit === 'CREDITED'
          ? `Faktur Masukan ${target.invoiceNumber} berhasil dikreditkan (masuk Lampiran B-2).`
          : `Faktur Masukan ${target.invoiceNumber} dipindahkan ke Tidak Dikreditkan (Lampiran B-3).`
      );
    },
    [pushToast, updateSnapshot]
  );

  const deleteEFaktur = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.filter((i) => i.id !== invoiceId),
      }));
      void mysqlApi.deleteEFaktur(cur.workspace.nik, invoiceId);
      pushToast('info', 'Draft e-Faktur dihapus.');
    },
    [pushToast, updateSnapshot]
  );

  // --- e-Bupot Actions ---
  const createEBupot = useCallback(
    (slipInput: Omit<EBupotSlip, 'id' | 'ownerId' | 'workspaceId' | 'createdAtIso'>): EBupotSlip => {
      const cur = snapshotRef.current!;
      const newSlip: EBupotSlip = {
        ...slipInput,
        id: generateId('slip'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        createdAtIso: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({ ...prev, ebupot: [newSlip, ...prev.ebupot] }));
      void mysqlApi.saveEBupotBatch(cur.workspace.nik, [newSlip]);
      pushToast('success', `Bukti Potong ${newSlip.slipType} tersimpan di daftar Belum Terbit.`);
      return newSlip;
    },
    [pushToast, updateSnapshot]
  );

  const importEBupotBatch = useCallback(
    (slipsInput: Omit<EBupotSlip, 'id' | 'ownerId' | 'workspaceId' | 'createdAtIso'>[]): number => {
      const cur = snapshotRef.current!;
      const created: EBupotSlip[] = slipsInput.map((item) => ({
        ...item,
        id: generateId('slip'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        createdAtIso: new Date().toISOString(),
      }));
      updateSnapshot((prev) => ({ ...prev, ebupot: [...created, ...prev.ebupot] }));
      void mysqlApi.saveEBupotBatch(cur.workspace.nik, created);
      pushToast('success', `Berhasil mengimpor ${created.length} data Bukti Potong ke status Belum Terbit.`);
      return created.length;
    },
    [pushToast, updateSnapshot]
  );

  const issueEBupotSlips = useCallback(
    (slipIds: string[]) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const idSet = new Set(slipIds);
      const updatedSlips: EBupotSlip[] = [];

      const nextList = cur.ebupot.map((sl) => {
        if (!idSet.has(sl.id) || sl.status !== 'BELUM_TERBIT') return sl;
        const issued: EBupotSlip = {
          ...sl,
          status: 'TELAH_TERBIT',
          slipNumber: generateSlipNumber(sl.slipType),
        };
        updatedSlips.push(issued);
        return issued;
      });

      if (updatedSlips.length === 0) return;

      updateSnapshot((prev) => ({ ...prev, ebupot: nextList }));
      void mysqlApi.saveEBupotBatch(cur.workspace.nik, updatedSlips);
      pushToast('success', `${updatedSlips.length} Bukti Potong berhasil diterbitkan (TTE) & siap diposting ke SPT.`);
    },
    [pushToast, updateSnapshot]
  );

  const cancelEBupotSlip = useCallback(
    (slipId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.ebupot.find((sl) => sl.id === slipId);
      if (!cur || !target) return;
      const updated: EBupotSlip = { ...target, status: 'DIBATALKAN' };
      updateSnapshot((prev) => ({
        ...prev,
        ebupot: prev.ebupot.map((sl) => (sl.id === slipId ? updated : sl)),
      }));
      void mysqlApi.saveEBupotBatch(cur.workspace.nik, [updated]);
      pushToast('info', 'Bukti Potong telah dibatalkan.');
    },
    [pushToast, updateSnapshot]
  );

  const deleteEBupotSlip = useCallback(
    (slipId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      updateSnapshot((prev) => ({
        ...prev,
        ebupot: prev.ebupot.filter((sl) => sl.id !== slipId),
      }));
      void mysqlApi.deleteEBupot(cur.workspace.nik, slipId);
      pushToast('info', 'Draft Bukti Potong dihapus.');
    },
    [pushToast, updateSnapshot]
  );

  // --- SPT Actions ---
  const createTaxReturn = useCallback(
    (params: {
      returnType: TaxReturnType;
      masaPajak: number;
      tahunPajak: number;
      pembetulanKe: number;
    }): TaxReturn => {
      const cur = snapshotRef.current!;
      const role: TaxpayerRole = params.returnType === 'PPH_OP_TAHUNAN' ? 'OP' : 'BADAN';
      let payload: AnySptPayload;
      if (params.returnType === 'PPN') payload = createDefaultSptPpnPayload();
      else if (params.returnType === 'PPH21_MASA') payload = createDefaultSptPph21MasaPayload();
      else if (params.returnType === 'PPH_UNIFIKASI') payload = createDefaultSptUnifikasiPayload();
      else if (params.returnType === 'PPH_OP_TAHUNAN') payload = createDefaultSptOpPayload(cur.workspace.opProfile.ptkp);
      else payload = createDefaultSptBadanPayload();

      const newReturn: TaxReturn = {
        id: generateId('spt'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        taxpayerRole: role,
        returnType: params.returnType,
        masaPajak: params.masaPajak,
        tahunPajak: params.tahunPajak,
        pembetulanKe: params.pembetulanKe,
        status: 'KONSEP',
        taxPosition: 'NIHIL',
        amountDue: 0,
        bpeNumber: '',
        billingCode: '',
        submittedAt: '',
        payload,
        createdAtIso: new Date().toISOString(),
      };

      updateSnapshot((prev) => ({ ...prev, taxReturns: [newReturn, ...prev.taxReturns] }));
      void mysqlApi.saveTaxReturn(cur.workspace.nik, newReturn);
      pushToast('success', 'Konsep SPT berhasil dibuat. Silakan klik Posting SPT untuk prepopulate data.');
      return newReturn;
    },
    [pushToast, updateSnapshot]
  );

  const updateTaxReturnPayload = useCallback(
    (returnId: string, payload: AnySptPayload) => {
      const cur = snapshotRef.current;
      const target = cur?.taxReturns.find((r) => r.id === returnId);
      if (!cur || !target || target.status === 'DILAPORKAN') return;

      const { taxPosition, amountDue } = computeReturnPosition(target.returnType, payload);
      const updatedReturn: TaxReturn = { ...target, payload, taxPosition, amountDue };
      updateSnapshot((prev) => ({
        ...prev,
        taxReturns: prev.taxReturns.map((r) => (r.id === returnId ? updatedReturn : r)),
      }));
      scheduleTaxReturnSave(cur.workspace.nik, updatedReturn, false);
    },
    [scheduleTaxReturnSave, updateSnapshot]
  );

  const postTaxReturnData = useCallback(
    (returnId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const target = cur.taxReturns.find((r) => r.id === returnId);
      if (!target) return;

      const nowIso = new Date().toISOString();

      const applyPosted = (nextPayload: AnySptPayload, toastMsg: string) => {
        const { taxPosition, amountDue } = computeReturnPosition(target.returnType, nextPayload);
        const updatedReturn: TaxReturn = { ...target, payload: nextPayload, taxPosition, amountDue };
        updateSnapshot((prev) => ({
          ...prev,
          taxReturns: prev.taxReturns.map((r) => (r.id === returnId ? updatedReturn : r)),
        }));
        scheduleTaxReturnSave(cur.workspace.nik, updatedReturn, true);
        pushToast('success', toastMsg);
      };

      if (target.returnType === 'PPN') {
        const periodInvoices = cur.efaktur.filter(
          (i) => i.masaPajak === target.masaPajak && i.tahunPajak === target.tahunPajak && i.status !== 'CANCELED'
        );
        const approvedOutputs = periodInvoices.filter(
          (i) => (i.category === 'OUTPUT' || i.category === 'OUTPUT_RETURN') && (i.status === 'APPROVED' || i.status === 'AMENDED')
        );
        const specialExports = periodInvoices.filter(
          (i) => i.category === 'SPECIAL_OUTPUT' && (i.status === 'APPROVED' || i.status === 'AMENDED')
        );
        const specialImports = periodInvoices.filter(
          (i) => i.category === 'SPECIAL_INPUT' && i.creditStatus === 'CREDITED'
        );
        const creditedInputs = periodInvoices.filter(
          (i) => (i.category === 'INPUT' || i.category === 'INPUT_RETURN') && i.creditStatus === 'CREDITED'
        );
        const uncreditedInputs = periodInvoices.filter(
          (i) => i.category === 'INPUT' && i.creditStatus === 'UNCREDITED'
        );

        const prevPayload = target.payload as SptPpnPayload;
        const sign = (cat: string) => (cat.includes('RETURN') ? -1 : 1);

        const a1EksporDpp = specialExports.reduce((a, i) => a + i.dppTotal, 0);
        const a2KeluaranDpp = approvedOutputs.reduce((a, i) => a + sign(i.category) * i.dppTotal, 0);
        const a2KeluaranPpn = approvedOutputs.reduce((a, i) => a + sign(i.category) * i.ppnTotal, 0);
        const a2DipungutSendiriPpn = approvedOutputs
          .filter((i) => !['02', '03', '07', '08'].includes(i.transactionCode))
          .reduce((a, i) => a + sign(i.category) * i.ppnTotal, 0);
        const a2DipungutPemungutPpn = approvedOutputs
          .filter((i) => ['02', '03'].includes(i.transactionCode))
          .reduce((a, i) => a + sign(i.category) * i.ppnTotal, 0);
        const a2TidakDipungutDpp = approvedOutputs
          .filter((i) => ['07', '08'].includes(i.transactionCode))
          .reduce((a, i) => a + sign(i.category) * i.dppTotal, 0);

        const b1ImporDpp = specialImports.reduce((a, i) => a + i.dppTotal, 0);
        const b1ImporPpn = specialImports.reduce((a, i) => a + i.ppnTotal, 0);
        const b2MasukanKreditDpp = creditedInputs.reduce((a, i) => a + sign(i.category) * i.dppTotal, 0);
        const b2MasukanKreditPpn = creditedInputs.reduce((a, i) => a + sign(i.category) * i.ppnTotal, 0);
        const b3TidakDikreditkanDpp = uncreditedInputs.reduce((a, i) => a + i.dppTotal, 0);
        const b3TidakDikreditkanPpn = uncreditedInputs.reduce((a, i) => a + i.ppnTotal, 0);

        const nextPayload: SptPpnPayload = {
          ...prevPayload,
          postedAt: nowIso,
          a1EksporDpp,
          a2KeluaranDpp,
          a2KeluaranPpn,
          a2DipungutSendiriPpn,
          a2DipungutPemungutPpn,
          a2TidakDipungutDpp,
          b1ImporDpp,
          b1ImporPpn,
          b2MasukanKreditDpp,
          b2MasukanKreditPpn,
          b3TidakDikreditkanDpp,
          b3TidakDikreditkanPpn,
          linkedInvoiceIds: periodInvoices.map((i) => i.id),
        };
        applyPosted(nextPayload, `Posting SPT Masa PPN berhasil menarik ${periodInvoices.length} dokumen e-Faktur.`);
        return;
      }

      if (target.returnType === 'PPH21_MASA') {
        const periodSlips = cur.ebupot.filter(
          (s) =>
            s.masaPajak === target.masaPajak &&
            s.tahunPajak === target.tahunPajak &&
            s.status === 'TELAH_TERBIT' &&
            ['MP', 'BP21', 'BPA1', 'BPA2'].includes(s.slipType) &&
            s.issuerNpwp === cur.workspace.badanProfile.npwp
        );
        const mp = periodSlips.filter((s) => s.slipType === 'MP');
        const bp21 = periodSlips.filter((s) => s.slipType === 'BP21');
        const bpa = periodSlips.filter((s) => s.slipType === 'BPA1' || s.slipType === 'BPA2');
        const prevPayload = target.payload as SptPph21MasaPayload;

        const nextPayload: SptPph21MasaPayload = {
          ...prevPayload,
          postedAt: nowIso,
          jumlahPegawaiTetap: mp.length,
          brutoPegawaiTetap: mp.reduce((a, s) => a + s.grossAmount, 0),
          pphPegawaiTetap: mp.reduce((a, s) => a + s.pphAmount, 0),
          jumlahBukanPegawai: bp21.length,
          brutoBukanPegawai: bp21.reduce((a, s) => a + s.grossAmount, 0),
          pphBukanPegawai: bp21.reduce((a, s) => a + s.pphAmount, 0),
          jumlahBpa1: bpa.length,
          pphBpa1: bpa.reduce((a, s) => a + s.pphAmount, 0),
          linkedSlipIds: periodSlips.map((s) => s.id),
        };
        applyPosted(nextPayload, `Posting SPT Masa PPh 21/26 menarik ${periodSlips.length} Bukti Potong terbit.`);
        return;
      }

      if (target.returnType === 'PPH_UNIFIKASI') {
        const periodSlips = cur.ebupot.filter(
          (s) =>
            s.masaPajak === target.masaPajak &&
            s.tahunPajak === target.tahunPajak &&
            s.status === 'TELAH_TERBIT' &&
            s.slipType === 'BPPU' &&
            s.issuerNpwp === cur.workspace.badanProfile.npwp
        );
        const prevPayload = target.payload as SptUnifikasiPayload;
        const nextPayload: SptUnifikasiPayload = {
          ...prevPayload,
          postedAt: nowIso,
          jumlahBppu: periodSlips.length,
          dppPph23: periodSlips.reduce((a, s) => a + s.grossAmount, 0),
          pph23Terutang: periodSlips.reduce((a, s) => a + s.pphAmount, 0),
          linkedSlipIds: periodSlips.map((s) => s.id),
        };
        applyPosted(nextPayload, `Posting SPT Masa PPh Unifikasi menarik ${periodSlips.length} Bukti Potong BPPU.`);
        return;
      }

      if (target.returnType === 'PPH_OP_TAHUNAN') {
        const mySlips = cur.ebupot.filter(
          (s) =>
            s.tahunPajak === target.tahunPajak &&
            s.status === 'TELAH_TERBIT' &&
            s.recipientNik === cur.workspace.nik &&
            (s.slipType === 'BPA1' || s.slipType === 'BPA2')
        );
        const prevPayload = target.payload as SptOpTahunanPayload;
        const totalBruto = mySlips.reduce((a, s) => a + s.grossAmount, 0);
        const totalPph = mySlips.reduce((a, s) => a + s.pphAmount, 0);
        const biayaJabatan = Math.min(6_000_000, Math.round(totalBruto * 0.05));

        const nextPayload: SptOpTahunanPayload = {
          ...prevPayload,
          postedAt: nowIso,
          hasPenghasilanPekerjaan: mySlips.length > 0 ? true : prevPayload.hasPenghasilanPekerjaan,
          brutoPekerjaan: totalBruto > 0 ? totalBruto : prevPayload.brutoPekerjaan,
          biayaJabatan: totalBruto > 0 ? biayaJabatan : prevPayload.biayaJabatan,
          kreditPajakDipungut: totalPph > 0 ? totalPph : prevPayload.kreditPajakDipungut,
          ptkpStatus: mySlips[0]?.ptkpStatus && mySlips[0].ptkpStatus !== 'NA' ? mySlips[0].ptkpStatus : prevPayload.ptkpStatus,
          linkedSlipIds: mySlips.map((s) => s.id),
        };
        applyPosted(nextPayload, `Posting SPT Tahunan OP berhasil menarik ${mySlips.length} Bukti Potong BPA1/BPA2.`);
        return;
      }

      if (target.returnType === 'PPH_BADAN_TAHUNAN') {
        const prevPayload = target.payload as SptBadanTahunanPayload;
        applyPosted(
          { ...prevPayload, postedAt: nowIso },
          'Posting SPT Tahunan PPh Badan berhasil memperbarui ringkasan fiskal.'
        );
      }
    },
    [pushToast, scheduleTaxReturnSave, updateSnapshot]
  );

  const submitTaxReturn = useCallback(
    (
      returnId: string,
      paymentMethod: 'NONE' | 'DEPOSIT' | 'BILLING'
    ): { ok: boolean; message: string } => {
      const cur = snapshotRef.current;
      if (!cur) return { ok: false, message: 'Workspace tidak ditemukan.' };
      const target = cur.taxReturns.find((r) => r.id === returnId);
      if (!target) return { ok: false, message: 'SPT tidak ditemukan.' };

      const { taxPosition, amountDue } = computeReturnPosition(target.returnType, target.payload);
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const role = target.taxpayerRole;
      const depositBalance =
        role === 'OP' ? cur.workspace.opProfile.depositBalance : cur.workspace.badanProfile.depositBalance;

      // Case 1: Nihil or Lebih Bayar -> immediate DILAPORKAN + BPE
      if (taxPosition !== 'KURANG_BAYAR' || amountDue <= 0) {
        const bpe = generateBpeNumber();
        const updatedReturn: TaxReturn = {
          ...target,
          status: 'DILAPORKAN',
          taxPosition,
          amountDue,
          bpeNumber: bpe,
          submittedAt: nowIso,
        };
        updateSnapshot((prev) => ({
          ...prev,
          taxReturns: prev.taxReturns.map((r) => (r.id === returnId ? updatedReturn : r)),
        }));
        scheduleTaxReturnSave(cur.workspace.nik, updatedReturn, true);
        pushToast('success', `SPT berhasil dilaporkan! Nomor BPE: ${bpe}`);
        return { ok: true, message: bpe };
      }

      // Case 2: Kurang Bayar via Deposit Balance Transfer
      if (paymentMethod === 'DEPOSIT') {
        if (depositBalance < amountDue) {
          pushToast('error', 'Saldo Deposit Pajak tidak mencukupi. Gunakan Kode Billing atau Top-Up Deposit.');
          return { ok: false, message: 'Saldo Deposit tidak mencukupi.' };
        }
        const bpe = generateBpeNumber();
        const newBalance = depositBalance - amountDue;
        const ledgerEntry: LedgerEntry = {
          id: generateId('led'),
          ownerId: cur.workspace.ownerId,
          workspaceId: cur.workspace.id,
          taxpayerRole: role,
          entryDate: today,
          entryType: 'DEPOSIT_TRANSFER',
          referenceNumber: bpe,
          description: `Pemindahbukuan Deposit Pajak untuk pelaporan ${target.returnType} (${target.masaPajak}/${target.tahunPajak})`,
          debit: amountDue,
          credit: 0,
          balanceAfter: newBalance,
          createdAtIso: nowIso,
        };

        const updatedReturn: TaxReturn = {
          ...target,
          status: 'DILAPORKAN',
          taxPosition,
          amountDue,
          bpeNumber: bpe,
          submittedAt: nowIso,
        };

        const nextOp =
          role === 'OP' ? { ...cur.workspace.opProfile, depositBalance: newBalance } : cur.workspace.opProfile;
        const nextBadan =
          role === 'BADAN' ? { ...cur.workspace.badanProfile, depositBalance: newBalance } : cur.workspace.badanProfile;

        updateSnapshot((prev) => ({
          ...prev,
          workspace: {
            ...prev.workspace,
            opProfile: nextOp,
            badanProfile: nextBadan,
          },
          taxReturns: prev.taxReturns.map((r) => (r.id === returnId ? updatedReturn : r)),
          ledger: [ledgerEntry, ...prev.ledger],
        }));

        scheduleTaxReturnSave(cur.workspace.nik, updatedReturn, true);
        void mysqlApi.updateWorkspace(cur.workspace.nik, { opProfile: nextOp, badanProfile: nextBadan });
        void mysqlApi.addLedgerEntry(cur.workspace.nik, ledgerEntry);
        pushToast('success', `Pembayaran Deposit & Pelaporan berhasil! BPE: ${bpe}`);
        return { ok: true, message: bpe };
      }

      // Case 3: Kurang Bayar via Billing Code -> MENUNGGU_PEMBAYARAN
      const billingNum = generateBillingNumber();
      const kapMap: Record<TaxReturnType, string> = {
        PPN: '411211-100',
        PPH21_MASA: '411121-100',
        PPH_UNIFIKASI: '411124-104',
        PPH_OP_TAHUNAN: '411125-200',
        PPH_BADAN_TAHUNAN: '411126-200',
      };
      const newBill: BillingCode = {
        id: generateId('bill'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        taxpayerRole: role,
        billingNumber: billingNum,
        kapKjs: kapMap[target.returnType],
        description: `Kurang Bayar ${target.returnType} Masa ${target.masaPajak}/${target.tahunPajak}`,
        masaPajak: target.masaPajak,
        tahunPajak: target.tahunPajak,
        amount: amountDue,
        status: 'BELUM_BAYAR',
        ntpn: '',
        relatedReturnId: returnId,
        paidAt: '',
        createdAtIso: nowIso,
      };

      const updatedReturn: TaxReturn = {
        ...target,
        status: 'MENUNGGU_PEMBAYARAN',
        taxPosition,
        amountDue,
        billingCode: billingNum,
      };

      updateSnapshot((prev) => ({
        ...prev,
        taxReturns: prev.taxReturns.map((r) => (r.id === returnId ? updatedReturn : r)),
        billing: [newBill, ...prev.billing],
      }));

      scheduleTaxReturnSave(cur.workspace.nik, updatedReturn, true);
      void mysqlApi.saveBilling(cur.workspace.nik, newBill);
      pushToast('info', `Kode Billing ${billingNum} diterbitkan. Lunasi di menu Pembayaran agar SPT otomatis dilaporkan.`);
      return { ok: true, message: billingNum };
    },
    [pushToast, scheduleTaxReturnSave, updateSnapshot]
  );

  const deleteTaxReturn = useCallback(
    (returnId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      updateSnapshot((prev) => ({
        ...prev,
        taxReturns: prev.taxReturns.filter((r) => r.id !== returnId),
      }));
      void mysqlApi.deleteTaxReturn(cur.workspace.nik, returnId);
      pushToast('info', 'Konsep SPT dihapus.');
    },
    [pushToast, updateSnapshot]
  );

  // --- Billing & Deposit Actions ---
  const createStandaloneBilling = useCallback(
    (params: {
      kapKjs: string;
      description: string;
      masaPajak: number;
      tahunPajak: number;
      amount: number;
    }): BillingCode => {
      const cur = snapshotRef.current!;
      const bill: BillingCode = {
        id: generateId('bill'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        taxpayerRole: cur.workspace.activeRole,
        billingNumber: generateBillingNumber(),
        kapKjs: params.kapKjs,
        description: params.description,
        masaPajak: params.masaPajak,
        tahunPajak: params.tahunPajak,
        amount: params.amount,
        status: 'BELUM_BAYAR',
        ntpn: '',
        relatedReturnId: '',
        paidAt: '',
        createdAtIso: new Date().toISOString(),
      };
      updateSnapshot((prev) => ({ ...prev, billing: [bill, ...prev.billing] }));
      void mysqlApi.saveBilling(cur.workspace.nik, bill);
      pushToast('success', `Kode Billing ${bill.billingNumber} berhasil dibuat.`);
      return bill;
    },
    [pushToast, updateSnapshot]
  );

  const payBillingCode = useCallback(
    (billingId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const target = cur.billing.find((b) => b.id === billingId);
      if (!target || target.status === 'LUNAS') return;

      const ntpn = generateNtpn();
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const bpe = target.relatedReturnId ? generateBpeNumber() : '';
      const role = target.taxpayerRole;
      const currentDeposit =
        role === 'OP' ? cur.workspace.opProfile.depositBalance : cur.workspace.badanProfile.depositBalance;

      const paidBill: BillingCode = { ...target, status: 'LUNAS', ntpn, paidAt: nowIso };
      const ledgerEntry: LedgerEntry = {
        id: generateId('led'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        taxpayerRole: role,
        entryDate: today,
        entryType: 'BILLING_PAYMENT',
        referenceNumber: ntpn,
        description: `Pembayaran Kode Billing ${target.billingNumber} (${target.description})`,
        debit: target.amount,
        credit: target.amount,
        balanceAfter: currentDeposit,
        createdAtIso: nowIso,
      };

      const linkedReturn = target.relatedReturnId
        ? cur.taxReturns.find((r) => r.id === target.relatedReturnId)
        : undefined;
      const updatedLinkedReturn: TaxReturn | undefined = linkedReturn
        ? { ...linkedReturn, status: 'DILAPORKAN', bpeNumber: bpe, submittedAt: nowIso }
        : undefined;

      updateSnapshot((prev) => ({
        ...prev,
        billing: prev.billing.map((b) => (b.id === billingId ? paidBill : b)),
        taxReturns: updatedLinkedReturn
          ? prev.taxReturns.map((r) => (r.id === updatedLinkedReturn.id ? updatedLinkedReturn : r))
          : prev.taxReturns,
        ledger: [ledgerEntry, ...prev.ledger],
      }));

      void mysqlApi.saveBilling(cur.workspace.nik, paidBill);
      if (updatedLinkedReturn) {
        scheduleTaxReturnSave(cur.workspace.nik, updatedLinkedReturn, true);
      }
      void mysqlApi.addLedgerEntry(cur.workspace.nik, ledgerEntry);

      pushToast(
        'success',
        target.relatedReturnId
          ? `Billing Lunas (NTPN: ${ntpn}). SPT otomatis berpindah ke SPT Dilaporkan dengan BPE ${bpe}!`
          : `Pembayaran Billing Lunas! NTPN Simulasi: ${ntpn}`
      );
    },
    [pushToast, scheduleTaxReturnSave, updateSnapshot]
  );

  const topUpDeposit = useCallback(
    (amount: number) => {
      const cur = snapshotRef.current;
      if (!cur || amount <= 0) return;
      const role = cur.workspace.activeRole;
      const prevBal =
        role === 'OP' ? cur.workspace.opProfile.depositBalance : cur.workspace.badanProfile.depositBalance;
      const nextBal = prevBal + amount;
      const ntpn = generateNtpn();
      const nowIso = new Date().toISOString();

      const ledgerEntry: LedgerEntry = {
        id: generateId('led'),
        ownerId: cur.workspace.ownerId,
        workspaceId: cur.workspace.id,
        taxpayerRole: role,
        entryDate: nowIso.slice(0, 10),
        entryType: 'DEPOSIT_TOPUP',
        referenceNumber: ntpn,
        description: `Penyetoran Deposit Pajak Simulasi (KAP 411618-100)`,
        debit: 0,
        credit: amount,
        balanceAfter: nextBal,
        createdAtIso: nowIso,
      };

      const nextOp =
        role === 'OP' ? { ...cur.workspace.opProfile, depositBalance: nextBal } : cur.workspace.opProfile;
      const nextBadan =
        role === 'BADAN' ? { ...cur.workspace.badanProfile, depositBalance: nextBal } : cur.workspace.badanProfile;

      updateSnapshot((prev) => ({
        ...prev,
        workspace: {
          ...prev.workspace,
          opProfile: nextOp,
          badanProfile: nextBadan,
        },
        ledger: [ledgerEntry, ...prev.ledger],
      }));

      void mysqlApi.updateWorkspace(cur.workspace.nik, { opProfile: nextOp, badanProfile: nextBadan });
      void mysqlApi.addLedgerEntry(cur.workspace.nik, ledgerEntry);
      pushToast('success', `Deposit Pajak bertambah. NTPN: ${ntpn}`);
    },
    [pushToast, updateSnapshot]
  );

  const requestTte = useCallback((req: TteRequest) => setTteRequest(req), []);
  const closeTte = useCallback(() => setTteRequest(null), []);

  const verifyPassphrase = useCallback((input: string) => {
    const cur = snapshotRef.current;
    if (!cur) return false;
    const expected =
      cur.workspace.activeRole === 'BADAN'
        ? cur.workspace.badanProfile.passphrase
        : cur.workspace.opProfile.passphrase;
    return input.trim() === expected.trim();
  }, []);

  const openPreviewDoc = useCallback((docData: PrintableDocument) => setPreviewDoc(docData), []);
  const closePreviewDoc = useCallback(() => setPreviewDoc(null), []);

  const value = useMemo<SimulatorContextValue>(
    () => ({
      isLoggedIn: Boolean(snapshot),
      snapshot,
      activeNav,
      setActiveNav,
      toasts,
      pushToast,
      dismissToast,
      tteRequest,
      requestTte,
      closeTte,
      verifyPassphrase,
      previewDoc,
      openPreviewDoc,
      closePreviewDoc,
      loginWithNik,
      logoutSimulator,
      switchRole,
      toggleGuidedMode,
      setActiveCaseId,
      updateProfiles,
      resetSimulationData,
      createEFaktur,
      approveEFaktur,
      requestAmendEFaktur,
      requestCancelEFaktur,
      approveBuyerNotification,
      toggleCreditInputEFaktur,
      deleteEFaktur,
      createEBupot,
      importEBupotBatch,
      issueEBupotSlips,
      cancelEBupotSlip,
      deleteEBupotSlip,
      createTaxReturn,
      updateTaxReturnPayload,
      postTaxReturnData,
      submitTaxReturn,
      deleteTaxReturn,
      createStandaloneBilling,
      payBillingCode,
      topUpDeposit,
    }),
    [
      snapshot,
      activeNav,
      toasts,
      pushToast,
      dismissToast,
      tteRequest,
      requestTte,
      closeTte,
      verifyPassphrase,
      previewDoc,
      openPreviewDoc,
      closePreviewDoc,
      loginWithNik,
      logoutSimulator,
      switchRole,
      toggleGuidedMode,
      setActiveCaseId,
      updateProfiles,
      resetSimulationData,
      createEFaktur,
      approveEFaktur,
      requestAmendEFaktur,
      requestCancelEFaktur,
      approveBuyerNotification,
      toggleCreditInputEFaktur,
      deleteEFaktur,
      createEBupot,
      importEBupotBatch,
      issueEBupotSlips,
      cancelEBupotSlip,
      deleteEBupotSlip,
      createTaxReturn,
      updateTaxReturnPayload,
      postTaxReturnData,
      submitTaxReturn,
      deleteTaxReturn,
      createStandaloneBilling,
      payBillingCode,
      topUpDeposit,
    ]
  );

  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>;
};

export function useSimulator() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) {
    throw new Error('useSimulator must be used inside SimulatorProvider');
  }
  return ctx;
}
