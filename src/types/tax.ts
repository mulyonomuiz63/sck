export type TaxpayerRole = 'OP' | 'BADAN';

export type NavSection =
  | 'dashboard'
  | 'portal_saya'
  | 'efaktur'
  | 'ebupot'
  | 'spt'
  | 'pembayaran'
  | 'ujian';

export interface TaxpayerProfileOP {
  nik: string;
  npwp: string;
  nama: string;
  alamat: string;
  klu: string;
  ptkp: string;
  pekerjaan: string;
  email: string;
  passphrase: string;
  depositBalance: number;
}

export interface TaxpayerProfileBadan {
  npwp: string;
  nama: string;
  alamat: string;
  klu: string;
  statusPkp: 'AKTIF' | 'NON_PKP';
  penanggungJawab: string;
  passphrase: string;
  depositBalance: number;
}

export interface TaxWorkspace {
  id: string;
  ownerId: string;
  nik: string;
  opProfile: TaxpayerProfileOP;
  badanProfile: TaxpayerProfileBadan;
  activeRole: TaxpayerRole;
  guidedMode: boolean;
  activeCaseId: string;
}

export type EFakturCategory =
  | 'OUTPUT'
  | 'INPUT'
  | 'SPECIAL_OUTPUT'
  | 'SPECIAL_INPUT'
  | 'OUTPUT_RETURN'
  | 'INPUT_RETURN';

export type EFakturStatus =
  | 'CREATED'
  | 'APPROVED'
  | 'WAITING_FOR_AMENDMENT'
  | 'AMENDED'
  | 'WAITING_FOR_CANCELLATION'
  | 'CANCELED';

export type EFakturCreditStatus = 'CREDITED' | 'UNCREDITED' | 'NA';

export interface EFakturItem {
  id: string;
  itemType: 'BARANG' | 'JASA';
  itemCode: string;
  name: string;
  unit: string;
  unitPrice: number;
  qty: number;
  discount: number;
  dpp: number;
  useDppNilaiLain: boolean;
  dppNilaiLain: number;
  ppn: number;
  ppnbm: number;
}

export interface EFakturInvoice {
  id: string;
  ownerId: string;
  workspaceId: string;
  category: EFakturCategory;
  transactionCode: string;
  invoiceNumber: string;
  invoiceDate: string;
  masaPajak: number;
  tahunPajak: number;
  counterpartyNpwp: string;
  counterpartyName: string;
  status: EFakturStatus;
  creditStatus: EFakturCreditStatus;
  dppTotal: number;
  dppNilaiLain: number;
  ppnTotal: number;
  ppnbmTotal: number;
  items: EFakturItem[];
  referenceDoc: string;
  sp2dNumber: string;
  amendmentOf: string;
  createdAtIso: string;
}

export type EBupotType = 'MP' | 'BP21' | 'BPA1' | 'BPA2' | 'BPPU';
export type EBupotStatus = 'BELUM_TERBIT' | 'TELAH_TERBIT' | 'DIBATALKAN';

export interface EBupotSlip {
  id: string;
  ownerId: string;
  workspaceId: string;
  slipType: EBupotType;
  slipNumber: string;
  masaPajak: number;
  tahunPajak: number;
  recipientNik: string;
  recipientName: string;
  ptkpStatus: string;
  terCategory: 'A' | 'B' | 'C' | 'NA';
  objectCode: string;
  objectName: string;
  grossAmount: number;
  taxRate: number;
  pphAmount: number;
  referenceDoc: string;
  status: EBupotStatus;
  issuerNpwp: string;
  issuerName: string;
  createdAtIso: string;
}

export type TaxReturnType =
  | 'PPN'
  | 'PPH21_MASA'
  | 'PPH_UNIFIKASI'
  | 'PPH_OP_TAHUNAN'
  | 'PPH_BADAN_TAHUNAN';

export type TaxReturnStatus = 'KONSEP' | 'MENUNGGU_PEMBAYARAN' | 'DILAPORKAN';
export type TaxPosition = 'NIHIL' | 'KURANG_BAYAR' | 'LEBIH_BAYAR';

export interface SptPpnPayload {
  postedAt?: string;
  a1EksporDpp: number;
  a2KeluaranDpp: number;
  a2KeluaranPpn: number;
  a2DipungutSendiriPpn: number;
  a2DipungutPemungutPpn: number;
  a2TidakDipungutDpp: number;
  b1ImporDpp: number;
  b1ImporPpn: number;
  b2MasukanKreditDpp: number;
  b2MasukanKreditPpn: number;
  b3TidakDikreditkanDpp: number;
  b3TidakDikreditkanPpn: number;
  cDipungutPihakLainPpn: number;
  kompensasiMasaLalu: number;
  ppnKms: number;
  ppnbmTerutang: number;
  overpaymentAction: 'KOMPENSASI' | 'RESTITUSI_CEPAT' | 'RESTITUSI_BIASA';
  declarationChecked: boolean;
  linkedInvoiceIds: string[];
}

export interface SptPph21MasaPayload {
  postedAt?: string;
  jumlahPegawaiTetap: number;
  brutoPegawaiTetap: number;
  pphPegawaiTetap: number;
  jumlahBukanPegawai: number;
  brutoBukanPegawai: number;
  pphBukanPegawai: number;
  jumlahBpa1: number;
  pphBpa1: number;
  kompensasiSebelumnya: number;
  declarationChecked: boolean;
  linkedSlipIds: string[];
}

export interface SptUnifikasiPayload {
  postedAt?: string;
  jumlahBppu: number;
  dppPph23: number;
  pph23Terutang: number;
  dppPph4Ayat2: number;
  pph4Ayat2Terutang: number;
  dppPph22: number;
  pph22Terutang: number;
  declarationChecked: boolean;
  linkedSlipIds: string[];
}

export interface HartaItem {
  id: string;
  subCategory:
    | 'KAS'
    | 'PIUTANG'
    | 'INVESTASI'
    | 'HARTA_BERGERAK'
    | 'HARTA_TIDAK_BERGERAK'
    | 'HARTA_LAINNYA';
  kodeHarta: string;
  deskripsi: string;
  tahunPerolehan: number;
  hargaPerolehan: number;
  nilaiSaatIni: number;
  keterangan: string;
}

export interface UtangItem {
  id: string;
  kodeUtang: string;
  namaPemberiPinjaman: string;
  tahunPinjam: number;
  saldoAkhir: number;
}

export interface KeluargaItem {
  id: string;
  nama: string;
  nik: string;
  hubungan: string;
  pekerjaan: string;
}

export interface PenghasilanFinalItem {
  id: string;
  jenis: string;
  dasarPengenaan: number;
  tarifPersen: number;
  pphTerutang: number;
}

export interface PenghasilanBukanObjekItem {
  id: string;
  jenis: string;
  nilai: number;
}

export interface SptOpTahunanPayload {
  postedAt?: string;
  sumberPenghasilan: 'PEKERJAAN' | 'USAHA_BEBAS' | 'CAMPURAN';
  metodePembukuan: 'PENCATATAN' | 'PEMBUKUAN';
  statusKewajibanSuamiIstri: 'KK' | 'HB' | 'PH' | 'MT';
  ptkpStatus: string;
  // Induk dynamic toggles (Bagian B-H)
  hasPenghasilanPekerjaan: boolean;
  hasPenghasilanUsaha: boolean;
  hasPenghasilanFinal: boolean;
  hasPenghasilanBukanObjek: boolean;
  hasPenghasilanLN: boolean;
  hasZakatSumbangan: boolean;
  // Penghasilan DN Pekerjaan
  brutoPekerjaan: number;
  biayaJabatan: number;
  iuranPensiun: number;
  // Penghasilan DN Usaha/Pekerjaan Bebas (Norma/Neto)
  peredaranBrutoUsaha: number;
  normaPersen: number;
  netoUsaha: number;
  // Zakat / Pengurang lain
  zakatSumbangan: number;
  // Kredit Pajak (dari BPA1/BPA2/PPh25)
  kreditPajakDipungut: number;
  angsuranPph25: number;
  // Lampiran L-1
  hartaList: HartaItem[];
  utangList: UtangItem[];
  keluargaList: KeluargaItem[];
  linkedSlipIds: string[];
  // Lampiran L-2
  penghasilanFinalList: PenghasilanFinalItem[];
  penghasilanBukanObjekList: PenghasilanBukanObjekItem[];
  penghasilanLNBruto: number;
  kreditPajakPph24: number;
  declarationChecked: boolean;
}

export interface KoreksiFiskalItem {
  id: string;
  jenis: 'POSITIF' | 'NEGATIF';
  akun: string;
  dasarHukum: string;
  nilai: number;
}

export interface KreditPajakBadanItem {
  id: string;
  pasal: 'PPh 22' | 'PPh 23' | 'PPh 24' | 'PPh 25';
  pemotong: string;
  nomorBukti: string;
  nilai: number;
}

export interface SptBadanTahunanPayload {
  postedAt?: string;
  tahunBuku: string;
  metodePenyusutan: 'GARIS_LURUS' | 'SALDO_MENURUN';
  // Laporan Laba Rugi Komersial
  peredaranUsaha: number;
  hpp: number;
  bebanUsaha: number;
  penghasilanLuarUsaha: number;
  bebanLuarUsaha: number;
  // Rekonsiliasi Fiskal
  koreksiList: KoreksiFiskalItem[];
  kompensasiKerugian: number;
  // Tarif PPh Badan
  gunakanFasilitas31E: boolean;
  // Kredit Pajak
  kreditPajakList: KreditPajakBadanItem[];
  angsuranPph25Setahun: number;
  declarationChecked: boolean;
}

export type AnySptPayload =
  | SptPpnPayload
  | SptPph21MasaPayload
  | SptUnifikasiPayload
  | SptOpTahunanPayload
  | SptBadanTahunanPayload;

export interface TaxReturn {
  id: string;
  ownerId: string;
  workspaceId: string;
  taxpayerRole: TaxpayerRole;
  returnType: TaxReturnType;
  masaPajak: number;
  tahunPajak: number;
  pembetulanKe: number;
  status: TaxReturnStatus;
  taxPosition: TaxPosition;
  amountDue: number;
  bpeNumber: string;
  billingCode: string;
  submittedAt: string;
  payload: AnySptPayload;
  createdAtIso: string;
}

export interface BillingCode {
  id: string;
  ownerId: string;
  workspaceId: string;
  taxpayerRole: TaxpayerRole;
  billingNumber: string;
  kapKjs: string;
  description: string;
  masaPajak: number;
  tahunPajak: number;
  amount: number;
  status: 'BELUM_BAYAR' | 'LUNAS';
  ntpn: string;
  relatedReturnId: string;
  paidAt: string;
  createdAtIso: string;
}

export interface LedgerEntry {
  id: string;
  ownerId: string;
  workspaceId: string;
  taxpayerRole: TaxpayerRole;
  entryDate: string;
  entryType: 'DEPOSIT_TOPUP' | 'DEPOSIT_TRANSFER' | 'BILLING_PAYMENT' | 'TAX_ASSESSMENT';
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  createdAtIso: string;
}

export interface PrintableDocument {
  kind: 'BPE' | 'EFAKTUR' | 'EBUPOT' | 'SPT_INDUK' | 'SERTIFIKAT';
  title: string;
  subtitle: string;
  docNumber: string;
  date: string;
  taxpayerName: string;
  taxpayerNpwp: string;
  rows: { label: string; value: string; highlight?: boolean }[];
  footerNote?: string;
  certificateMeta?: {
    config: CertificateConfig;
    score: number;
    maxScore: number;
    passingScore: number;
    packageCode: string;
    moduleLabel: string;
    caseCode: string;
    caseTitle: string;
    issuedAt: string;
  };
}

export interface GuidedStepDefinition {
  id: string;
  title: string;
  instruction: string;
  targetNav: NavSection;
  requiredRole?: TaxpayerRole;
  check: (state: SimulatorSnapshot) => boolean;
}

export interface GuidedCaseDefinition {
  id: string;
  moduleCode: string;
  title: string;
  summary: string;
  recommendedRole: TaxpayerRole;
  steps: GuidedStepDefinition[];
}

export interface SimulatorSnapshot {
  workspace: TaxWorkspace;
  efaktur: EFakturInvoice[];
  ebupot: EBupotSlip[];
  taxReturns: TaxReturn[];
  billing: BillingCode[];
  ledger: LedgerEntry[];
  enrollment?: EnrolledParticipant | null;
}

// ============================================================================
// Enrollment (Whitelist NIK kelasbrevet.com), Exam Cases & Auto-Grading Types
// ============================================================================

export type ParticipantStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface EnrolledParticipant {
  nik: string;
  fullName: string;
  email: string;
  phone: string;
  packageCode: string; // e.g. BREVET_A, BREVET_B, BREVET_AB
  orderId: string;
  status: ParticipantStatus;
  expiresAt: string; // YYYY-MM-DD or ''
  source: string;
  createdAt?: string;
}

export type ExamModuleType =
  | 'PPN'
  | 'PPH21_TAHUNAN'
  | 'EBUPOT_21_23'
  | 'PPH_OP_UMUM'
  | 'PPH_BADAN';

export type ExamRuleType =
  | 'EFAKTUR_OUTPUT_APPROVED_MIN'
  | 'EFAKTUR_INPUT_CREDITED_MIN'
  | 'EFAKTUR_MATCH_AMOUNT'
  | 'EBUPOT_ISSUED_MIN'
  | 'EBUPOT_TOTAL_PPH_MATCH'
  | 'SPT_REPORTED'
  | 'SPT_POSITION_MATCH'
  | 'SPT_AMOUNT_DUE_MATCH'
  | 'SPT_OP_HARTA_UTANG_MIN'
  | 'SPT_BADAN_FISCAL_CHECK'
  | 'PAYMENT_SETTLED';

export interface ExamRubricRule {
  id: string;
  type: ExamRuleType;
  label: string;
  weight: number;
  // Optional parameters depending on rule type
  returnType?: TaxReturnType;
  slipType?: EBupotType | 'ANY';
  efakturCategory?: EFakturCategory | 'ANY';
  expectedPosition?: TaxPosition;
  taxpayerRole?: TaxpayerRole;
  masaPajak?: number;
  tahunPajak?: number;
  minCount?: number;
  targetAmount?: number;
  tolerance?: number;
}

export interface ExamCase {
  id: string;
  code: string;
  title: string;
  moduleType: ExamModuleType;
  packageAccess: string; // 'ALL' or comma-separated e.g. 'BREVET_A,BREVET_AB'
  passingScore: number;
  maxAttempts: number;
  isActive: boolean;
  scenarioText: string;
  rubric: ExamRubricRule[];
  createdAt?: string;
}

export interface ExamRuleResult {
  ruleId: string;
  label: string;
  weight: number;
  earned: number;
  passed: boolean;
  actualSummary: string;
  expectedSummary: string;
}

export type ExamAttemptStatus = 'IN_PROGRESS' | 'PASSED' | 'FAILED';

export interface ExamAttempt {
  id: string;
  caseId: string;
  caseCode?: string;
  caseTitle?: string;
  nik: string;
  participantName: string;
  packageCode: string;
  attemptNumber: number;
  status: ExamAttemptStatus;
  score: number;
  maxScore: number;
  passingScore: number;
  results: ExamRuleResult[];
  certificateNumber?: string;
  certificateIssuedAt?: string;
  startedAt: string;
  submittedAt: string;
}

export interface CertificateConfig {
  autoIssueEnabled: boolean;
  organizationName: string;
  certificateTitle: string;
  programSubtitle: string;
  numberPrefix: string;
  issueCity: string;
  signer1Name: string;
  signer1Title: string;
  signer2Name: string;
  signer2Title: string;
  logoDataUrl: string;
  signature1DataUrl: string;
  signature2DataUrl: string;
  footerNote: string;
}

export interface AppSettingsConfig {
  whitelistEnforced: boolean;
  webhookCallbackUrl: string;
  certificate: CertificateConfig;
}

