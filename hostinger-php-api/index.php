<?php
declare(strict_types=1);

/**
 * REST API MySQL (PHP 8 PDO) — Simulasi Coretax KelasBrevet
 * Drop-in replacement untuk server.ts pada Hostinger Shared Web Hosting (hPanel).
 *
 * Mendukung seluruh endpoint frontend (/api/auth/nik, /api/workspace/:nik,
 * efaktur, ebupot, tax-returns, billing, ledger, reset).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'File config.php belum dibuat. Salin config.example.php menjadi config.php dan isi kredensial MySQL Hostinger.',
    ]);
    exit;
}

$cfg = require $configPath;

try {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $cfg['host'] ?? '127.0.0.1',
        (int)($cfg['port'] ?? 3306),
        $cfg['database'] ?? '',
        $cfg['charset'] ?? 'utf8mb4'
    );
    $pdo = new PDO($dsn, $cfg['username'] ?? '', $cfg['password'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Koneksi ke database MySQL gagal.', 'detail' => $e->getMessage()]);
    exit;
}

function respond(mixed $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function cleanNik(string $raw): string
{
    return preg_replace('/\D/', '', $raw) ?? '';
}

function buildSeedSnapshot(string $nik, ?string $customName = null): array
{
    $cleanNik = substr(str_pad(cleanNik($nik), 16, '0'), 0, 16);
    $isTuanA = $cleanNik === '3273011205900001';
    $workspaceId = 'ws_' . $cleanNik;
    $nowIso = gmdate('Y-m-d\TH:i:s.000\Z');
    $trimmedName = trim((string)$customName);
    $opName = $trimmedName !== ''
        ? $trimmedName
        : ($isTuanA ? 'TUAN A (PESERTA BREVET)' : 'PESERTA BREVET ' . substr($cleanNik, -4));
    $badanNpwp = '03' . substr($cleanNik, 2, 10) . '0910';

    $workspace = [
        'id' => $workspaceId,
        'ownerId' => 'mysql_user',
        'nik' => $cleanNik,
        'opProfile' => [
            'nik' => $cleanNik,
            'npwp' => $cleanNik,
            'nama' => $opName,
            'alamat' => 'Jl. Pendidikan Perpajakan No. 45, Jakarta Selatan',
            'klu' => '96301 — Pegawai Swasta / Orang Pribadi',
            'ptkp' => 'TK/0',
            'pekerjaan' => 'Pegawai Tetap Swasta',
            'email' => 'peserta@kelasbrevet.simulasi',
            'passphrase' => 'kelasbrevet123',
            'depositBalance' => 15000000,
        ],
        'badanProfile' => [
            'npwp' => $badanNpwp,
            'nama' => 'PT SIMULASI KELASBREVET NUSANTARA',
            'alamat' => 'Gedung Edukasi Pajak Lt. 8, Kawasan Bisnis Sudirman, Jakarta',
            'klu' => '62019 — Jasa Konsultansi & Perdagangan Umum',
            'statusPkp' => 'AKTIF',
            'penanggungJawab' => $opName,
            'passphrase' => 'kelasbrevet123',
            'depositBalance' => 150000000,
        ],
        'activeRole' => 'OP',
        'guidedMode' => true,
        'activeCaseId' => 'case_pph21_tuan_a',
    ];

    $efaktur = [
        [
            'id' => 'inv_in1_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'category' => 'INPUT',
            'transactionCode' => '01',
            'invoiceNumber' => '010025812004511',
            'invoiceDate' => '2025-01-12',
            'masaPajak' => 1,
            'tahunPajak' => 2025,
            'counterpartyNpwp' => '0134567890123000',
            'counterpartyName' => 'PT SUMBER LOGISTIK PRIMA',
            'status' => 'APPROVED',
            'creditStatus' => 'UNCREDITED',
            'dppTotal' => 45000000,
            'dppNilaiLain' => 45000000,
            'ppnTotal' => 4950000,
            'ppnbmTotal' => 0,
            'items' => [[
                'id' => 'item_in_1',
                'itemType' => 'BARANG',
                'itemCode' => '010100',
                'name' => 'Perangkat Workstation & Server Kantor',
                'unit' => 'Unit',
                'unitPrice' => 15000000,
                'qty' => 3,
                'discount' => 0,
                'dpp' => 45000000,
                'useDppNilaiLain' => false,
                'dppNilaiLain' => 45000000,
                'ppn' => 4950000,
                'ppnbm' => 0,
            ]],
            'referenceDoc' => 'PO-KB-2025-001',
            'sp2dNumber' => '',
            'amendmentOf' => '',
            'createdAtIso' => $nowIso,
        ],
        [
            'id' => 'inv_in2_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'category' => 'INPUT',
            'transactionCode' => '01',
            'invoiceNumber' => '010025812009822',
            'invoiceDate' => '2025-01-18',
            'masaPajak' => 1,
            'tahunPajak' => 2025,
            'counterpartyNpwp' => '0298765432109000',
            'counterpartyName' => 'PT DIGITAL INFRASTRUKTUR JAYA',
            'status' => 'APPROVED',
            'creditStatus' => 'CREDITED',
            'dppTotal' => 25000000,
            'dppNilaiLain' => 25000000,
            'ppnTotal' => 2750000,
            'ppnbmTotal' => 0,
            'items' => [[
                'id' => 'item_in_2',
                'itemType' => 'JASA',
                'itemCode' => '220200',
                'name' => 'Layanan Lisensi Cloud & Keamanan Jaringan',
                'unit' => 'Paket',
                'unitPrice' => 25000000,
                'qty' => 1,
                'discount' => 0,
                'dpp' => 25000000,
                'useDppNilaiLain' => false,
                'dppNilaiLain' => 25000000,
                'ppn' => 2750000,
                'ppnbm' => 0,
            ]],
            'referenceDoc' => 'INV-DIJ-2025-018',
            'sp2dNumber' => '',
            'amendmentOf' => '',
            'createdAtIso' => $nowIso,
        ],
        [
            'id' => 'inv_out1_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'category' => 'OUTPUT',
            'transactionCode' => '01',
            'invoiceNumber' => 'DRAFT-001',
            'invoiceDate' => '2025-01-20',
            'masaPajak' => 1,
            'tahunPajak' => 2025,
            'counterpartyNpwp' => '0344556677889000',
            'counterpartyName' => 'PT KARYA MANDIRI SEJAHTERA',
            'status' => 'CREATED',
            'creditStatus' => 'NA',
            'dppTotal' => 100000000,
            'dppNilaiLain' => 100000000,
            'ppnTotal' => 11000000,
            'ppnbmTotal' => 0,
            'items' => [[
                'id' => 'item_out_1',
                'itemType' => 'JASA',
                'itemCode' => '210100',
                'name' => 'Jasa Implementasi Sistem Akuntansi & Pajak',
                'unit' => 'Paket',
                'unitPrice' => 100000000,
                'qty' => 1,
                'discount' => 0,
                'dpp' => 100000000,
                'useDppNilaiLain' => false,
                'dppNilaiLain' => 100000000,
                'ppn' => 11000000,
                'ppnbm' => 0,
            ]],
            'referenceDoc' => 'INV-KB-2025-001',
            'sp2dNumber' => '',
            'amendmentOf' => '',
            'createdAtIso' => $nowIso,
        ],
    ];

    $ebupot = [
        [
            'id' => 'slip_bpa1_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'slipType' => 'BPA1',
            'slipNumber' => 'BPA1-25-0001721',
            'masaPajak' => 12,
            'tahunPajak' => 2025,
            'recipientNik' => $cleanNik,
            'recipientName' => $opName,
            'ptkpStatus' => 'TK/0',
            'terCategory' => 'A',
            'objectCode' => '21-100-01',
            'objectName' => 'Pegawai Tetap (Bukti Potong Tahunan A1 — Jan s.d. Des 2025)',
            'grossAmount' => 533500000,
            'taxRate' => 16.38,
            'pphAmount' => 87375000,
            'referenceDoc' => '1.1-12.25-0000017',
            'status' => 'TELAH_TERBIT',
            'issuerNpwp' => '0188899900112000',
            'issuerName' => 'PT MAJU BERSAMA SEJAHTERA',
            'createdAtIso' => $nowIso,
        ],
        [
            'id' => 'slip_mp1_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'slipType' => 'MP',
            'slipNumber' => 'DRAFT-MP-001',
            'masaPajak' => 1,
            'tahunPajak' => 2025,
            'recipientNik' => '3174012208920004',
            'recipientName' => 'BUDI SANTOSO',
            'ptkpStatus' => 'K/1',
            'terCategory' => 'B',
            'objectCode' => '21-100-01',
            'objectName' => 'Pegawai Tetap (TER Bulanan)',
            'grossAmount' => 15000000,
            'taxRate' => 6,
            'pphAmount' => 900000,
            'referenceDoc' => 'PAYROLL-JAN-2025',
            'status' => 'BELUM_TERBIT',
            'issuerNpwp' => $badanNpwp,
            'issuerName' => $workspace['badanProfile']['nama'],
            'createdAtIso' => $nowIso,
        ],
        [
            'id' => 'slip_bppu1_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'slipType' => 'BPPU',
            'slipNumber' => 'BPPU-25-2410429',
            'masaPajak' => 1,
            'tahunPajak' => 2025,
            'recipientNik' => '0255566677889000',
            'recipientName' => 'CV KONSULTAN PAJAK NUSANTARA',
            'ptkpStatus' => 'NA',
            'terCategory' => 'NA',
            'objectCode' => '24-104-29',
            'objectName' => 'Jasa Konsultan / Manajemen',
            'grossAmount' => 30000000,
            'taxRate' => 2,
            'pphAmount' => 600000,
            'referenceDoc' => 'SPK-2025/KB/014',
            'status' => 'TELAH_TERBIT',
            'issuerNpwp' => $badanNpwp,
            'issuerName' => $workspace['badanProfile']['nama'],
            'createdAtIso' => $nowIso,
        ],
    ];

    $ledger = [
        [
            'id' => 'led_op_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'taxpayerRole' => 'OP',
            'entryDate' => '2025-01-05',
            'entryType' => 'DEPOSIT_TOPUP',
            'referenceNumber' => 'NTPN-DEP-OP001',
            'description' => 'Saldo Awal Deposit Pajak Simulasi KelasBrevet (OP)',
            'debit' => 0,
            'credit' => 15000000,
            'balanceAfter' => 15000000,
            'createdAtIso' => $nowIso,
        ],
        [
            'id' => 'led_bd_' . $cleanNik,
            'ownerId' => 'mysql_user',
            'workspaceId' => $workspaceId,
            'taxpayerRole' => 'BADAN',
            'entryDate' => '2025-01-05',
            'entryType' => 'DEPOSIT_TOPUP',
            'referenceNumber' => 'NTPN-DEP-BD001',
            'description' => 'Saldo Awal Deposit Pajak Simulasi KelasBrevet (PT Simulasi)',
            'debit' => 0,
            'credit' => 150000000,
            'balanceAfter' => 150000000,
            'createdAtIso' => $nowIso,
        ],
    ];

    return [
        'workspace' => $workspace,
        'efaktur' => $efaktur,
        'ebupot' => $ebupot,
        'taxReturns' => [],
        'billing' => [],
        'ledger' => $ledger,
    ];
}

function insertSeed(PDO $pdo, array $seed): void
{
    $ws = $seed['workspace'];
    $stmtWs = $pdo->prepare(
        'INSERT INTO workspaces (id, nik, owner_id, op_profile, badan_profile, active_role, guided_mode, active_case_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmtWs->execute([
        $ws['id'],
        $ws['nik'],
        $ws['ownerId'],
        json_encode($ws['opProfile'], JSON_UNESCAPED_UNICODE),
        json_encode($ws['badanProfile'], JSON_UNESCAPED_UNICODE),
        $ws['activeRole'],
        $ws['guidedMode'] ? 1 : 0,
        $ws['activeCaseId'],
    ]);

    $stmtEf = $pdo->prepare(
        'INSERT INTO efaktur_invoices (
            id, workspace_id, owner_id, category, transaction_code, invoice_number, invoice_date,
            masa_pajak, tahun_pajak, counterparty_npwp, counterparty_name, status, credit_status,
            dpp_total, dpp_nilai_lain, ppn_total, ppnbm_total, items_json, reference_doc, sp2d_number,
            amendment_of, created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($seed['efaktur'] as $inv) {
        $stmtEf->execute([
            $inv['id'], $inv['workspaceId'], $inv['ownerId'], $inv['category'], $inv['transactionCode'],
            $inv['invoiceNumber'], $inv['invoiceDate'], $inv['masaPajak'], $inv['tahunPajak'],
            $inv['counterpartyNpwp'], $inv['counterpartyName'], $inv['status'], $inv['creditStatus'],
            $inv['dppTotal'], $inv['dppNilaiLain'], $inv['ppnTotal'], $inv['ppnbmTotal'],
            json_encode($inv['items'], JSON_UNESCAPED_UNICODE), $inv['referenceDoc'], $inv['sp2dNumber'],
            $inv['amendmentOf'], $inv['createdAtIso'],
        ]);
    }

    $stmtEb = $pdo->prepare(
        'INSERT INTO ebupot_slips (
            id, workspace_id, owner_id, slip_type, slip_number, masa_pajak, tahun_pajak,
            recipient_nik, recipient_name, ptkp_status, ter_category, object_code, object_name,
            gross_amount, tax_rate, pph_amount, reference_doc, status, issuer_npwp, issuer_name,
            created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($seed['ebupot'] as $sl) {
        $stmtEb->execute([
            $sl['id'], $sl['workspaceId'], $sl['ownerId'], $sl['slipType'], $sl['slipNumber'],
            $sl['masaPajak'], $sl['tahunPajak'], $sl['recipientNik'], $sl['recipientName'],
            $sl['ptkpStatus'], $sl['terCategory'], $sl['objectCode'], $sl['objectName'],
            $sl['grossAmount'], $sl['taxRate'], $sl['pphAmount'], $sl['referenceDoc'],
            $sl['status'], $sl['issuerNpwp'], $sl['issuerName'], $sl['createdAtIso'],
        ]);
    }

    $stmtLe = $pdo->prepare(
        'INSERT INTO ledger_entries (
            id, workspace_id, owner_id, taxpayer_role, entry_date, entry_type,
            reference_number, description, debit, credit, balance_after, created_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($seed['ledger'] as $le) {
        $stmtLe->execute([
            $le['id'], $le['workspaceId'], $le['ownerId'], $le['taxpayerRole'], $le['entryDate'],
            $le['entryType'], $le['referenceNumber'], $le['description'], $le['debit'],
            $le['credit'], $le['balanceAfter'], $le['createdAtIso'],
        ]);
    }
}

function getSnapshotByNik(PDO $pdo, string $nik): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM workspaces WHERE nik = ? LIMIT 1');
    $stmt->execute([$nik]);
    $w = $stmt->fetch();
    if (!$w) {
        return null;
    }

    $wsId = $w['id'];
    $workspace = [
        'id' => $wsId,
        'ownerId' => $w['owner_id'],
        'nik' => $w['nik'],
        'opProfile' => json_decode((string)$w['op_profile'], true),
        'badanProfile' => json_decode((string)$w['badan_profile'], true),
        'activeRole' => $w['active_role'],
        'guidedMode' => (bool)$w['guided_mode'],
        'activeCaseId' => $w['active_case_id'],
    ];

    $q = function (string $sql) use ($pdo, $wsId): array {
        $s = $pdo->prepare($sql);
        $s->execute([$wsId]);
        return $s->fetchAll();
    };

    $efaktur = array_map(fn($r) => [
        'id' => $r['id'],
        'ownerId' => $r['owner_id'],
        'workspaceId' => $r['workspace_id'],
        'category' => $r['category'],
        'transactionCode' => $r['transaction_code'],
        'invoiceNumber' => $r['invoice_number'],
        'invoiceDate' => $r['invoice_date'],
        'masaPajak' => (int)$r['masa_pajak'],
        'tahunPajak' => (int)$r['tahun_pajak'],
        'counterpartyNpwp' => $r['counterparty_npwp'],
        'counterpartyName' => $r['counterparty_name'],
        'status' => $r['status'],
        'creditStatus' => $r['credit_status'],
        'dppTotal' => (float)$r['dpp_total'],
        'dppNilaiLain' => (float)$r['dpp_nilai_lain'],
        'ppnTotal' => (float)$r['ppn_total'],
        'ppnbmTotal' => (float)$r['ppnbm_total'],
        'items' => json_decode((string)$r['items_json'], true) ?: [],
        'referenceDoc' => $r['reference_doc'],
        'sp2dNumber' => $r['sp2d_number'],
        'amendmentOf' => $r['amendment_of'],
        'createdAtIso' => $r['created_at_iso'],
    ], $q('SELECT * FROM efaktur_invoices WHERE workspace_id = ? ORDER BY created_at DESC'));

    $ebupot = array_map(fn($r) => [
        'id' => $r['id'],
        'ownerId' => $r['owner_id'],
        'workspaceId' => $r['workspace_id'],
        'slipType' => $r['slip_type'],
        'slipNumber' => $r['slip_number'],
        'masaPajak' => (int)$r['masa_pajak'],
        'tahunPajak' => (int)$r['tahun_pajak'],
        'recipientNik' => $r['recipient_nik'],
        'recipientName' => $r['recipient_name'],
        'ptkpStatus' => $r['ptkp_status'],
        'terCategory' => $r['ter_category'],
        'objectCode' => $r['object_code'],
        'objectName' => $r['object_name'],
        'grossAmount' => (float)$r['gross_amount'],
        'taxRate' => (float)$r['tax_rate'],
        'pphAmount' => (float)$r['pph_amount'],
        'referenceDoc' => $r['reference_doc'],
        'status' => $r['status'],
        'issuerNpwp' => $r['issuer_npwp'],
        'issuerName' => $r['issuer_name'],
        'createdAtIso' => $r['created_at_iso'],
    ], $q('SELECT * FROM ebupot_slips WHERE workspace_id = ? ORDER BY created_at DESC'));

    $taxReturns = array_map(fn($r) => [
        'id' => $r['id'],
        'ownerId' => $r['owner_id'],
        'workspaceId' => $r['workspace_id'],
        'taxpayerRole' => $r['taxpayer_role'],
        'returnType' => $r['return_type'],
        'masaPajak' => (int)$r['masa_pajak'],
        'tahunPajak' => (int)$r['tahun_pajak'],
        'pembetulanKe' => (int)$r['pembetulan_ke'],
        'status' => $r['status'],
        'taxPosition' => $r['tax_position'],
        'amountDue' => (float)$r['amount_due'],
        'bpeNumber' => $r['bpe_number'],
        'billingCode' => $r['billing_code'],
        'submittedAt' => $r['submitted_at'],
        'payload' => json_decode((string)$r['payload_json'], true) ?: [],
        'createdAtIso' => $r['created_at_iso'],
    ], $q('SELECT * FROM tax_returns WHERE workspace_id = ? ORDER BY created_at DESC'));

    $billing = array_map(fn($r) => [
        'id' => $r['id'],
        'ownerId' => $r['owner_id'],
        'workspaceId' => $r['workspace_id'],
        'taxpayerRole' => $r['taxpayer_role'],
        'billingNumber' => $r['billing_number'],
        'kapKjs' => $r['kap_kjs'],
        'description' => $r['description'],
        'masaPajak' => (int)$r['masa_pajak'],
        'tahunPajak' => (int)$r['tahun_pajak'],
        'amount' => (float)$r['amount'],
        'status' => $r['status'],
        'ntpn' => $r['ntpn'],
        'relatedReturnId' => $r['related_return_id'],
        'paidAt' => $r['paid_at'],
        'createdAtIso' => $r['created_at_iso'],
    ], $q('SELECT * FROM billing_codes WHERE workspace_id = ? ORDER BY created_at DESC'));

    $ledger = array_map(fn($r) => [
        'id' => $r['id'],
        'ownerId' => $r['owner_id'],
        'workspaceId' => $r['workspace_id'],
        'taxpayerRole' => $r['taxpayer_role'],
        'entryDate' => $r['entry_date'],
        'entryType' => $r['entry_type'],
        'referenceNumber' => $r['reference_number'],
        'description' => $r['description'],
        'debit' => (float)$r['debit'],
        'credit' => (float)$r['credit'],
        'balanceAfter' => (float)$r['balance_after'],
        'createdAtIso' => $r['created_at_iso'],
    ], $q('SELECT * FROM ledger_entries WHERE workspace_id = ? ORDER BY created_at DESC'));

    return [
        'workspace' => $workspace,
        'efaktur' => $efaktur,
        'ebupot' => $ebupot,
        'taxReturns' => $taxReturns,
        'billing' => $billing,
        'ledger' => $ledger,
    ];
}

// --- Routing ---
$method = $_SERVER['REQUEST_METHOD'];
$uriPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($uriPath, $scriptDir)) {
    $route = substr($uriPath, strlen($scriptDir));
} else {
    $route = $uriPath;
}
$route = '/' . ltrim($route, '/');

try {
    // POST /auth/nik
    if ($method === 'POST' && $route === '/auth/nik') {
        $body = readJsonBody();
        $nik = cleanNik((string)($body['nik'] ?? ''));
        $customName = isset($body['customName']) ? (string)$body['customName'] : null;
        if (strlen($nik) !== 16) {
            respond(['error' => 'NIK harus terdiri dari 16 digit angka.'], 400);
        }
        $existing = getSnapshotByNik($pdo, $nik);
        if ($existing) {
            respond($existing);
        }
        $seed = buildSeedSnapshot($nik, $customName);
        $pdo->beginTransaction();
        insertSeed($pdo, $seed);
        $pdo->commit();
        respond(getSnapshotByNik($pdo, $nik) ?? $seed);
    }

    // GET /workspace/{nik}
    if ($method === 'GET' && preg_match('#^/workspace/(\d{16})$#', $route, $m)) {
        $snap = getSnapshotByNik($pdo, $m[1]);
        if (!$snap) {
            respond(['error' => 'Workspace tidak ditemukan.'], 404);
        }
        respond($snap);
    }

    // PATCH /workspace/{nik}
    if ($method === 'PATCH' && preg_match('#^/workspace/(\d{16})$#', $route, $m)) {
        $nik = $m[1];
        $cur = getSnapshotByNik($pdo, $nik);
        if (!$cur) {
            respond(['error' => 'Workspace tidak ditemukan.'], 404);
        }
        $patch = readJsonBody();
        $ws = array_merge($cur['workspace'], $patch);
        $stmt = $pdo->prepare(
            'UPDATE workspaces
             SET op_profile = ?, badan_profile = ?, active_role = ?, guided_mode = ?, active_case_id = ?
             WHERE nik = ?'
        );
        $stmt->execute([
            json_encode($ws['opProfile'], JSON_UNESCAPED_UNICODE),
            json_encode($ws['badanProfile'], JSON_UNESCAPED_UNICODE),
            $ws['activeRole'],
            !empty($ws['guidedMode']) ? 1 : 0,
            $ws['activeCaseId'],
            $nik,
        ]);
        respond(['ok' => true]);
    }

    // POST /workspace/{nik}/reset
    if ($method === 'POST' && preg_match('#^/workspace/(\d{16})/reset$#', $route, $m)) {
        $nik = $m[1];
        $cur = getSnapshotByNik($pdo, $nik);
        $existingName = $cur['workspace']['opProfile']['nama'] ?? null;
        $seed = buildSeedSnapshot($nik, $existingName);
        $pdo->beginTransaction();
        $del = $pdo->prepare('DELETE FROM workspaces WHERE nik = ?');
        $del->execute([$nik]);
        insertSeed($pdo, $seed);
        $pdo->commit();
        respond(getSnapshotByNik($pdo, $nik) ?? $seed);
    }

    // PUT /workspace/{nik}/efaktur
    if ($method === 'PUT' && preg_match('#^/workspace/(\d{16})/efaktur$#', $route, $m)) {
        $inv = readJsonBody();
        $stmt = $pdo->prepare(
            'INSERT INTO efaktur_invoices (
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
                items_json = VALUES(items_json)'
        );
        $stmt->execute([
            $inv['id'], $inv['workspaceId'], $inv['ownerId'] ?? 'mysql_user', $inv['category'],
            $inv['transactionCode'], $inv['invoiceNumber'], $inv['invoiceDate'], $inv['masaPajak'],
            $inv['tahunPajak'], $inv['counterpartyNpwp'], $inv['counterpartyName'], $inv['status'],
            $inv['creditStatus'], $inv['dppTotal'], $inv['dppNilaiLain'], $inv['ppnTotal'],
            $inv['ppnbmTotal'], json_encode($inv['items'] ?? [], JSON_UNESCAPED_UNICODE),
            $inv['referenceDoc'] ?? '', $inv['sp2dNumber'] ?? '', $inv['amendmentOf'] ?? '',
            $inv['createdAtIso'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        ]);
        respond(['ok' => true]);
    }

    // DELETE /workspace/{nik}/efaktur/{id}
    if ($method === 'DELETE' && preg_match('#^/workspace/(\d{16})/efaktur/([^/]+)$#', $route, $m)) {
        $stmt = $pdo->prepare('DELETE FROM efaktur_invoices WHERE id = ? AND workspace_id = ?');
        $stmt->execute([urldecode($m[2]), 'ws_' . $m[1]]);
        respond(['ok' => true]);
    }

    // PUT /workspace/{nik}/ebupot
    if ($method === 'PUT' && preg_match('#^/workspace/(\d{16})/ebupot$#', $route, $m)) {
        $body = readJsonBody();
        $slips = isset($body['slips']) && is_array($body['slips']) ? $body['slips'] : [$body];
        $stmt = $pdo->prepare(
            'INSERT INTO ebupot_slips (
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
                pph_amount = VALUES(pph_amount)'
        );
        $pdo->beginTransaction();
        foreach ($slips as $sl) {
            $stmt->execute([
                $sl['id'], $sl['workspaceId'], $sl['ownerId'] ?? 'mysql_user', $sl['slipType'],
                $sl['slipNumber'], $sl['masaPajak'], $sl['tahunPajak'], $sl['recipientNik'],
                $sl['recipientName'], $sl['ptkpStatus'], $sl['terCategory'], $sl['objectCode'],
                $sl['objectName'], $sl['grossAmount'], $sl['taxRate'], $sl['pphAmount'],
                $sl['referenceDoc'] ?? '', $sl['status'], $sl['issuerNpwp'], $sl['issuerName'],
                $sl['createdAtIso'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
            ]);
        }
        $pdo->commit();
        respond(['ok' => true]);
    }

    // DELETE /workspace/{nik}/ebupot/{id}
    if ($method === 'DELETE' && preg_match('#^/workspace/(\d{16})/ebupot/([^/]+)$#', $route, $m)) {
        $stmt = $pdo->prepare('DELETE FROM ebupot_slips WHERE id = ? AND workspace_id = ?');
        $stmt->execute([urldecode($m[2]), 'ws_' . $m[1]]);
        respond(['ok' => true]);
    }

    // PUT /workspace/{nik}/tax-returns
    if ($method === 'PUT' && preg_match('#^/workspace/(\d{16})/tax-returns$#', $route, $m)) {
        $tr = readJsonBody();
        $stmt = $pdo->prepare(
            'INSERT INTO tax_returns (
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
                payload_json = VALUES(payload_json)'
        );
        $stmt->execute([
            $tr['id'], $tr['workspaceId'], $tr['ownerId'] ?? 'mysql_user', $tr['taxpayerRole'],
            $tr['returnType'], $tr['masaPajak'], $tr['tahunPajak'], $tr['pembetulanKe'],
            $tr['status'], $tr['taxPosition'], $tr['amountDue'], $tr['bpeNumber'] ?? '',
            $tr['billingCode'] ?? '', $tr['submittedAt'] ?? '',
            json_encode($tr['payload'] ?? [], JSON_UNESCAPED_UNICODE),
            $tr['createdAtIso'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        ]);
        respond(['ok' => true]);
    }

    // DELETE /workspace/{nik}/tax-returns/{id}
    if ($method === 'DELETE' && preg_match('#^/workspace/(\d{16})/tax-returns/([^/]+)$#', $route, $m)) {
        $stmt = $pdo->prepare('DELETE FROM tax_returns WHERE id = ? AND workspace_id = ?');
        $stmt->execute([urldecode($m[2]), 'ws_' . $m[1]]);
        respond(['ok' => true]);
    }

    // PUT /workspace/{nik}/billing
    if ($method === 'PUT' && preg_match('#^/workspace/(\d{16})/billing$#', $route, $m)) {
        $b = readJsonBody();
        $stmt = $pdo->prepare(
            'INSERT INTO billing_codes (
                id, workspace_id, owner_id, taxpayer_role, billing_number, kap_kjs, description,
                masa_pajak, tahun_pajak, amount, status, ntpn, related_return_id, paid_at, created_at_iso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                ntpn = VALUES(ntpn),
                paid_at = VALUES(paid_at)'
        );
        $stmt->execute([
            $b['id'], $b['workspaceId'], $b['ownerId'] ?? 'mysql_user', $b['taxpayerRole'],
            $b['billingNumber'], $b['kapKjs'], $b['description'], $b['masaPajak'], $b['tahunPajak'],
            $b['amount'], $b['status'], $b['ntpn'] ?? '', $b['relatedReturnId'] ?? '',
            $b['paidAt'] ?? '', $b['createdAtIso'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        ]);
        respond(['ok' => true]);
    }

    // POST /workspace/{nik}/ledger
    if ($method === 'POST' && preg_match('#^/workspace/(\d{16})/ledger$#', $route, $m)) {
        $le = readJsonBody();
        $stmt = $pdo->prepare(
            'INSERT INTO ledger_entries (
                id, workspace_id, owner_id, taxpayer_role, entry_date, entry_type,
                reference_number, description, debit, credit, balance_after, created_at_iso
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $le['id'], $le['workspaceId'], $le['ownerId'] ?? 'mysql_user', $le['taxpayerRole'],
            $le['entryDate'], $le['entryType'], $le['referenceNumber'], $le['description'],
            $le['debit'], $le['credit'], $le['balanceAfter'],
            $le['createdAtIso'] ?? gmdate('Y-m-d\TH:i:s.000\Z'),
        ]);
        respond(['ok' => true]);
    }

    respond(['error' => 'Endpoint tidak ditemukan.', 'route' => $route], 404);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(['error' => 'Terjadi kesalahan pada server MySQL.', 'detail' => $e->getMessage()], 500);
}
