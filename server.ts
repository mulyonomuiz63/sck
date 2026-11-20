import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  deleteEBupotById,
  deleteEFakturById,
  deleteTaxReturnById,
  getSnapshotByNik,
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
  LedgerEntry,
  TaxReturn,
  TaxWorkspace,
} from './src/types/tax.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '5mb' }));

  // --- REST API Routes backed by MySQL ---
  app.post('/api/auth/nik', async (req, res) => {
    try {
      const nik = String(req.body?.nik || '').replace(/\D/g, '');
      const customName = req.body?.customName ? String(req.body.customName) : undefined;
      if (nik.length !== 16) {
        return res.status(400).json({ error: 'NIK harus terdiri dari 16 digit angka.' });
      }
      const snapshot = await loginOrCreateNik(nik, customName);
      return res.json(snapshot);
    } catch (error) {
      console.error('POST /api/auth/nik error:', error);
      return res.status(500).json({ error: 'Gagal memuat akun NIK dari database.' });
    }
  });

  app.get('/api/workspace/:nik', async (req, res) => {
    try {
      const nik = String(req.params.nik || '').replace(/\D/g, '');
      if (nik.length !== 16) return res.status(400).json({ error: 'NIK tidak valid.' });
      const snapshot = await getSnapshotByNik(nik);
      if (!snapshot) return res.status(404).json({ error: 'Workspace tidak ditemukan.' });
      return res.json(snapshot);
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
      return res.json(fresh);
    } catch (error) {
      console.error('POST /api/workspace/reset error:', error);
      return res.status(500).json({ error: 'Gagal mereset data simulasi.' });
    }
  });

  // e-Faktur
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

  // e-Bupot
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

  // Tax Returns (SPT)
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

  // Billing
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

  // Ledger
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

  // Mount Vite middleware in dev, or serve static dist/ in production
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KelasBrevet Coretax Simulator running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
