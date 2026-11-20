import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogleCloud,
  signOutGoogleCloud,
} from '../lib/firebase';
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
  firebaseUser: User | null;
  authLoading: boolean;
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
  connectGoogleCloud: () => Promise<void>;
  disconnectGoogleCloud: () => Promise<void>;
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

const STORAGE_KEY_PREFIX = 'kelasbrevet_coretax_sim_v1_';
const ACTIVE_NIK_KEY = 'kelasbrevet_coretax_active_nik';

function saveLocalSnapshot(nik: string, data: SimulatorSnapshot) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${nik}`, JSON.stringify(data));
    localStorage.setItem(ACTIVE_NIK_KEY, nik);
  } catch {
    // ignore quota errors
  }
}

function loadLocalSnapshot(nik: string): SimulatorSnapshot | null {
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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<SimulatorSnapshot | null>(null);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [tteRequest, setTteRequest] = useState<TteRequest | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PrintableDocument | null>(null);
  const snapshotRef = useRef<SimulatorSnapshot | null>(null);

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

  // Hydrate last active NIK from localStorage on initial load
  useEffect(() => {
    const lastNik = localStorage.getItem(ACTIVE_NIK_KEY);
    if (lastNik && /^\d{16}$/.test(lastNik)) {
      const saved = loadLocalSnapshot(lastNik);
      if (saved) {
        setSnapshot(saved);
      }
    }
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Sync a full snapshot to Firestore when user is verified & signed in with Google
  const syncSnapshotToCloud = useCallback(
    async (data: SimulatorSnapshot, user: User | null) => {
      if (!user || !user.emailVerified) return;
      const uid = user.uid;
      const ws = data.workspace;
      const wsPath = `users/${uid}/workspaces/${ws.id}`;
      try {
        await setDoc(
          doc(db, 'users', uid),
          {
            uid,
            email: user.email || 'peserta@kelasbrevet.simulasi',
            displayName: user.displayName || ws.opProfile.nama,
            activeNik: ws.nik,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        ).catch(async () => {
          await updateDoc(doc(db, 'users', uid), {
            activeNik: ws.nik,
            displayName: user.displayName || ws.opProfile.nama,
            email: user.email || 'peserta@kelasbrevet.simulasi',
            updatedAt: serverTimestamp(),
          });
        });

        await setDoc(
          doc(db, 'users', uid, 'workspaces', ws.id),
          {
            ownerId: uid,
            nik: ws.nik,
            opProfile: ws.opProfile,
            badanProfile: ws.badanProfile,
            activeRole: ws.activeRole,
            guidedMode: ws.guidedMode,
            activeCaseId: ws.activeCaseId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        ).catch(async () => {
          await updateDoc(doc(db, 'users', uid, 'workspaces', ws.id), {
            opProfile: ws.opProfile,
            badanProfile: ws.badanProfile,
            activeRole: ws.activeRole,
            guidedMode: ws.guidedMode,
            activeCaseId: ws.activeCaseId,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, wsPath);
        } catch {
          // non-fatal sync log
        }
      }
    },
    []
  );

  // Persist individual entity writes to Firestore when signed in
  const syncDocToCloud = useCallback(
    async (
      colName: 'efaktur' | 'ebupot' | 'taxReturns' | 'billing' | 'ledger',
      docId: string,
      payload: Record<string, unknown>,
      isUpdate = false
    ) => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) return;
      const uid = user.uid;
      const path = `users/${uid}/${colName}/${docId}`;
      try {
        if (isUpdate && colName !== 'ledger') {
          await updateDoc(doc(db, 'users', uid, colName, docId), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          const base: Record<string, unknown> = {
            ...payload,
            ownerId: uid,
            createdAt: serverTimestamp(),
          };
          if (colName !== 'ledger') {
            base.updatedAt = serverTimestamp();
          }
          await setDoc(doc(db, 'users', uid, colName, docId), base);
        }
      } catch (err) {
        try {
          handleFirestoreError(err, isUpdate ? OperationType.UPDATE : OperationType.CREATE, path);
        } catch {
          // keep UI responsive
        }
      }
    },
    []
  );

  const deleteDocFromCloud = useCallback(
    async (colName: 'efaktur' | 'ebupot' | 'taxReturns' | 'billing' | 'ledger', docId: string) => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) return;
      const path = `users/${user.uid}/${colName}/${docId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, colName, docId));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, path);
        } catch {
          // non-fatal
        }
      }
    },
    []
  );

  const updateSnapshot = useCallback(
    (updater: (prev: SimulatorSnapshot) => SimulatorSnapshot) => {
      setSnapshot((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        saveLocalSnapshot(next.workspace.nik, next);
        return next;
      });
    },
    []
  );

  const loginWithNik = useCallback(
    async (nikRaw: string, customName?: string) => {
      const nik = nikRaw.replace(/\D/g, '');
      if (nik.length !== 16) {
        pushToast('error', 'NIK harus terdiri dari tepat 16 digit angka.');
        return;
      }

      const existingLocal = loadLocalSnapshot(nik);
      let loaded: SimulatorSnapshot;
      if (existingLocal) {
        loaded = existingLocal;
      } else {
        loaded = createSeedSnapshot(nik, firebaseUser?.uid || 'local_user', customName);
      }

      // If signed into Firebase Cloud, check if cloud has workspace records for this NIK
      if (firebaseUser && firebaseUser.emailVerified) {
        const uid = firebaseUser.uid;
        const wsId = `ws_${nik}`;
        try {
          const wsSnap = await getDocs(
            query(collection(db, 'users', uid, 'workspaces'), where('ownerId', '==', uid))
          );
          const foundWs = wsSnap.docs.find((d) => d.id === wsId);
          if (foundWs) {
            const wsData = foundWs.data();
            const [efSnap, ebSnap, trSnap, biSnap, leSnap] = await Promise.all([
              getDocs(query(collection(db, 'users', uid, 'efaktur'), where('ownerId', '==', uid))),
              getDocs(query(collection(db, 'users', uid, 'ebupot'), where('ownerId', '==', uid))),
              getDocs(query(collection(db, 'users', uid, 'taxReturns'), where('ownerId', '==', uid))),
              getDocs(query(collection(db, 'users', uid, 'billing'), where('ownerId', '==', uid))),
              getDocs(query(collection(db, 'users', uid, 'ledger'), where('ownerId', '==', uid))),
            ]);
            loaded = {
              workspace: {
                id: wsId,
                ownerId: uid,
                nik: wsData.nik,
                opProfile: wsData.opProfile,
                badanProfile: wsData.badanProfile,
                activeRole: wsData.activeRole,
                guidedMode: wsData.guidedMode,
                activeCaseId: wsData.activeCaseId,
              },
              efaktur: efSnap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<EFakturInvoice, 'id'>) }))
                .filter((x) => x.workspaceId === wsId),
              ebupot: ebSnap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<EBupotSlip, 'id'>) }))
                .filter((x) => x.workspaceId === wsId),
              taxReturns: trSnap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<TaxReturn, 'id'>) }))
                .filter((x) => x.workspaceId === wsId),
              billing: biSnap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<BillingCode, 'id'>) }))
                .filter((x) => x.workspaceId === wsId),
              ledger: leSnap.docs
                .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerEntry, 'id'>) }))
                .filter((x) => x.workspaceId === wsId),
            };
          } else {
            await syncSnapshotToCloud(loaded, firebaseUser);
          }
        } catch {
          // fallback cleanly to local snapshot
        }
      }

      saveLocalSnapshot(nik, loaded);
      setSnapshot(loaded);
      setActiveNav('dashboard');
      pushToast('success', `Selamat datang, ${loaded.workspace.opProfile.nama}. Akun OP & Impersonate Badan siap digunakan.`);
    },
    [firebaseUser, pushToast, syncSnapshotToCloud]
  );

  const logoutSimulator = useCallback(() => {
    localStorage.removeItem(ACTIVE_NIK_KEY);
    setSnapshot(null);
    setActiveNav('dashboard');
    pushToast('info', 'Anda telah keluar dari sesi simulasi NIK.');
  }, [pushToast]);

  const connectGoogleCloud = useCallback(async () => {
    try {
      const cred = await signInWithGoogleCloud();
      pushToast('success', `Sinkronisasi Cloud aktif untuk ${cred.user.email}.`);
      if (snapshotRef.current) {
        await syncSnapshotToCloud(snapshotRef.current, cred.user);
      }
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Gagal menghubungkan akun Google.');
    }
  }, [pushToast, syncSnapshotToCloud]);

  const disconnectGoogleCloud = useCallback(async () => {
    await signOutGoogleCloud();
    pushToast('info', 'Sinkronisasi Cloud diputuskan. Sesi NIK lokal tetap aktif.');
  }, [pushToast]);

  const switchRole = useCallback(
    (role: TaxpayerRole) => {
      updateSnapshot((prev) => {
        const next: SimulatorSnapshot = {
          ...prev,
          workspace: { ...prev.workspace, activeRole: role },
        };
        void syncSnapshotToCloud(next, auth.currentUser);
        return next;
      });
      pushToast(
        'info',
        role === 'BADAN'
          ? 'Mode Impersonate Aktif: PT SIMULASI KELASBREVET NUSANTARA (WP Badan).'
          : 'Kembali ke Akun Utama: Wajib Pajak Orang Pribadi (OP).'
      );
    },
    [pushToast, syncSnapshotToCloud, updateSnapshot]
  );

  const toggleGuidedMode = useCallback(() => {
    updateSnapshot((prev) => ({
      ...prev,
      workspace: { ...prev.workspace, guidedMode: !prev.workspace.guidedMode },
    }));
  }, [updateSnapshot]);

  const setActiveCaseId = useCallback(
    (caseId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        workspace: { ...prev.workspace, activeCaseId: caseId, guidedMode: true },
      }));
    },
    [updateSnapshot]
  );

  const updateProfiles = useCallback(
    (op: Partial<TaxpayerProfileOP>, badan: Partial<TaxpayerProfileBadan>) => {
      updateSnapshot((prev) => {
        const next: SimulatorSnapshot = {
          ...prev,
          workspace: {
            ...prev.workspace,
            opProfile: { ...prev.workspace.opProfile, ...op },
            badanProfile: { ...prev.workspace.badanProfile, ...badan },
          },
        };
        void syncSnapshotToCloud(next, auth.currentUser);
        return next;
      });
      pushToast('success', 'Perubahan profil wajib pajak & kode otorisasi berhasil disimpan.');
    },
    [pushToast, syncSnapshotToCloud, updateSnapshot]
  );

  const resetSimulationData = useCallback(async () => {
    const current = snapshotRef.current;
    if (!current) return;
    const fresh = createSeedSnapshot(
      current.workspace.nik,
      firebaseUser?.uid || 'local_user',
      current.workspace.opProfile.nama
    );
    saveLocalSnapshot(fresh.workspace.nik, fresh);
    setSnapshot(fresh);

    if (firebaseUser && firebaseUser.emailVerified) {
      try {
        const batch = writeBatch(db);
        const uid = firebaseUser.uid;
        for (const inv of current.efaktur) batch.delete(doc(db, 'users', uid, 'efaktur', inv.id));
        for (const sl of current.ebupot) batch.delete(doc(db, 'users', uid, 'ebupot', sl.id));
        for (const tr of current.taxReturns) batch.delete(doc(db, 'users', uid, 'taxReturns', tr.id));
        for (const bi of current.billing) batch.delete(doc(db, 'users', uid, 'billing', bi.id));
        for (const le of current.ledger) batch.delete(doc(db, 'users', uid, 'ledger', le.id));
        await batch.commit();
        await syncSnapshotToCloud(fresh, firebaseUser);
      } catch {
        // non-fatal
      }
    }
    pushToast('info', 'Seluruh data simulasi telah direset ke kondisi awal studi kasus KelasBrevet.');
  }, [firebaseUser, pushToast, syncSnapshotToCloud]);

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
      const { id, createdAtIso: _c, ...cloudData } = newInv;
      void syncDocToCloud('efaktur', id, cloudData, false);
      pushToast('success', `Draft e-Faktur (${newInv.invoiceNumber}) berhasil disimpan.`);
      return newInv;
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const approveEFaktur = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!target) return;
      const nsfp =
        target.category === 'OUTPUT' || target.category === 'OUTPUT_RETURN'
          ? generateNsfp(target.transactionCode, Boolean(target.amendmentOf))
          : target.invoiceNumber;

      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) =>
          i.id === invoiceId ? { ...i, status: 'APPROVED', invoiceNumber: nsfp } : i
        ),
      }));
      void syncDocToCloud('efaktur', invoiceId, { status: 'APPROVED', invoiceNumber: nsfp }, true);
      pushToast('success', `Faktur Pajak disetujui (APPROVED). NSFP: ${nsfp}`);
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const requestAmendEFaktur = useCallback(
    (invoiceId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) =>
          i.id === invoiceId ? { ...i, status: 'WAITING_FOR_AMENDMENT' } : i
        ),
      }));
      void syncDocToCloud('efaktur', invoiceId, { status: 'WAITING_FOR_AMENDMENT' }, true);
      pushToast(
        'info',
        'Permintaan Faktur Pengganti dikirim. Klik ikon Lonceng Notifikasi di atas untuk mensimulasikan persetujuan pembeli.'
      );
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const requestCancelEFaktur = useCallback(
    (invoiceId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) =>
          i.id === invoiceId ? { ...i, status: 'WAITING_FOR_CANCELLATION' } : i
        ),
      }));
      void syncDocToCloud('efaktur', invoiceId, { status: 'WAITING_FOR_CANCELLATION' }, true);
      pushToast(
        'info',
        'Permintaan Pembatalan Faktur dikirim. Klik ikon Lonceng Notifikasi di atas untuk mensimulasikan persetujuan pembeli.'
      );
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const approveBuyerNotification = useCallback(
    (invoiceId: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!target) return;

      if (target.status === 'WAITING_FOR_CANCELLATION') {
        updateSnapshot((prev) => ({
          ...prev,
          efaktur: prev.efaktur.map((i) => (i.id === invoiceId ? { ...i, status: 'CANCELED' } : i)),
        }));
        void syncDocToCloud('efaktur', invoiceId, { status: 'CANCELED' }, true);
        pushToast('success', `Pembeli menyetujui pembatalan. Faktur ${target.invoiceNumber} kini berstatus CANCELED.`);
      } else if (target.status === 'WAITING_FOR_AMENDMENT') {
        const amendedNsfp = generateNsfp(target.transactionCode, true);
        updateSnapshot((prev) => ({
          ...prev,
          efaktur: prev.efaktur.map((i) =>
            i.id === invoiceId ? { ...i, status: 'AMENDED', invoiceNumber: amendedNsfp } : i
          ),
        }));
        void syncDocToCloud('efaktur', invoiceId, { status: 'AMENDED', invoiceNumber: amendedNsfp }, true);
        pushToast('success', `Pembeli menyetujui penggantian. NSFP Pengganti: ${amendedNsfp} (AMENDED).`);
      }
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const toggleCreditInputEFaktur = useCallback(
    (invoiceId: string, sp2dNumber?: string) => {
      const cur = snapshotRef.current;
      const target = cur?.efaktur.find((i) => i.id === invoiceId);
      if (!target) return;
      const nextCredit = target.creditStatus === 'CREDITED' ? 'UNCREDITED' : 'CREDITED';
      const nextSp2d = sp2dNumber !== undefined ? sp2dNumber : target.sp2dNumber;

      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.map((i) =>
          i.id === invoiceId ? { ...i, creditStatus: nextCredit, sp2dNumber: nextSp2d } : i
        ),
      }));
      void syncDocToCloud('efaktur', invoiceId, { creditStatus: nextCredit, sp2dNumber: nextSp2d }, true);
      pushToast(
        'success',
        nextCredit === 'CREDITED'
          ? `Faktur Masukan ${target.invoiceNumber} berhasil dikreditkan (masuk Lampiran B-2).`
          : `Faktur Masukan ${target.invoiceNumber} dipindahkan ke Tidak Dikreditkan (Lampiran B-3).`
      );
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const deleteEFaktur = useCallback(
    (invoiceId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        efaktur: prev.efaktur.filter((i) => i.id !== invoiceId),
      }));
      void deleteDocFromCloud('efaktur', invoiceId);
      pushToast('info', 'Draft e-Faktur dihapus.');
    },
    [deleteDocFromCloud, pushToast, updateSnapshot]
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
      const { id, createdAtIso: _c, ...cloudData } = newSlip;
      void syncDocToCloud('ebupot', id, cloudData, false);
      pushToast('success', `Bukti Potong ${newSlip.slipType} tersimpan di daftar Belum Terbit.`);
      return newSlip;
    },
    [pushToast, syncDocToCloud, updateSnapshot]
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
      for (const s of created) {
        const { id, createdAtIso: _c, ...cloudData } = s;
        void syncDocToCloud('ebupot', id, cloudData, false);
      }
      pushToast('success', `Berhasil mengimpor ${created.length} data Bukti Potong ke status Belum Terbit.`);
      return created.length;
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const issueEBupotSlips = useCallback(
    (slipIds: string[]) => {
      const idSet = new Set(slipIds);
      const issuedNumbers = new Map<string, string>();

      updateSnapshot((prev) => ({
        ...prev,
        ebupot: prev.ebupot.map((sl) => {
          if (!idSet.has(sl.id) || sl.status !== 'BELUM_TERBIT') return sl;
          const num = generateSlipNumber(sl.slipType);
          issuedNumbers.set(sl.id, num);
          return { ...sl, status: 'TELAH_TERBIT', slipNumber: num };
        }),
      }));

      for (const [sid, num] of issuedNumbers.entries()) {
        void syncDocToCloud('ebupot', sid, { status: 'TELAH_TERBIT', slipNumber: num }, true);
      }
      pushToast('success', `${issuedNumbers.size} Bukti Potong berhasil diterbitkan (TTE) & siap diposting ke SPT.`);
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const cancelEBupotSlip = useCallback(
    (slipId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        ebupot: prev.ebupot.map((sl) => (sl.id === slipId ? { ...sl, status: 'DIBATALKAN' } : sl)),
      }));
      void syncDocToCloud('ebupot', slipId, { status: 'DIBATALKAN' }, true);
      pushToast('info', 'Bukti Potong telah dibatalkan.');
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const deleteEBupotSlip = useCallback(
    (slipId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        ebupot: prev.ebupot.filter((sl) => sl.id !== slipId),
      }));
      void deleteDocFromCloud('ebupot', slipId);
      pushToast('info', 'Draft Bukti Potong dihapus.');
    },
    [deleteDocFromCloud, pushToast, updateSnapshot]
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
      const { id, createdAtIso: _c, ...cloudData } = newReturn;
      void syncDocToCloud('taxReturns', id, cloudData, false);
      pushToast('success', 'Konsep SPT berhasil dibuat. Silakan klik Posting SPT untuk prepopulate data.');
      return newReturn;
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const updateTaxReturnPayload = useCallback(
    (returnId: string, payload: AnySptPayload) => {
      const cur = snapshotRef.current;
      const target = cur?.taxReturns.find((r) => r.id === returnId);
      if (!target || target.status === 'DILAPORKAN') return;

      const { taxPosition, amountDue } = computeReturnPosition(target.returnType, payload);
      updateSnapshot((prev) => ({
        ...prev,
        taxReturns: prev.taxReturns.map((r) =>
          r.id === returnId ? { ...r, payload, taxPosition, amountDue } : r
        ),
      }));
      void syncDocToCloud('taxReturns', returnId, { payload, taxPosition, amountDue }, true);
    },
    [syncDocToCloud, updateSnapshot]
  );

  const postTaxReturnData = useCallback(
    (returnId: string) => {
      const cur = snapshotRef.current;
      if (!cur) return;
      const target = cur.taxReturns.find((r) => r.id === returnId);
      if (!target) return;

      const nowIso = new Date().toISOString();

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
        updateTaxReturnPayload(returnId, nextPayload);
        pushToast('success', `Posting SPT Masa PPN berhasil menarik ${periodInvoices.length} dokumen e-Faktur.`);
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
        updateTaxReturnPayload(returnId, nextPayload);
        pushToast('success', `Posting SPT Masa PPh 21/26 menarik ${periodSlips.length} Bukti Potong terbit.`);
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
        updateTaxReturnPayload(returnId, nextPayload);
        pushToast('success', `Posting SPT Masa PPh Unifikasi menarik ${periodSlips.length} Bukti Potong BPPU.`);
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
        updateTaxReturnPayload(returnId, nextPayload);
        pushToast('success', `Posting SPT Tahunan OP berhasil menarik ${mySlips.length} Bukti Potong BPA1/BPA2.`);
        return;
      }

      if (target.returnType === 'PPH_BADAN_TAHUNAN') {
        const prevPayload = target.payload as SptBadanTahunanPayload;
        updateTaxReturnPayload(returnId, { ...prevPayload, postedAt: nowIso });
        pushToast('success', 'Posting SPT Tahunan PPh Badan berhasil memperbarui ringkasan fiskal.');
      }
    },
    [pushToast, updateTaxReturnPayload]
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
        updateSnapshot((prev) => ({
          ...prev,
          taxReturns: prev.taxReturns.map((r) =>
            r.id === returnId
              ? {
                  ...r,
                  status: 'DILAPORKAN',
                  taxPosition,
                  amountDue,
                  bpeNumber: bpe,
                  submittedAt: nowIso,
                }
              : r
          ),
        }));
        void syncDocToCloud(
          'taxReturns',
          returnId,
          { status: 'DILAPORKAN', taxPosition, amountDue, bpeNumber: bpe, billingCode: '', submittedAt: nowIso, payload: target.payload },
          true
        );
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

        updateSnapshot((prev) => {
          const nextWorkspace = {
            ...prev.workspace,
            opProfile:
              role === 'OP' ? { ...prev.workspace.opProfile, depositBalance: newBalance } : prev.workspace.opProfile,
            badanProfile:
              role === 'BADAN'
                ? { ...prev.workspace.badanProfile, depositBalance: newBalance }
                : prev.workspace.badanProfile,
          };
          return {
            ...prev,
            workspace: nextWorkspace,
            taxReturns: prev.taxReturns.map((r) =>
              r.id === returnId
                ? {
                    ...r,
                    status: 'DILAPORKAN',
                    taxPosition,
                    amountDue,
                    bpeNumber: bpe,
                    submittedAt: nowIso,
                  }
                : r
            ),
            ledger: [ledgerEntry, ...prev.ledger],
          };
        });

        void syncDocToCloud(
          'taxReturns',
          returnId,
          { status: 'DILAPORKAN', taxPosition, amountDue, bpeNumber: bpe, billingCode: '', submittedAt: nowIso, payload: target.payload },
          true
        );
        const { id: ledId, createdAtIso: _lc, ...ledCloud } = ledgerEntry;
        void syncDocToCloud('ledger', ledId, ledCloud, false);
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

      updateSnapshot((prev) => ({
        ...prev,
        taxReturns: prev.taxReturns.map((r) =>
          r.id === returnId
            ? {
                ...r,
                status: 'MENUNGGU_PEMBAYARAN',
                taxPosition,
                amountDue,
                billingCode: billingNum,
              }
            : r
        ),
        billing: [newBill, ...prev.billing],
      }));

      void syncDocToCloud(
        'taxReturns',
        returnId,
        { status: 'MENUNGGU_PEMBAYARAN', taxPosition, amountDue, bpeNumber: '', billingCode: billingNum, submittedAt: '', payload: target.payload },
        true
      );
      const { id: billId, createdAtIso: _bc, ...billCloud } = newBill;
      void syncDocToCloud('billing', billId, billCloud, false);
      pushToast('info', `Kode Billing ${billingNum} diterbitkan. Lunasi di menu Pembayaran agar SPT otomatis dilaporkan.`);
      return { ok: true, message: billingNum };
    },
    [pushToast, syncDocToCloud, updateSnapshot]
  );

  const deleteTaxReturn = useCallback(
    (returnId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        taxReturns: prev.taxReturns.filter((r) => r.id !== returnId),
      }));
      void deleteDocFromCloud('taxReturns', returnId);
      pushToast('info', 'Konsep SPT dihapus.');
    },
    [deleteDocFromCloud, pushToast, updateSnapshot]
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
      const { id, createdAtIso: _c, ...cloudData } = bill;
      void syncDocToCloud('billing', id, cloudData, false);
      pushToast('success', `Kode Billing ${bill.billingNumber} berhasil dibuat.`);
      return bill;
    },
    [pushToast, syncDocToCloud, updateSnapshot]
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

      updateSnapshot((prev) => ({
        ...prev,
        billing: prev.billing.map((b) =>
          b.id === billingId ? { ...b, status: 'LUNAS', ntpn, paidAt: nowIso } : b
        ),
        taxReturns: target.relatedReturnId
          ? prev.taxReturns.map((r) =>
              r.id === target.relatedReturnId
                ? { ...r, status: 'DILAPORKAN', bpeNumber: bpe, submittedAt: nowIso }
                : r
            )
          : prev.taxReturns,
        ledger: [ledgerEntry, ...prev.ledger],
      }));

      void syncDocToCloud('billing', billingId, { status: 'LUNAS', ntpn, paidAt: nowIso }, true);
      if (target.relatedReturnId) {
        const linked = cur.taxReturns.find((r) => r.id === target.relatedReturnId);
        if (linked) {
          void syncDocToCloud(
            'taxReturns',
            linked.id,
            {
              status: 'DILAPORKAN',
              taxPosition: linked.taxPosition,
              amountDue: linked.amountDue,
              bpeNumber: bpe,
              billingCode: linked.billingCode,
              submittedAt: nowIso,
              payload: linked.payload,
            },
            true
          );
        }
      }
      const { id: ledId, createdAtIso: _lc, ...ledCloud } = ledgerEntry;
      void syncDocToCloud('ledger', ledId, ledCloud, false);

      pushToast(
        'success',
        target.relatedReturnId
          ? `Billing Lunas (NTPN: ${ntpn}). SPT otomatis berpindah ke SPT Dilaporkan dengan BPE ${bpe}!`
          : `Pembayaran Billing Lunas! NTPN Simulasi: ${ntpn}`
      );
    },
    [pushToast, syncDocToCloud, updateSnapshot]
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

      updateSnapshot((prev) => ({
        ...prev,
        workspace: {
          ...prev.workspace,
          opProfile: role === 'OP' ? { ...prev.workspace.opProfile, depositBalance: nextBal } : prev.workspace.opProfile,
          badanProfile:
            role === 'BADAN' ? { ...prev.workspace.badanProfile, depositBalance: nextBal } : prev.workspace.badanProfile,
        },
        ledger: [ledgerEntry, ...prev.ledger],
      }));
      const { id: ledId, createdAtIso: _lc, ...ledCloud } = ledgerEntry;
      void syncDocToCloud('ledger', ledId, ledCloud, false);
      pushToast('success', `Deposit Pajak bertambah. NTPN: ${ntpn}`);
    },
    [pushToast, syncDocToCloud, updateSnapshot]
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
      firebaseUser,
      authLoading,
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
      connectGoogleCloud,
      disconnectGoogleCloud,
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
      firebaseUser,
      authLoading,
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
      connectGoogleCloud,
      disconnectGoogleCloud,
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
