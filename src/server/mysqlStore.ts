import fs from 'fs';
import path from 'path';
import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { createSeedSnapshot } from '../lib/seedData.ts';
import {
  BillingCode,
  EBupotSlip,
  EFakturInvoice,
  LedgerEntry,
  SimulatorSnapshot,
  TaxReturn,
  TaxWorkspace,
} from '../types/tax.ts';

let pool: Pool | null = null;
let schemaInitialized = false;

// Fallback in-memory store strictly for environments where MYSQL_HOST is not configured
const memoryWorkspaces = new Map<string, SimulatorSnapshot>();

export function isMysqlConfigured(): boolean {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (!isMysqlConfigured() || schemaInitialized) return;
  const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await getPool().query(sql);
  }
  schemaInitialized = true;
}

function parseJson<T>(raw: unknown): T {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as T;
  }
  return raw as T;
}

async function insertSeedIntoMysql(conn: PoolConnection, seed: SimulatorSnapshot): Promise<void> {
  const ws = seed.workspace;
  await conn.query(
    `INSERT INTO workspaces (id, nik, owner_id, op_profile, badan_profile, active_role, guided_mode, active_case_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ws.id,
      ws.nik,
      ws.ownerId,
      JSON.stringify(ws.opProfile),
      JSON.stringify(ws.badanProfile),
      ws.activeRole,
      ws.guidedMode ? 1 : 0,
      ws.activeCaseId,
    ]
  );

  for (const inv of seed.efaktur) {
    await conn.query(
      `INSERT INTO efaktur_invoices (
        id, workspace_id, owner_id, category, transaction_code, invoice_number, invoice_date,
        masa_pajak, tahun_pajak, counterparty_npwp, counterparty_name, status, credit_status,
        dpp_total, dpp_nilai_lain, ppn_total, ppnbm_total, items_json, reference_doc, sp2d_number,
        amendment_of, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id,
        inv.workspaceId,
        inv.ownerId,
        inv.category,
        inv.transactionCode,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.masaPajak,
        inv.tahunPajak,
        inv.counterpartyNpwp,
        inv.counterpartyName,
        inv.status,
        inv.creditStatus,
        inv.dppTotal,
        inv.dppNilaiLain,
        inv.ppnTotal,
        inv.ppnbmTotal,
        JSON.stringify(inv.items),
        inv.referenceDoc,
        inv.sp2dNumber,
        inv.amendmentOf,
        inv.createdAtIso,
      ]
    );
  }

  for (const sl of seed.ebupot) {
    await conn.query(
      `INSERT INTO ebupot_slips (
        id, workspace_id, owner_id, slip_type, slip_number, masa_pajak, tahun_pajak,
        recipient_nik, recipient_name, ptkp_status, ter_category, object_code, object_name,
        gross_amount, tax_rate, pph_amount, reference_doc, status, issuer_npwp, issuer_name,
        created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sl.id,
        sl.workspaceId,
        sl.ownerId,
        sl.slipType,
        sl.slipNumber,
        sl.masaPajak,
        sl.tahunPajak,
        sl.recipientNik,
        sl.recipientName,
        sl.ptkpStatus,
        sl.terCategory,
        sl.objectCode,
        sl.objectName,
        sl.grossAmount,
        sl.taxRate,
        sl.pphAmount,
        sl.referenceDoc,
        sl.status,
        sl.issuerNpwp,
        sl.issuerName,
        sl.createdAtIso,
      ]
    );
  }

  for (const le of seed.ledger) {
    await conn.query(
      `INSERT INTO ledger_entries (
        id, workspace_id, owner_id, taxpayer_role, entry_date, entry_type,
        reference_number, description, debit, credit, balance_after, created_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        le.id,
        le.workspaceId,
        le.ownerId,
        le.taxpayerRole,
        le.entryDate,
        le.entryType,
        le.referenceNumber,
        le.description,
        le.debit,
        le.credit,
        le.balanceAfter,
        le.createdAtIso,
      ]
    );
  }
}

export async function getSnapshotByNik(nik: string): Promise<SimulatorSnapshot | null> {
  if (!isMysqlConfigured()) {
    return memoryWorkspaces.get(nik) || null;
  }

  await ensureSchema();
  const db = getPool();
  const [wsRows] = await db.query<RowDataPacket[]>('SELECT * FROM workspaces WHERE nik = ? LIMIT 1', [nik]);
  if (wsRows.length === 0) return null;

  const w = wsRows[0];
  const workspace: TaxWorkspace = {
    id: w.id,
    ownerId: w.owner_id,
    nik: w.nik,
    opProfile: parseJson(w.op_profile),
    badanProfile: parseJson(w.badan_profile),
    activeRole: w.active_role,
    guidedMode: Boolean(w.guided_mode),
    activeCaseId: w.active_case_id,
  };

  const [efRows] = await db.query<RowDataPacket[]>(
    'SELECT * FROM efaktur_invoices WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspace.id]
  );
  const [ebRows] = await db.query<RowDataPacket[]>(
    'SELECT * FROM ebupot_slips WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspace.id]
  );
  const [trRows] = await db.query<RowDataPacket[]>(
    'SELECT * FROM tax_returns WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspace.id]
  );
  const [biRows] = await db.query<RowDataPacket[]>(
    'SELECT * FROM billing_codes WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspace.id]
  );
  const [leRows] = await db.query<RowDataPacket[]>(
    'SELECT * FROM ledger_entries WHERE workspace_id = ? ORDER BY created_at DESC',
    [workspace.id]
  );

  const efaktur: EFakturInvoice[] = efRows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    workspaceId: r.workspace_id,
    category: r.category,
    transactionCode: r.transaction_code,
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    masaPajak: Number(r.masa_pajak),
    tahunPajak: Number(r.tahun_pajak),
    counterpartyNpwp: r.counterparty_npwp,
    counterpartyName: r.counterparty_name,
    status: r.status,
    creditStatus: r.credit_status,
    dppTotal: Number(r.dpp_total),
    dppNilaiLain: Number(r.dpp_nilai_lain),
    ppnTotal: Number(r.ppn_total),
    ppnbmTotal: Number(r.ppnbm_total),
    items: parseJson(r.items_json),
    referenceDoc: r.reference_doc,
    sp2dNumber: r.sp2d_number,
    amendmentOf: r.amendment_of,
    createdAtIso: r.created_at_iso,
  }));

  const ebupot: EBupotSlip[] = ebRows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    workspaceId: r.workspace_id,
    slipType: r.slip_type,
    slipNumber: r.slip_number,
    masaPajak: Number(r.masa_pajak),
    tahunPajak: Number(r.tahun_pajak),
    recipientNik: r.recipient_nik,
    recipientName: r.recipient_name,
    ptkpStatus: r.ptkp_status,
    terCategory: r.ter_category,
    objectCode: r.object_code,
    objectName: r.object_name,
    grossAmount: Number(r.gross_amount),
    taxRate: Number(r.tax_rate),
    pphAmount: Number(r.pph_amount),
    referenceDoc: r.reference_doc,
    status: r.status,
    issuerNpwp: r.issuer_npwp,
    issuerName: r.issuer_name,
    createdAtIso: r.created_at_iso,
  }));

  const taxReturns: TaxReturn[] = trRows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    workspaceId: r.workspace_id,
    taxpayerRole: r.taxpayer_role,
    returnType: r.return_type,
    masaPajak: Number(r.masa_pajak),
    tahunPajak: Number(r.tahun_pajak),
    pembetulanKe: Number(r.pembetulan_ke),
    status: r.status,
    taxPosition: r.tax_position,
    amountDue: Number(r.amount_due),
    bpeNumber: r.bpe_number,
    billingCode: r.billing_code,
    submittedAt: r.submitted_at,
    payload: parseJson(r.payload_json),
    createdAtIso: r.created_at_iso,
  }));

  const billing: BillingCode[] = biRows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    workspaceId: r.workspace_id,
    taxpayerRole: r.taxpayer_role,
    billingNumber: r.billing_number,
    kapKjs: r.kap_kjs,
    description: r.description,
    masaPajak: Number(r.masa_pajak),
    tahunPajak: Number(r.tahun_pajak),
    amount: Number(r.amount),
    status: r.status,
    ntpn: r.ntpn,
    relatedReturnId: r.related_return_id,
    paidAt: r.paid_at,
    createdAtIso: r.created_at_iso,
  }));

  const ledger: LedgerEntry[] = leRows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    workspaceId: r.workspace_id,
    taxpayerRole: r.taxpayer_role,
    entryDate: r.entry_date,
    entryType: r.entry_type,
    referenceNumber: r.reference_number,
    description: r.description,
    debit: Number(r.debit),
    credit: Number(r.credit),
    balanceAfter: Number(r.balance_after),
    createdAtIso: r.created_at_iso,
  }));

  return { workspace, efaktur, ebupot, taxReturns, billing, ledger };
}

export async function loginOrCreateNik(nik: string, customName?: string): Promise<SimulatorSnapshot> {
  const existing = await getSnapshotByNik(nik);
  if (existing) return existing;

  const seed = createSeedSnapshot(nik, 'mysql_user', customName);
  if (!isMysqlConfigured()) {
    memoryWorkspaces.set(nik, seed);
    return seed;
  }

  await ensureSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await insertSeedIntoMysql(conn, seed);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return (await getSnapshotByNik(nik)) || seed;
}

export async function updateWorkspace(nik: string, patch: Partial<TaxWorkspace>): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (cur) {
      cur.workspace = { ...cur.workspace, ...patch };
    }
    return;
  }

  await ensureSchema();
  const cur = await getSnapshotByNik(nik);
  if (!cur) return;
  const next = { ...cur.workspace, ...patch };

  await getPool().query(
    `UPDATE workspaces
     SET op_profile = ?, badan_profile = ?, active_role = ?, guided_mode = ?, active_case_id = ?
     WHERE nik = ?`,
    [
      JSON.stringify(next.opProfile),
      JSON.stringify(next.badanProfile),
      next.activeRole,
      next.guidedMode ? 1 : 0,
      next.activeCaseId,
      nik,
    ]
  );
}

export async function resetWorkspace(nik: string): Promise<SimulatorSnapshot> {
  const cur = await getSnapshotByNik(nik);
  const seed = createSeedSnapshot(nik, 'mysql_user', cur?.workspace.opProfile.nama);

  if (!isMysqlConfigured()) {
    memoryWorkspaces.set(nik, seed);
    return seed;
  }

  await ensureSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM workspaces WHERE nik = ?', [nik]);
    await insertSeedIntoMysql(conn, seed);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return (await getSnapshotByNik(nik)) || seed;
}

export async function upsertEFaktur(nik: string, inv: EFakturInvoice): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (!cur) return;
    const exists = cur.efaktur.some((x) => x.id === inv.id);
    cur.efaktur = exists ? cur.efaktur.map((x) => (x.id === inv.id ? inv : x)) : [inv, ...cur.efaktur];
    return;
  }

  await ensureSchema();
  await getPool().query(
    `INSERT INTO efaktur_invoices (
      id, workspace_id, owner_id, category, transaction_code, invoice_number, invoice_date,
      masa_pajak, tahun_pajak, counterparty_npwp, counterparty_name, status, credit_status,
      dpp_total, dpp_nilai_lain, ppn_total, ppnbm_total, items_json, reference_doc, sp2d_number,
      amendment_of, created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      invoice_number = VALUES(invoice_number),
      status = VALUES(status),
      credit_status = VALUES(credit_status),
      sp2d_number = VALUES(sp2d_number),
      dpp_total = VALUES(dpp_total),
      dpp_nilai_lain = VALUES(dpp_nilai_lain),
      ppn_total = VALUES(ppn_total),
      items_json = VALUES(items_json)`,
    [
      inv.id,
      inv.workspaceId,
      inv.ownerId,
      inv.category,
      inv.transactionCode,
      inv.invoiceNumber,
      inv.invoiceDate,
      inv.masaPajak,
      inv.tahunPajak,
      inv.counterpartyNpwp,
      inv.counterpartyName,
      inv.status,
      inv.creditStatus,
      inv.dppTotal,
      inv.dppNilaiLain,
      inv.ppnTotal,
      inv.ppnbmTotal,
      JSON.stringify(inv.items),
      inv.referenceDoc,
      inv.sp2dNumber,
      inv.amendmentOf,
      inv.createdAtIso,
    ]
  );
}

export async function deleteEFakturById(nik: string, id: string): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (cur) cur.efaktur = cur.efaktur.filter((x) => x.id !== id);
    return;
  }
  await ensureSchema();
  await getPool().query('DELETE FROM efaktur_invoices WHERE id = ? AND workspace_id = ?', [id, `ws_${nik}`]);
}

export async function upsertEBupotBatch(nik: string, slips: EBupotSlip[]): Promise<void> {
  if (slips.length === 0) return;
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (!cur) return;
    for (const sl of slips) {
      const exists = cur.ebupot.some((x) => x.id === sl.id);
      cur.ebupot = exists ? cur.ebupot.map((x) => (x.id === sl.id ? sl : x)) : [sl, ...cur.ebupot];
    }
    return;
  }

  await ensureSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const sl of slips) {
      await conn.query(
        `INSERT INTO ebupot_slips (
          id, workspace_id, owner_id, slip_type, slip_number, masa_pajak, tahun_pajak,
          recipient_nik, recipient_name, ptkp_status, ter_category, object_code, object_name,
          gross_amount, tax_rate, pph_amount, reference_doc, status, issuer_npwp, issuer_name,
          created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          slip_number = VALUES(slip_number),
          status = VALUES(status),
          gross_amount = VALUES(gross_amount),
          tax_rate = VALUES(tax_rate),
          pph_amount = VALUES(pph_amount)`,
        [
          sl.id,
          sl.workspaceId,
          sl.ownerId,
          sl.slipType,
          sl.slipNumber,
          sl.masaPajak,
          sl.tahunPajak,
          sl.recipientNik,
          sl.recipientName,
          sl.ptkpStatus,
          sl.terCategory,
          sl.objectCode,
          sl.objectName,
          sl.grossAmount,
          sl.taxRate,
          sl.pphAmount,
          sl.referenceDoc,
          sl.status,
          sl.issuerNpwp,
          sl.issuerName,
          sl.createdAtIso,
        ]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function deleteEBupotById(nik: string, id: string): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (cur) cur.ebupot = cur.ebupot.filter((x) => x.id !== id);
    return;
  }
  await ensureSchema();
  await getPool().query('DELETE FROM ebupot_slips WHERE id = ? AND workspace_id = ?', [id, `ws_${nik}`]);
}

export async function upsertTaxReturn(nik: string, tr: TaxReturn): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (!cur) return;
    const exists = cur.taxReturns.some((x) => x.id === tr.id);
    cur.taxReturns = exists ? cur.taxReturns.map((x) => (x.id === tr.id ? tr : x)) : [tr, ...cur.taxReturns];
    return;
  }

  await ensureSchema();
  await getPool().query(
    `INSERT INTO tax_returns (
      id, workspace_id, owner_id, taxpayer_role, return_type, masa_pajak, tahun_pajak,
      pembetulan_ke, status, tax_position, amount_due, bpe_number, billing_code,
      submitted_at, payload_json, created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      tax_position = VALUES(tax_position),
      amount_due = VALUES(amount_due),
      bpe_number = VALUES(bpe_number),
      billing_code = VALUES(billing_code),
      submitted_at = VALUES(submitted_at),
      payload_json = VALUES(payload_json)`,
    [
      tr.id,
      tr.workspaceId,
      tr.ownerId,
      tr.taxpayerRole,
      tr.returnType,
      tr.masaPajak,
      tr.tahunPajak,
      tr.pembetulanKe,
      tr.status,
      tr.taxPosition,
      tr.amountDue,
      tr.bpeNumber,
      tr.billingCode,
      tr.submittedAt,
      JSON.stringify(tr.payload),
      tr.createdAtIso,
    ]
  );
}

export async function deleteTaxReturnById(nik: string, id: string): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (cur) cur.taxReturns = cur.taxReturns.filter((x) => x.id !== id);
    return;
  }
  await ensureSchema();
  await getPool().query('DELETE FROM tax_returns WHERE id = ? AND workspace_id = ?', [id, `ws_${nik}`]);
}

export async function upsertBilling(nik: string, bill: BillingCode): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (!cur) return;
    const exists = cur.billing.some((x) => x.id === bill.id);
    cur.billing = exists ? cur.billing.map((x) => (x.id === bill.id ? bill : x)) : [bill, ...cur.billing];
    return;
  }

  await ensureSchema();
  await getPool().query(
    `INSERT INTO billing_codes (
      id, workspace_id, owner_id, taxpayer_role, billing_number, kap_kjs, description,
      masa_pajak, tahun_pajak, amount, status, ntpn, related_return_id, paid_at, created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      ntpn = VALUES(ntpn),
      paid_at = VALUES(paid_at)`,
    [
      bill.id,
      bill.workspaceId,
      bill.ownerId,
      bill.taxpayerRole,
      bill.billingNumber,
      bill.kapKjs,
      bill.description,
      bill.masaPajak,
      bill.tahunPajak,
      bill.amount,
      bill.status,
      bill.ntpn,
      bill.relatedReturnId,
      bill.paidAt,
      bill.createdAtIso,
    ]
  );
}

export async function insertLedgerEntry(nik: string, entry: LedgerEntry): Promise<void> {
  if (!isMysqlConfigured()) {
    const cur = memoryWorkspaces.get(nik);
    if (cur) cur.ledger = [entry, ...cur.ledger];
    return;
  }

  await ensureSchema();
  await getPool().query(
    `INSERT INTO ledger_entries (
      id, workspace_id, owner_id, taxpayer_role, entry_date, entry_type,
      reference_number, description, debit, credit, balance_after, created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.workspaceId,
      entry.ownerId,
      entry.taxpayerRole,
      entry.entryDate,
      entry.entryType,
      entry.referenceNumber,
      entry.description,
      entry.debit,
      entry.credit,
      entry.balanceAfter,
      entry.createdAtIso,
    ]
  );
}
