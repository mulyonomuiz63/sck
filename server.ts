import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  deleteExamCase,
  deleteParticipant,
  getAdminCredentials,
  getAppSettings,
  getParticipantByNik,
  isCaseAccessibleByPackage,
  listAllAttempts,
  listAttemptsByNik,
  listExamCases,
  listParticipants,
  signToken,
  startExamAttempt,
  submitAndGradeExam,
  updateAppSettings,
  updateParticipantStatus,
  upsertExamCase,
  upsertParticipant,
  upsertParticipantsBatch,
  validateParticipantAccess,
  verifyIntegrationApiKey,
  verifyToken,
} from './src/server/enrollmentStore.ts';
import {
  deleteEBupotById,
  deleteEFakturById,
  deleteTaxReturnById,
  getSnapshotByNik,
  initDatabaseOrFallback,
  insertLedgerEntry,
  loginOrCreateNik,
  resetWorkspace,
  updateWorkspace,
  upsertBilling,
  upsertEBupotBatch,
  upsertEFaktur,
  upsertTaxReturn,
} from './src/server/mysqlStore.ts';
import {
  BillingCode,
  EBupotSlip,
  EFakturInvoice,
  EnrolledParticipant,
  ExamCase,
  LedgerEntry,
  ParticipantStatus,
  TaxReturn,
  TaxWorkspace,
} from './src/types/tax.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.role !== 'ADMIN') {
    return res.status(401).json({ error: 'Sesi Admin tidak valid atau telah berakhir. Silakan login ulang.' });
  }
  return next();
}

function requireIntegrationKey(req: Request, res: Response, next: NextFunction) {
  const headerKey = String(req.headers['x-api-key'] || '');
  if (!verifyIntegrationApiKey(headerKey)) {
    return res.status(401).json({ error: 'API Key integrasi (X-API-KEY) tidak valid.' });
  }
  return next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '5mb' }));

  // --- Health check ---
  app.get('/api/health', (_req, res) => {
    return res.json({ ok: true });
  });

  // ============================================================================
  // Participant Auth (Whitelist Gate + SSO 1-Klik dari kelasbrevet.com)
  // ============================================================================
  app.post('/api/auth/nik', async (req, res) => {
    try {
      const nik = String(req.body?.nik || '').replace(/\D/g, '');
      const customName = req.body?.customName ? String(req.body.customName) : undefined;
      if (nik.length !== 16) {
        return res.status(400).json({ error: 'NIK harus terdiri dari 16 digit angka.' });
      }
      const access = await validateParticipantAccess(nik);
      if (!access.allowed) {
        return res.status(403).json({
          error: access.reason || 'NIK tidak memiliki akses aktif.',
          code: 'NOT_ENROLLED',
        });
      }
      const resolvedName = customName?.trim() || access.participant?.fullName || undefined;
      const snapshot = await loginOrCreateNik(nik, resolvedName);
      return res.json({ ...snapshot, enrollment: access.participant });
    } catch (error) {
      console.error('POST /api/auth/nik error:', error);
      return res.status(500).json({ error: 'Gagal memuat akun NIK dari database.' });
    }
  });

  app.post('/api/auth/sso', async (req, res) => {
    try {
      const token = String(req.body?.token || '').trim();
      const payload = verifyToken(token);
      if (!payload || payload.role !== 'SSO_PARTICIPANT' || typeof payload.nik !== 'string') {
        return res.status(401).json({ error: 'Tautan SSO tidak valid atau sudah kedaluwarsa. Silakan buka ulang dari kelasbrevet.com.' });
      }
      const nik = payload.nik.replace(/\D/g, '');
      const access = await validateParticipantAccess(nik);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || 'Akses paket tidak aktif.' });
      }
      const snapshot = await loginOrCreateNik(nik, access.participant?.fullName || undefined);
      return res.json({ ...snapshot, enrollment: access.participant });
    } catch (error) {
      console.error('POST /api/auth/sso error:', error);
      return res.status(500).json({ error: 'Gagal memverifikasi SSO peserta.' });
    }
  });

  // ============================================================================
  // Workspace & Tax Simulation CRUD (MySQL)
  // ============================================================================
  app.get('/api/workspace/:nik', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) return res.status(400).json({ error: 'NIK tidak valid.' });
      const access = await validateParticipantAccess(nik);
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason || 'Akses tidak aktif.', code: 'NOT_ENROLLED' });
      }
      const snapshot = await getSnapshotByNik(nik);
      if (!snapshot) return res.status(404).json({ error: 'Workspace tidak ditemukan.' });
      return res.json({ ...snapshot, enrollment: access.participant });
    } catch (error) {
      console.error('GET /api/workspace error:', error);
      return res.status(500).json({ error: 'Gagal mengambil data workspace.' });
    }
  });

  app.patch('/api/workspace/:nik', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await updateWorkspace(nik, req.body as Partial<TaxWorkspace>);
      return res.json({ ok: true });
    } catch (error) {
      console.error('PATCH /api/workspace error:', error);
      return res.status(500).json({ error: 'Gagal menyimpan pembaruan profil.' });
    }
  });

  app.post('/api/workspace/:nik/reset', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      const fresh = await resetWorkspace(nik);
      const enrollment = await getParticipantByNik(nik);
      return res.json({ ...fresh, enrollment });
    } catch (error) {
      console.error('POST /api/workspace/reset error:', error);
      return res.status(500).json({ error: 'Gagal mereset data simulasi.' });
    }
  });

  app.put('/api/workspace/:nik/efaktur', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await upsertEFaktur(nik, req.body as EFakturInvoice);
      return res.json({ ok: true });
    } catch (error) {
      console.error('PUT /api/workspace/efaktur error:', error);
      return res.status(500).json({ error: 'Gagal menyimpan data e-Faktur.' });
    }
  });

  app.delete('/api/workspace/:nik/efaktur/:id', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await deleteEFakturById(nik, req.params.id);
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/workspace/efaktur error:', error);
      return res.status(500).json({ error: 'Gagal menghapus e-Faktur.' });
    }
  });

  app.put('/api/workspace/:nik/ebupot', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      const slips: EBupotSlip[] = Array.isArray(req.body?.slips) ? req.body.slips : [req.body];
      await upsertEBupotBatch(nik, slips);
      return res.json({ ok: true });
    } catch (error) {
      console.error('PUT /api/workspace/ebupot error:', error);
      return res.status(500).json({ error: 'Gagal menyimpan data e-Bupot.' });
    }
  });

  app.delete('/api/workspace/:nik/ebupot/:id', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await deleteEBupotById(nik, req.params.id);
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/workspace/ebupot error:', error);
      return res.status(500).json({ error: 'Gagal menghapus e-Bupot.' });
    }
  });

  app.put('/api/workspace/:nik/tax-returns', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await upsertTaxReturn(nik, req.body as TaxReturn);
      return res.json({ ok: true });
    } catch (error) {
      console.error('PUT /api/workspace/tax-returns error:', error);
      return res.status(500).json({ error: 'Gagal menyimpan data SPT.' });
    }
  });

  app.delete('/api/workspace/:nik/tax-returns/:id', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await deleteTaxReturnById(nik, req.params.id);
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/workspace/tax-returns error:', error);
      return res.status(500).json({ error: 'Gagal menghapus SPT.' });
    }
  });

  app.put('/api/workspace/:nik/billing', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await upsertBilling(nik, req.body as BillingCode);
      return res.json({ ok: true });
    } catch (error) {
      console.error('PUT /api/workspace/billing error:', error);
      return res.status(500).json({ error: 'Gagal menyimpan Kode Billing.' });
    }
  });

  app.post('/api/workspace/:nik/ledger', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await insertLedgerEntry(nik, req.body as LedgerEntry);
      return res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/workspace/ledger error:', error);
      return res.status(500).json({ error: 'Gagal mencatat Buku Besar.' });
    }
  });

  // ============================================================================
  // Participant Exam & Automated Grading Routes
  // ============================================================================
  app.get('/api/exams/participant/:nik', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) return res.status(400).json({ error: 'NIK tidak valid.' });
      const [enrollment, allActiveCases, attempts, settings] = await Promise.all([
        getParticipantByNik(nik),
        listExamCases(true),
        listAttemptsByNik(nik),
        getAppSettings(),
      ]);
      const cases = allActiveCases.filter((c) => isCaseAccessibleByPackage(c, enrollment?.packageCode));
      return res.json({ cases, attempts, enrollment, certificateConfig: settings.certificate });
    } catch (error) {
      console.error('GET /api/exams/participant error:', error);
      return res.status(500).json({ error: 'Gagal memuat daftar ujian praktik.' });
    }
  });

  app.post('/api/exams/participant/:nik/start', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      const caseId = String(req.body?.caseId || '').trim();
      const shouldReset = Boolean(req.body?.resetWorkspace);
      if (nik.length !== 16 || !caseId) {
        return res.status(400).json({ error: 'NIK dan ID Kasus wajib diisi.' });
      }
      let snapshot = await getSnapshotByNik(nik);
      if (shouldReset || !snapshot) {
        snapshot = await resetWorkspace(nik);
      }
      const attempt = await startExamAttempt(nik, caseId);
      const enrollment = await getParticipantByNik(nik);
      return res.json({ attempt, snapshot: { ...snapshot, enrollment } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal memulai ujian.';
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/api/exams/participant/:nik/submit', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      const caseId = String(req.body?.caseId || '').trim();
      if (nik.length !== 16 || !caseId) {
        return res.status(400).json({ error: 'NIK dan ID Kasus wajib diisi.' });
      }
      const attempt = await submitAndGradeExam(nik, caseId);
      return res.json({ attempt });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menilai hasil ujian.';
      return res.status(400).json({ error: msg });
    }
  });

  // ============================================================================
  // kelasbrevet.com Webhook & SSO Integration API (Protected by X-API-KEY)
  // ============================================================================
  app.post('/api/integration/enroll', requireIntegrationKey, async (req, res) => {
    try {
      const b = req.body || {};
      const nik = String(b.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) {
        return res.status(400).json({ error: 'Field nik harus berisi 16 digit angka.' });
      }
      const saved = await upsertParticipant({
        nik,
        fullName: String(b.full_name || b.fullName || b.nama || `PESERTA ${nik.slice(-4)}`),
        email: String(b.email || ''),
        phone: String(b.phone || b.no_hp || ''),
        packageCode: String(b.package_code || b.packageCode || b.paket || 'BREVET_AB'),
        orderId: String(b.order_id || b.orderId || ''),
        status: 'ACTIVE',
        expiresAt: String(b.expires_at || b.expiresAt || ''),
        source: 'WEBHOOK_KELASBREVET',
      });
      return res.json({ ok: true, participant: saved });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal mendaftarkan peserta.';
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/api/integration/revoke', requireIntegrationKey, async (req, res) => {
    try {
      const nik = String(req.body?.nik || '').replace(/\D/g, '');
      const status: ParticipantStatus = req.body?.status === 'EXPIRED' ? 'EXPIRED' : 'SUSPENDED';
      if (nik.length !== 16) {
        return res.status(400).json({ error: 'Field nik harus 16 digit angka.' });
      }
      await updateParticipantStatus(nik, status);
      return res.json({ ok: true, nik, status });
    } catch (error) {
      console.error('POST /api/integration/revoke error:', error);
      return res.status(500).json({ error: 'Gagal menonaktifkan peserta.' });
    }
  });

  app.post('/api/integration/sso-token', requireIntegrationKey, async (req, res) => {
    try {
      const b = req.body || {};
      const nik = String(b.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) {
        return res.status(400).json({ error: 'Field nik harus 16 digit angka.' });
      }
      // Auto-enroll / ensure active if package metadata is supplied
      const existing = await getParticipantByNik(nik);
      if (!existing) {
        await upsertParticipant({
          nik,
          fullName: String(b.full_name || b.fullName || `PESERTA ${nik.slice(-4)}`),
          email: String(b.email || ''),
          phone: String(b.phone || ''),
          packageCode: String(b.package_code || b.packageCode || 'BREVET_AB'),
          orderId: String(b.order_id || b.orderId || ''),
          status: 'ACTIVE',
          expiresAt: String(b.expires_at || b.expiresAt || ''),
          source: 'SSO_KELASBREVET',
        });
      }
      const token = signToken({ role: 'SSO_PARTICIPANT', nik }, 600); // 10 minutes
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return res.json({ ok: true, token, loginUrl: `${baseUrl}/?sso=${encodeURIComponent(token)}` });
    } catch (error) {
      console.error('POST /api/integration/sso-token error:', error);
      return res.status(500).json({ error: 'Gagal membuat token SSO.' });
    }
  });

  app.get('/api/integration/results/:nik', requireIntegrationKey, async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) return res.status(400).json({ error: 'NIK tidak valid.' });
      const participant = await getParticipantByNik(nik);
      const attempts = await listAttemptsByNik(nik);
      const passedCases = Array.from(new Set(attempts.filter((a) => a.status === 'PASSED').map((a) => a.caseCode || a.caseId)));
      return res.json({
        ok: true,
        participant,
        passedCount: passedCases.length,
        passedCases,
        attempts,
      });
    } catch (error) {
      console.error('GET /api/integration/results error:', error);
      return res.status(500).json({ error: 'Gagal mengambil hasil ujian peserta.' });
    }
  });

  // ============================================================================
  // Admin Portal API (Protected by Bearer HMAC Admin Token)
  // ============================================================================
  app.post('/api/admin/login', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const creds = getAdminCredentials();
    if (username !== creds.username || password !== creds.password) {
      return res.status(401).json({ error: 'Username atau password admin salah.' });
    }
    const token = signToken({ role: 'ADMIN', username }, 60 * 60 * 12); // 12 hours
    return res.json({ ok: true, token, username });
  });

  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const [settings, participants, examCases, attempts] = await Promise.all([
        getAppSettings(),
        listParticipants(),
        listExamCases(false),
        listAllAttempts(),
      ]);
      return res.json({ settings, participants, examCases, attempts });
    } catch (error) {
      console.error('GET /api/admin/overview error:', error);
      return res.status(500).json({ error: 'Gagal memuat dashboard admin.' });
    }
  });

  app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
      const updated = await updateAppSettings({
        whitelistEnforced:
          typeof req.body?.whitelistEnforced === 'boolean' ? req.body.whitelistEnforced : undefined,
        webhookCallbackUrl:
          typeof req.body?.webhookCallbackUrl === 'string' ? req.body.webhookCallbackUrl : undefined,
        certificate:
          req.body?.certificate && typeof req.body.certificate === 'object'
            ? req.body.certificate
            : undefined,
      });
      return res.json({ ok: true, settings: updated });
    } catch (error) {
      console.error('PATCH /api/admin/settings error:', error);
      return res.status(500).json({ error: 'Gagal menyimpan pengaturan.' });
    }
  });

  app.post('/api/admin/simulate-purchase', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const nik = String(b.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) {
        return res.status(400).json({ error: 'NIK uji coba harus terdiri dari 16 digit angka.' });
      }
      const saved = await upsertParticipant({
        nik,
        fullName: String(b.fullName || 'PESERTA SIMULASI PEMBELIAN').trim(),
        email: String(b.email || 'peserta@kelasbrevet.com').trim(),
        phone: String(b.phone || '081200000000').trim(),
        packageCode: String(b.packageCode || 'BREVET_AB').trim().toUpperCase(),
        orderId: String(b.orderId || `INV-KB-${Date.now().toString().slice(-6)}`).trim(),
        status: 'ACTIVE',
        expiresAt: '',
        source: 'WEBHOOK_KELASBREVET',
      });
      const token = signToken({ role: 'SSO_PARTICIPANT', nik }, 600);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return res.json({
        ok: true,
        participant: saved,
        loginUrl: `${baseUrl}/?sso=${encodeURIComponent(token)}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menjalankan simulasi pembelian.';
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/api/admin/participants', requireAdmin, async (req, res) => {
    try {
      const saved = await upsertParticipant(req.body as EnrolledParticipant);
      return res.json({ ok: true, participant: saved });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menyimpan peserta.';
      return res.status(400).json({ error: msg });
    }
  });

  app.post('/api/admin/participants/import', requireAdmin, async (req, res) => {
    try {
      const items = Array.isArray(req.body?.participants) ? (req.body.participants as EnrolledParticipant[]) : [];
      const imported = await upsertParticipantsBatch(
        items.map((x) => ({ ...x, source: 'CSV_IMPORT', status: x.status || 'ACTIVE' }))
      );
      return res.json({ ok: true, imported });
    } catch (error) {
      console.error('POST /api/admin/participants/import error:', error);
      return res.status(500).json({ error: 'Gagal mengimpor data peserta.' });
    }
  });

  app.patch('/api/admin/participants/:nik/status', requireAdmin, async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      const status = req.body?.status as ParticipantStatus;
      if (!['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(status)) {
        return res.status(400).json({ error: 'Status peserta tidak valid.' });
      }
      await updateParticipantStatus(nik, status);
      return res.json({ ok: true });
    } catch (error) {
      console.error('PATCH /api/admin/participants/status error:', error);
      return res.status(500).json({ error: 'Gagal mengubah status peserta.' });
    }
  });

  app.delete('/api/admin/participants/:nik', requireAdmin, async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      await deleteParticipant(nik);
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/admin/participants error:', error);
      return res.status(500).json({ error: 'Gagal menghapus peserta.' });
    }
  });

  app.post('/api/admin/cases', requireAdmin, async (req, res) => {
    try {
      const saved = await upsertExamCase(req.body as ExamCase);
      return res.json({ ok: true, examCase: saved });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menyimpan soal ujian.';
      return res.status(400).json({ error: msg });
    }
  });

  app.delete('/api/admin/cases/:id', requireAdmin, async (req, res) => {
    try {
      await deleteExamCase(req.params.id);
      return res.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/admin/cases error:', error);
      return res.status(500).json({ error: 'Gagal menghapus kasus ujian.' });
    }
  });

  // Mount Vite middleware only in explicit development mode; serve built dist/ in production
  if (process.env.NODE_ENV === 'development') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  await initDatabaseOrFallback().catch((err) => {
    console.error('[MySQL Startup Error]', err);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KelasBrevet Coretax Simulator running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
