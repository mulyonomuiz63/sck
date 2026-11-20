<?php
/**
 * Konfigurasi Database MySQL — Hostinger Shared Hosting (hPanel)
 *
 * Cara pakai:
 * 1. Salin file ini menjadi `config.php` di folder `public_html/api/`
 * 2. Isi kredensial database MySQL dari hPanel Hostinger -> Databases -> Management
 * 3. JANGAN pernah mengunggah `config.php` ke repository Git publik.
 */

return [
    'host' => '127.0.0.1', // Di Hostinger biasanya 'localhost' atau '127.0.0.1'
    'port' => 3306,
    'database' => 'u123456789_coretax_sim',
    'username' => 'u123456789_admin',
    'password' => 'GANTI_DENGAN_PASSWORD_DB_HOSTINGER',
    'charset' => 'utf8mb4',
];
