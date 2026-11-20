import crypto from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import {
  AppSettingsConfig,
  CertificateConfig,
  EnrolledParticipant,
  ExamAttempt,
  ExamCase,
  ExamRubricRule,
  ExamRuleResult,
  ParticipantStatus,
} from '../types/tax.ts';
import { getDefaultExamCases, gradeExamAttempt } from './examGrader.ts';
import { ensureSchema, getPool, getSnapshotByNik, isMysqlConfigured } from './mysqlStore.ts';

const DEMO_NIK = '3273011205900001';

export const DEFAULT_CERTIFICATE_CONFIG: CertificateConfig = {
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

// In-memory fallback stores when MYSQL_HOST is not configured (local preview)
const memParticipants = new Map<string, EnrolledParticipant>();
const memExamCases = new Map<string, ExamCase>();
const memAttempts = new Map<string, ExamAttempt>();
const memSettings: AppSettingsConfig = {
  whitelistEnforced: true,
  webhookCallbackUrl: '',
  certificate: { ...DEFAULT_CERTIFICATE_CONFIG },
};
let memSeeded = false;
let mysqlSeeded = false;

function getAuthSecret(): string {
  return process.env.APP_AUTH_SECRET || 'kelasbrevet_dev_secret_change_in_production_2025';
}

export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: process.env.ADMIN_USERNAME || 'admin@kelasbrevet.com',
    password: process.env.ADMIN_PASSWORD || 'KelasBrevetAdmin2025!',
  };
}

export function getIntegrationApiKey(): string {
  return process.env.INTEGRATION_API_KEY || 'kb_live_secret_key_ganti_di_env';
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// --- Stateless HMAC Tokens (Admin Session & 1-Click SSO from kelasbrevet.com) ---
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const data = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expected = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
    if (!safeEqual(sig, expected)) return null;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof decoded.exp !== 'number' || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function verifyIntegrationApiKey(provided: string | undefined): boolean {
  if (!provided) return false;
  return safeEqual(provided.trim(), getIntegrationApiKey().trim());
}

function parseJson<T>(raw: unknown, fallback: T): T {
  try {
    if (typeof raw === 'string') return JSON.parse(raw) as T;
    if (raw && typeof raw === 'object') return raw as T;
    return fallback;
  } catch {
    return fallback;
  }
}

function seedMemoryBootstrap(): void {
  if (memSeeded) return;
  memParticipants.set(DEMO_NIK, {
    nik: DEMO_NIK,
    fullName: 'TUAN A (PESERTA BREVET)',
    email: 'tuana@kelasbrevet.com',
    phone: '081234567890',
    packageCode: 'BREVET_AB',
    orderId: 'KB-DEMO-001',
    status: 'ACTIVE',
    expiresAt: '',
    source: 'SYSTEM_SEED',
    createdAt: new Date().toISOString(),
  });
  for (const c of getDefaultExamCases()) {
    memExamCases.set(c.id, c);
  }
  memSeeded = true;
}

async function ensureBootstrapData(): Promise<void> {
  if (!isMysqlConfigured()) {
    seedMemoryBootstrap();
    return;
  }

  await ensureSchema();
  if (!isMysqlConfigured()) {
    seedMemoryBootstrap();
    return;
  }
  if (mysqlSeeded) return;

  const db = getPool();
  // Seed demo participant if absent so demo login works out-of-the-box
  await db.query(
    `INSERT IGNORE INTO enrolled_participants
      (nik, full_name, email, phone, package_code, order_id, status, expires_at, source)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', '', 'SYSTEM_SEED')`,
    [DEMO_NIK, 'TUAN A (PESERTA BREVET)', 'tuana@kelasbrevet.com', '081234567890', 'BREVET_AB', 'KB-DEMO-001']
  );

  // Migration-safe check for certificate columns on existing MySQL databases
  const [certColRows] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM exam_attempts LIKE 'certificate_number'`
  );
  if (certColRows.length === 0) {
    await db.query(
      `ALTER TABLE exam_attempts
       ADD COLUMN certificate_number VARCHAR(64) NOT NULL DEFAULT '' AFTER results_json,
       ADD COLUMN certificate_issued_at VARCHAR(40) NOT NULL DEFAULT '' AFTER certificate_number`
    );
  }

  // Seed default app settings if absent
  await db.query(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('whitelist_enforced', 'true')`
  );
  await db.query(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('webhook_callback_url', '')`
  );
  await db.query(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('certificate_config', ?)`,
    [JSON.stringify(DEFAULT_CERTIFICATE_CONFIG)]
  );

  // Seed default 4 exam cases if table is empty
  const [countRows] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM exam_cases');
  if (Number(countRows[0]?.cnt || 0) === 0) {
    for (const c of getDefaultExamCases()) {
      await db.query(
        `INSERT IGNORE INTO exam_cases
          (id, code, title, module_type, package_access, passing_score, max_attempts, is_active, scenario_text, rubric_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.code,
          c.title,
          c.moduleType,
          c.packageAccess,
          c.passingScore,
          c.maxAttempts,
          c.isActive ? 1 : 0,
          c.scenarioText,
          JSON.stringify(c.rubric),
        ]
      );
    }
  }

  mysqlSeeded = true;
}

// ============================================================================
// Settings
// ============================================================================

function normalizeCertificateConfig(raw?: Partial<CertificateConfig> | null): CertificateConfig {
  return {
    autoIssueEnabled:
      typeof raw?.autoIssueEnabled === 'boolean'
        ? raw.autoIssueEnabled
        : DEFAULT_CERTIFICATE_CONFIG.autoIssueEnabled,
    organizationName: String(raw?.organizationName ?? DEFAULT_CERTIFICATE_CONFIG.organizationName).trim(),
    certificateTitle: String(raw?.certificateTitle ?? DEFAULT_CERTIFICATE_CONFIG.certificateTitle).trim(),
    programSubtitle: String(raw?.programSubtitle ?? DEFAULT_CERTIFICATE_CONFIG.programSubtitle).trim(),
    numberPrefix: String(raw?.numberPrefix ?? DEFAULT_CERTIFICATE_CONFIG.numberPrefix)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '') || 'CERT-KB',
    issueCity: String(raw?.issueCity ?? DEFAULT_CERTIFICATE_CONFIG.issueCity).trim(),
    signer1Name: String(raw?.signer1Name ?? DEFAULT_CERTIFICATE_CONFIG.signer1Name).trim(),
    signer1Title: String(raw?.signer1Title ?? DEFAULT_CERTIFICATE_CONFIG.signer1Title).trim(),
    signer2Name: String(raw?.signer2Name ?? DEFAULT_CERTIFICATE_CONFIG.signer2Name).trim(),
    signer2Title: String(raw?.signer2Title ?? DEFAULT_CERTIFICATE_CONFIG.signer2Title).trim(),
    logoDataUrl: String(raw?.logoDataUrl ?? ''),
    signature1DataUrl: String(raw?.signature1DataUrl ?? ''),
    signature2DataUrl: String(raw?.signature2DataUrl ?? ''),
    footerNote: String(raw?.footerNote ?? DEFAULT_CERTIFICATE_CONFIG.footerNote).trim(),
  };
}

export async function getAppSettings(): Promise<AppSettingsConfig> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    return {
      ...memSettings,
      certificate: { ...memSettings.certificate },
    };
  }
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT setting_key, setting_value FROM app_settings');
  const map = new Map(rows.map((r) => [String(r.setting_key), String(r.setting_value)]));
  const rawCert = parseJson<Partial<CertificateConfig>>(map.get('certificate_config'), {});
  return {
    whitelistEnforced: (map.get('whitelist_enforced') ?? 'true') !== 'false',
    webhookCallbackUrl: map.get('webhook_callback_url') || '',
    certificate: normalizeCertificateConfig(rawCert),
  };
}

export async function updateAppSettings(
  patch: Partial<Omit<AppSettingsConfig, 'certificate'>> & { certificate?: Partial<CertificateConfig> }
): Promise<AppSettingsConfig> {
  await ensureBootstrapData();
  const current = await getAppSettings();
  const mergedCertificate = patch.certificate
    ? normalizeCertificateConfig({ ...current.certificate, ...patch.certificate })
    : current.certificate;

  if (!isMysqlConfigured()) {
    if (typeof patch.whitelistEnforced === 'boolean') memSettings.whitelistEnforced = patch.whitelistEnforced;
    if (typeof patch.webhookCallbackUrl === 'string') memSettings.webhookCallbackUrl = patch.webhookCallbackUrl.trim();
    if (patch.certificate) memSettings.certificate = mergedCertificate;
    return {
      ...memSettings,
      certificate: { ...memSettings.certificate },
    };
  }
  const db = getPool();
  if (typeof patch.whitelistEnforced === 'boolean') {
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('whitelist_enforced', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [patch.whitelistEnforced ? 'true' : 'false']
    );
  }
  if (typeof patch.webhookCallbackUrl === 'string') {
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('webhook_callback_url', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [patch.webhookCallbackUrl.trim()]
    );
  }
  if (patch.certificate) {
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('certificate_config', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [JSON.stringify(mergedCertificate)]
    );
  }
  return getAppSettings();
}

// ============================================================================
// Enrollment / Whitelist Participants (kelasbrevet.com integration + Admin)
// ============================================================================

function mapParticipantRow(r: RowDataPacket): EnrolledParticipant {
  return {
    nik: String(r.nik),
    fullName: String(r.full_name),
    email: String(r.email || ''),
    phone: String(r.phone || ''),
    packageCode: String(r.package_code || 'BREVET_AB'),
    orderId: String(r.order_id || ''),
    status: (r.status as ParticipantStatus) || 'ACTIVE',
    expiresAt: String(r.expires_at || ''),
    source: String(r.source || 'ADMIN'),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

export async function getParticipantByNik(nik: string): Promise<EnrolledParticipant | null> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    return memParticipants.get(nik) || null;
  }
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT * FROM enrolled_participants WHERE nik = ? LIMIT 1',
    [nik]
  );
  return rows.length > 0 ? mapParticipantRow(rows[0]) : null;
}

export async function validateParticipantAccess(nik: string): Promise<{
  allowed: boolean;
  reason?: string;
  participant: EnrolledParticipant | null;
}> {
  const settings = await getAppSettings();
  const participant = await getParticipantByNik(nik);

  if (!settings.whitelistEnforced) {
    return { allowed: true, participant };
  }

  if (!participant) {
    return {
      allowed: false,
      participant: null,
      reason:
        'NIK belum terdaftar sebagai peserta aktif paket Brevet di kelasbrevet.com. Silakan selesaikan pembelian paket atau hubungi admin.',
    };
  }

  if (participant.status === 'SUSPENDED') {
    return {
      allowed: false,
      participant,
      reason: 'Akses simulator untuk NIK ini sedang dinonaktifkan sementara oleh admin.',
    };
  }

  if (participant.status === 'EXPIRED') {
    return {
      allowed: false,
      participant,
      reason: 'Masa aktif paket Brevet untuk NIK ini telah berakhir.',
    };
  }

  if (participant.expiresAt && /^\d{4}-\d{2}-\d{2}/.test(participant.expiresAt)) {
    const today = new Date().toISOString().slice(0, 10);
    if (participant.expiresAt.slice(0, 10) < today) {
      return {
        allowed: false,
        participant,
        reason: `Masa aktif paket (${participant.packageCode}) telah berakhir pada ${participant.expiresAt.slice(0, 10)}.`,
      };
    }
  }

  return { allowed: true, participant };
}

export async function listParticipants(): Promise<EnrolledParticipant[]> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    return Array.from(memParticipants.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }
  const [rows] = await getPool().query<RowDataPacket[]>(
    'SELECT * FROM enrolled_participants ORDER BY updated_at DESC'
  );
  return rows.map(mapParticipantRow);
}

export async function upsertParticipant(input: EnrolledParticipant): Promise<EnrolledParticipant> {
  await ensureBootstrapData();
  const cleanNik = input.nik.replace(/\D/g, '');
  if (cleanNik.length !== 16) {
    throw new Error('NIK peserta harus terdiri dari tepat 16 digit angka.');
  }
  const record: EnrolledParticipant = {
    nik: cleanNik,
    fullName: (input.fullName || `PESERTA ${cleanNik.slice(-4)}`).trim(),
    email: (input.email || '').trim(),
    phone: (input.phone || '').trim(),
    packageCode: (input.packageCode || 'BREVET_AB').trim().toUpperCase(),
    orderId: (input.orderId || '').trim(),
    status: input.status || 'ACTIVE',
    expiresAt: (input.expiresAt || '').trim(),
    source: (input.source || 'ADMIN').trim(),
    createdAt: new Date().toISOString(),
  };

  if (!isMysqlConfigured()) {
    memParticipants.set(cleanNik, record);
    return record;
  }

  await getPool().query(
    `INSERT INTO enrolled_participants
      (nik, full_name, email, phone, package_code, order_id, status, expires_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      full_name = VALUES(full_name),
      email = VALUES(email),
      phone = VALUES(phone),
      package_code = VALUES(package_code),
      order_id = IF(VALUES(order_id) <> '', VALUES(order_id), order_id),
      status = VALUES(status),
      expires_at = VALUES(expires_at),
      source = VALUES(source)`,
    [
      record.nik,
      record.fullName,
      record.email,
      record.phone,
      record.packageCode,
      record.orderId,
      record.status,
      record.expiresAt,
      record.source,
    ]
  );

  return (await getParticipantByNik(cleanNik)) || record;
}

export async function upsertParticipantsBatch(items: EnrolledParticipant[]): Promise<number> {
  let count = 0;
  for (const item of items) {
    const clean = item.nik.replace(/\D/g, '');
    if (clean.length === 16) {
      await upsertParticipant({ ...item, nik: clean });
      count++;
    }
  }
  return count;
}

export async function updateParticipantStatus(nik: string, status: ParticipantStatus): Promise<void> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    const cur = memParticipants.get(nik);
    if (cur) cur.status = status;
    return;
  }
  await getPool().query('UPDATE enrolled_participants SET status = ? WHERE nik = ?', [status, nik]);
}

export async function deleteParticipant(nik: string): Promise<void> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    memParticipants.delete(nik);
    return;
  }
  await getPool().query('DELETE FROM enrolled_participants WHERE nik = ?', [nik]);
}

// ============================================================================
// Exam Cases (Bank Soal & Rubrik Kunci Jawaban)
// ============================================================================

function mapExamCaseRow(r: RowDataPacket): ExamCase {
  return {
    id: String(r.id),
    code: String(r.code),
    title: String(r.title),
    moduleType: r.module_type,
    packageAccess: String(r.package_access || 'ALL'),
    passingScore: Number(r.passing_score || 75),
    maxAttempts: Number(r.max_attempts || 3),
    isActive: Boolean(r.is_active),
    scenarioText: String(r.scenario_text || ''),
    rubric: parseJson<ExamRubricRule[]>(r.rubric_json, []),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

export async function listExamCases(onlyActive = false): Promise<ExamCase[]> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    const all = Array.from(memExamCases.values());
    return onlyActive ? all.filter((c) => c.isActive) : all;
  }
  const sql = onlyActive
    ? 'SELECT * FROM exam_cases WHERE is_active = 1 ORDER BY created_at ASC'
    : 'SELECT * FROM exam_cases ORDER BY created_at ASC';
  const [rows] = await getPool().query<RowDataPacket[]>(sql);
  return rows.map(mapExamCaseRow);
}

export async function getExamCaseById(caseId: string): Promise<ExamCase | null> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    return memExamCases.get(caseId) || null;
  }
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT * FROM exam_cases WHERE id = ? LIMIT 1', [caseId]);
  return rows.length > 0 ? mapExamCaseRow(rows[0]) : null;
}

export async function upsertExamCase(input: ExamCase): Promise<ExamCase> {
  await ensureBootstrapData();
  const record: ExamCase = {
    id: input.id || `exam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    moduleType: input.moduleType,
    packageAccess: (input.packageAccess || 'ALL').trim().toUpperCase(),
    passingScore: Math.min(100, Math.max(1, Number(input.passingScore) || 75)),
    maxAttempts: Math.max(1, Number(input.maxAttempts) || 3),
    isActive: input.isActive !== false,
    scenarioText: input.scenarioText || '',
    rubric: Array.isArray(input.rubric) ? input.rubric : [],
    createdAt: input.createdAt || new Date().toISOString(),
  };

  if (!isMysqlConfigured()) {
    memExamCases.set(record.id, record);
    return record;
  }

  await getPool().query(
    `INSERT INTO exam_cases
      (id, code, title, module_type, package_access, passing_score, max_attempts, is_active, scenario_text, rubric_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      code = VALUES(code),
      title = VALUES(title),
      module_type = VALUES(module_type),
      package_access = VALUES(package_access),
      passing_score = VALUES(passing_score),
      max_attempts = VALUES(max_attempts),
      is_active = VALUES(is_active),
      scenario_text = VALUES(scenario_text),
      rubric_json = VALUES(rubric_json)`,
    [
      record.id,
      record.code,
      record.title,
      record.moduleType,
      record.packageAccess,
      record.passingScore,
      record.maxAttempts,
      record.isActive ? 1 : 0,
      record.scenarioText,
      JSON.stringify(record.rubric),
    ]
  );

  return (await getExamCaseById(record.id)) || record;
}

export async function deleteExamCase(caseId: string): Promise<void> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    memExamCases.delete(caseId);
    for (const [aid, att] of memAttempts.entries()) {
      if (att.caseId === caseId) memAttempts.delete(aid);
    }
    return;
  }
  await getPool().query('DELETE FROM exam_cases WHERE id = ?', [caseId]);
}

export function isCaseAccessibleByPackage(examCase: ExamCase, packageCode?: string): boolean {
  const accessList = examCase.packageAccess
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (accessList.length === 0 || accessList.includes('ALL')) return true;
  if (!packageCode) return true;
  return accessList.includes(packageCode.trim().toUpperCase());
}

// ============================================================================
// Exam Attempts & Automated Grading
// ============================================================================

function mapAttemptRow(r: RowDataPacket): ExamAttempt {
  return {
    id: String(r.id),
    caseId: String(r.case_id),
    caseCode: r.case_code ? String(r.case_code) : undefined,
    caseTitle: r.case_title ? String(r.case_title) : undefined,
    nik: String(r.nik),
    participantName: String(r.participant_name),
    packageCode: String(r.package_code || 'BREVET_AB'),
    attemptNumber: Number(r.attempt_number || 1),
    status: r.status,
    score: Number(r.score || 0),
    maxScore: Number(r.max_score || 100),
    passingScore: Number(r.passing_score || 75),
    results: parseJson<ExamRuleResult[]>(r.results_json, []),
    certificateNumber: String(r.certificate_number || ''),
    certificateIssuedAt: String(r.certificate_issued_at || ''),
    startedAt: String(r.started_at),
    submittedAt: String(r.submitted_at || ''),
  };
}

export async function listAttemptsByNik(nik: string): Promise<ExamAttempt[]> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    return Array.from(memAttempts.values())
      .filter((a) => a.nik === nik)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT a.*, c.code AS case_code, c.title AS case_title
     FROM exam_attempts a
     LEFT JOIN exam_cases c ON c.id = a.case_id
     WHERE a.nik = ?
     ORDER BY a.created_at DESC`,
    [nik]
  );
  return rows.map(mapAttemptRow);
}

export async function listAllAttempts(): Promise<ExamAttempt[]> {
  await ensureBootstrapData();
  if (!isMysqlConfigured()) {
    return Array.from(memAttempts.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT a.*, c.code AS case_code, c.title AS case_title
     FROM exam_attempts a
     LEFT JOIN exam_cases c ON c.id = a.case_id
     ORDER BY a.created_at DESC
     LIMIT 2000`
  );
  return rows.map(mapAttemptRow);
}

export async function startExamAttempt(nik: string, caseId: string): Promise<ExamAttempt> {
  await ensureBootstrapData();
  const examCase = await getExamCaseById(caseId);
  if (!examCase || !examCase.isActive) {
    throw new Error('Kasus ujian tidak ditemukan atau sudah dinonaktifkan.');
  }

  const participant = await getParticipantByNik(nik);
  const snapshot = await getSnapshotByNik(nik);
  const participantName = participant?.fullName || snapshot?.workspace.opProfile.nama || `PESERTA ${nik.slice(-4)}`;
  const packageCode = participant?.packageCode || 'BREVET_AB';

  if (!isCaseAccessibleByPackage(examCase, packageCode)) {
    throw new Error(`Kasus ini khusus untuk paket ${examCase.packageAccess}. Paket Anda: ${packageCode}.`);
  }

  const existing = (await listAttemptsByNik(nik)).filter((a) => a.caseId === caseId);
  const inProgress = existing.find((a) => a.status === 'IN_PROGRESS');
  if (inProgress) {
    return { ...inProgress, caseCode: examCase.code, caseTitle: examCase.title };
  }

  const completedCount = existing.filter((a) => a.status !== 'IN_PROGRESS').length;
  if (completedCount >= examCase.maxAttempts) {
    throw new Error(`Batas maksimal percobaan (${examCase.maxAttempts}x) untuk kasus ini telah tercapai.`);
  }

  const attempt: ExamAttempt = {
    id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    caseId: examCase.id,
    caseCode: examCase.code,
    caseTitle: examCase.title,
    nik,
    participantName,
    packageCode,
    attemptNumber: completedCount + 1,
    status: 'IN_PROGRESS',
    score: 0,
    maxScore: 100,
    passingScore: examCase.passingScore,
    results: [],
    startedAt: new Date().toISOString(),
    submittedAt: '',
  };

  if (!isMysqlConfigured()) {
    memAttempts.set(attempt.id, attempt);
    return attempt;
  }

  await getPool().query(
    `INSERT INTO exam_attempts
      (id, case_id, nik, participant_name, package_code, attempt_number, status, score, max_score, passing_score, results_json, started_at, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', 0, 100, ?, '[]', ?, '')`,
    [
      attempt.id,
      attempt.caseId,
      attempt.nik,
      attempt.participantName,
      attempt.packageCode,
      attempt.attemptNumber,
      attempt.passingScore,
      attempt.startedAt,
    ]
  );

  return attempt;
}

async function dispatchResultWebhook(attempt: ExamAttempt): Promise<void> {
  try {
    const settings = await getAppSettings();
    if (!settings.webhookCallbackUrl) return;
    const body = JSON.stringify({
      event: 'EXAM_COMPLETED',
      nik: attempt.nik,
      participant_name: attempt.participantName,
      package_code: attempt.packageCode,
      case_code: attempt.caseCode,
      case_title: attempt.caseTitle,
      attempt_number: attempt.attemptNumber,
      score: attempt.score,
      max_score: attempt.maxScore,
      passing_score: attempt.passingScore,
      passed: attempt.status === 'PASSED',
      status: attempt.status,
      submitted_at: attempt.submittedAt,
    });
    const sig = crypto.createHmac('sha256', getIntegrationApiKey()).update(body).digest('hex');
    await fetch(settings.webhookCallbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KelasBrevet-Signature': sig,
      },
      body,
      signal: AbortSignal.timeout(6000),
    });
  } catch (err) {
    console.warn('Outbound exam callback webhook skipped/failed:', err);
  }
}

export async function submitAndGradeExam(nik: string, caseId: string): Promise<ExamAttempt> {
  await ensureBootstrapData();
  const examCase = await getExamCaseById(caseId);
  if (!examCase) {
    throw new Error('Kasus ujian tidak ditemukan.');
  }
  const snapshot = await getSnapshotByNik(nik);
  if (!snapshot) {
    throw new Error('Data workspace peserta tidak ditemukan.');
  }

  // Ensure an IN_PROGRESS attempt exists (or create one if participant submitted directly)
  const existing = (await listAttemptsByNik(nik)).filter((a) => a.caseId === caseId);
  let target = existing.find((a) => a.status === 'IN_PROGRESS');
  if (!target) {
    target = await startExamAttempt(nik, caseId);
  }

  const graded = gradeExamAttempt(snapshot, examCase);
  const submittedAt = new Date().toISOString();
  const finalStatus = graded.passed ? 'PASSED' : 'FAILED';

  let certificateNumber = target.certificateNumber || '';
  let certificateIssuedAt = target.certificateIssuedAt || '';

  if (finalStatus === 'PASSED') {
    const settings = await getAppSettings();
    if (settings.certificate.autoIssueEnabled && !certificateNumber) {
      const year = new Date().getFullYear();
      const prefix = settings.certificate.numberPrefix || 'CERT-KB';
      let seq = 1;
      if (!isMysqlConfigured()) {
        seq =
          Array.from(memAttempts.values()).filter((a) => Boolean(a.certificateNumber)).length + 1;
      } else {
        const [cntRows] = await getPool().query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM exam_attempts WHERE certificate_number <> ''`
        );
        seq = Number(cntRows[0]?.cnt || 0) + 1;
      }
      certificateNumber = `${prefix}/${year}/${String(seq).padStart(4, '0')}`;
      certificateIssuedAt = submittedAt;
    }
  }

  const completed: ExamAttempt = {
    ...target,
    caseCode: examCase.code,
    caseTitle: examCase.title,
    status: finalStatus,
    score: graded.score,
    maxScore: graded.maxScore,
    passingScore: examCase.passingScore,
    results: graded.results,
    certificateNumber,
    certificateIssuedAt,
    submittedAt,
  };

  if (!isMysqlConfigured()) {
    memAttempts.set(completed.id, completed);
  } else {
    await getPool().query(
      `UPDATE exam_attempts
       SET status = ?, score = ?, max_score = ?, passing_score = ?, results_json = ?,
           certificate_number = ?, certificate_issued_at = ?, submitted_at = ?
       WHERE id = ?`,
      [
        completed.status,
        completed.score,
        completed.maxScore,
        completed.passingScore,
        JSON.stringify(completed.results),
        completed.certificateNumber || '',
        completed.certificateIssuedAt || '',
        completed.submittedAt,
        completed.id,
      ]
    );
  }

  // Fire-and-forget outbound webhook callback to kelasbrevet.com if configured
  void dispatchResultWebhook(completed);

  return completed;
}
