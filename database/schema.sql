-- ============================================================================
-- Skema Database MySQL / MariaDB
-- Simulasi Coretax — Lisensi Pembelajaran KelasBrevet
-- Kompatibel dengan MySQL 8.0+ & MariaDB 10.4+ (Hostinger phpMyAdmin)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabel Workspaces (Profil OP & Impersonate WP Badan per NIK 16 Digit)
CREATE TABLE IF NOT EXISTS `workspaces` (
  `id` VARCHAR(64) NOT NULL,
  `nik` CHAR(16) NOT NULL,
  `owner_id` VARCHAR(128) NOT NULL DEFAULT 'mysql_user',
  `op_profile` JSON NOT NULL,
  `badan_profile` JSON NOT NULL,
  `active_role` ENUM('OP', 'BADAN') NOT NULL DEFAULT 'OP',
  `guided_mode` TINYINT(1) NOT NULL DEFAULT 1,
  `active_case_id` VARCHAR(64) NOT NULL DEFAULT 'case_pph21_tuan_a',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_workspaces_nik` (`nik`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel e-Faktur (Pajak Keluaran, Masukan, Dokumen Tertentu, Retur)
CREATE TABLE IF NOT EXISTS `efaktur_invoices` (
  `id` VARCHAR(64) NOT NULL,
  `workspace_id` VARCHAR(64) NOT NULL,
  `owner_id` VARCHAR(128) NOT NULL DEFAULT 'mysql_user',
  `category` ENUM('OUTPUT', 'INPUT', 'SPECIAL_OUTPUT', 'SPECIAL_INPUT', 'OUTPUT_RETURN', 'INPUT_RETURN') NOT NULL,
  `transaction_code` VARCHAR(10) NOT NULL DEFAULT '01',
  `invoice_number` VARCHAR(40) NOT NULL,
  `invoice_date` VARCHAR(20) NOT NULL,
  `masa_pajak` TINYINT UNSIGNED NOT NULL,
  `tahun_pajak` SMALLINT UNSIGNED NOT NULL,
  `counterparty_npwp` VARCHAR(24) NOT NULL,
  `counterparty_name` VARCHAR(150) NOT NULL,
  `status` ENUM('CREATED', 'APPROVED', 'WAITING_FOR_AMENDMENT', 'AMENDED', 'WAITING_FOR_CANCELLATION', 'CANCELED') NOT NULL DEFAULT 'CREATED',
  `credit_status` ENUM('CREDITED', 'UNCREDITED', 'NA') NOT NULL DEFAULT 'NA',
  `dpp_total` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `dpp_nilai_lain` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `ppn_total` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `ppnbm_total` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `items_json` JSON NOT NULL,
  `reference_doc` VARCHAR(100) NOT NULL DEFAULT '',
  `sp2d_number` VARCHAR(60) NOT NULL DEFAULT '',
  `amendment_of` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at_iso` VARCHAR(40) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_efaktur_ws_period` (`workspace_id`, `tahun_pajak`, `masa_pajak`),
  CONSTRAINT `fk_efaktur_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel e-Bupot (MP TER, BP 21, BPA1/BPA2, BPPU PPh 23)
CREATE TABLE IF NOT EXISTS `ebupot_slips` (
  `id` VARCHAR(64) NOT NULL,
  `workspace_id` VARCHAR(64) NOT NULL,
  `owner_id` VARCHAR(128) NOT NULL DEFAULT 'mysql_user',
  `slip_type` ENUM('MP', 'BP21', 'BPA1', 'BPA2', 'BPPU') NOT NULL,
  `slip_number` VARCHAR(40) NOT NULL,
  `masa_pajak` TINYINT UNSIGNED NOT NULL,
  `tahun_pajak` SMALLINT UNSIGNED NOT NULL,
  `recipient_nik` VARCHAR(24) NOT NULL,
  `recipient_name` VARCHAR(150) NOT NULL,
  `ptkp_status` VARCHAR(16) NOT NULL DEFAULT 'TK/0',
  `ter_category` VARCHAR(8) NOT NULL DEFAULT 'NA',
  `object_code` VARCHAR(24) NOT NULL,
  `object_name` VARCHAR(150) NOT NULL,
  `gross_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `tax_rate` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `pph_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `reference_doc` VARCHAR(100) NOT NULL DEFAULT '',
  `status` ENUM('BELUM_TERBIT', 'TELAH_TERBIT', 'DIBATALKAN') NOT NULL DEFAULT 'BELUM_TERBIT',
  `issuer_npwp` VARCHAR(24) NOT NULL,
  `issuer_name` VARCHAR(150) NOT NULL,
  `created_at_iso` VARCHAR(40) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebupot_ws_period` (`workspace_id`, `tahun_pajak`, `masa_pajak`),
  CONSTRAINT `fk_ebupot_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Surat Pemberitahuan (SPT Masa & SPT Tahunan OP / Badan)
CREATE TABLE IF NOT EXISTS `tax_returns` (
  `id` VARCHAR(64) NOT NULL,
  `workspace_id` VARCHAR(64) NOT NULL,
  `owner_id` VARCHAR(128) NOT NULL DEFAULT 'mysql_user',
  `taxpayer_role` ENUM('OP', 'BADAN') NOT NULL,
  `return_type` ENUM('PPN', 'PPH21_MASA', 'PPH_UNIFIKASI', 'PPH_OP_TAHUNAN', 'PPH_BADAN_TAHUNAN') NOT NULL,
  `masa_pajak` TINYINT UNSIGNED NOT NULL,
  `tahun_pajak` SMALLINT UNSIGNED NOT NULL,
  `pembetulan_ke` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `status` ENUM('KONSEP', 'MENUNGGU_PEMBAYARAN', 'DILAPORKAN') NOT NULL DEFAULT 'KONSEP',
  `tax_position` ENUM('NIHIL', 'KURANG_BAYAR', 'LEBIH_BAYAR') NOT NULL DEFAULT 'NIHIL',
  `amount_due` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `bpe_number` VARCHAR(60) NOT NULL DEFAULT '',
  `billing_code` VARCHAR(30) NOT NULL DEFAULT '',
  `submitted_at` VARCHAR(40) NOT NULL DEFAULT '',
  `payload_json` JSON NOT NULL,
  `created_at_iso` VARCHAR(40) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_spt_ws_status` (`workspace_id`, `status`),
  CONSTRAINT `fk_spt_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Kode Billing & Status Pembayaran (NTPN)
CREATE TABLE IF NOT EXISTS `billing_codes` (
  `id` VARCHAR(64) NOT NULL,
  `workspace_id` VARCHAR(64) NOT NULL,
  `owner_id` VARCHAR(128) NOT NULL DEFAULT 'mysql_user',
  `taxpayer_role` ENUM('OP', 'BADAN') NOT NULL,
  `billing_number` VARCHAR(24) NOT NULL,
  `kap_kjs` VARCHAR(24) NOT NULL,
  `description` VARCHAR(160) NOT NULL,
  `masa_pajak` TINYINT UNSIGNED NOT NULL,
  `tahun_pajak` SMALLINT UNSIGNED NOT NULL,
  `amount` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `status` ENUM('BELUM_BAYAR', 'LUNAS') NOT NULL DEFAULT 'BELUM_BAYAR',
  `ntpn` VARCHAR(32) NOT NULL DEFAULT '',
  `related_return_id` VARCHAR(64) NOT NULL DEFAULT '',
  `paid_at` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at_iso` VARCHAR(40) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_billing_ws` (`workspace_id`, `status`),
  CONSTRAINT `fk_billing_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Buku Besar (Mutasi Deposit Pajak & Pembayaran)
CREATE TABLE IF NOT EXISTS `ledger_entries` (
  `id` VARCHAR(64) NOT NULL,
  `workspace_id` VARCHAR(64) NOT NULL,
  `owner_id` VARCHAR(128) NOT NULL DEFAULT 'mysql_user',
  `taxpayer_role` ENUM('OP', 'BADAN') NOT NULL,
  `entry_date` VARCHAR(40) NOT NULL,
  `entry_type` ENUM('DEPOSIT_TOPUP', 'DEPOSIT_TRANSFER', 'BILLING_PAYMENT', 'TAX_ASSESSMENT') NOT NULL,
  `reference_number` VARCHAR(60) NOT NULL,
  `description` VARCHAR(200) NOT NULL,
  `debit` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `credit` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `balance_after` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  `created_at_iso` VARCHAR(40) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ledger_ws` (`workspace_id`, `taxpayer_role`),
  CONSTRAINT `fk_ledger_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel Peserta Terdaftar / Whitelist NIK Pembeli Paket kelasbrevet.com
CREATE TABLE IF NOT EXISTS `enrolled_participants` (
  `nik` CHAR(16) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL DEFAULT '',
  `phone` VARCHAR(40) NOT NULL DEFAULT '',
  `package_code` VARCHAR(40) NOT NULL DEFAULT 'BREVET_AB',
  `order_id` VARCHAR(80) NOT NULL DEFAULT '',
  `status` ENUM('ACTIVE', 'SUSPENDED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `expires_at` VARCHAR(40) NOT NULL DEFAULT '',
  `source` VARCHAR(40) NOT NULL DEFAULT 'ADMIN',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`nik`),
  KEY `idx_enrolled_status_pkg` (`status`, `package_code`),
  KEY `idx_enrolled_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabel Bank Soal / Kasus Ujian Praktik & Rubrik Kunci Jawaban Otomatis
CREATE TABLE IF NOT EXISTS `exam_cases` (
  `id` VARCHAR(64) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `module_type` ENUM('PPN', 'PPH21_TAHUNAN', 'EBUPOT_21_23', 'PPH_OP_UMUM', 'PPH_BADAN') NOT NULL,
  `package_access` VARCHAR(120) NOT NULL DEFAULT 'ALL',
  `passing_score` INT NOT NULL DEFAULT 75,
  `max_attempts` INT NOT NULL DEFAULT 3,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `scenario_text` TEXT NOT NULL,
  `rubric_json` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_exam_cases_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabel Riwayat Pengerjaan & Hasil Penilaian Otomatis Ujian Peserta
CREATE TABLE IF NOT EXISTS `exam_attempts` (
  `id` VARCHAR(64) NOT NULL,
  `case_id` VARCHAR(64) NOT NULL,
  `nik` CHAR(16) NOT NULL,
  `participant_name` VARCHAR(150) NOT NULL,
  `package_code` VARCHAR(40) NOT NULL DEFAULT 'BREVET_AB',
  `attempt_number` INT NOT NULL DEFAULT 1,
  `status` ENUM('IN_PROGRESS', 'PASSED', 'FAILED') NOT NULL DEFAULT 'IN_PROGRESS',
  `score` INT NOT NULL DEFAULT 0,
  `max_score` INT NOT NULL DEFAULT 100,
  `passing_score` INT NOT NULL DEFAULT 75,
  `results_json` JSON NOT NULL,
  `certificate_number` VARCHAR(64) NOT NULL DEFAULT '',
  `certificate_issued_at` VARCHAR(40) NOT NULL DEFAULT '',
  `started_at` VARCHAR(40) NOT NULL,
  `submitted_at` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attempts_nik_case` (`nik`, `case_id`),
  KEY `idx_attempts_status` (`status`, `created_at`),
  KEY `idx_attempts_cert` (`certificate_number`),
  CONSTRAINT `fk_attempts_case` FOREIGN KEY (`case_id`) REFERENCES `exam_cases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabel Pengaturan Sistem (Mode Whitelist Ketat, Callback Webhook kelasbrevet.com)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

