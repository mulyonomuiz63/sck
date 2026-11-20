# Panduan Deploy Produksi MySQL di Hostinger
**Simulasi Coretax — Lisensi Pembelajaran KelasBrevet**

Seluruh proses aplikasi (Login 16 digit NIK, Profil OP & Impersonate Badan, e-Faktur, e-Bupot MP/BP21/BPA1/BPPU, Konsep & Pelaporan SPT, Kode Billing, serta Buku Besar Deposit) tersimpan penuh di database **MySQL** melalui 6 tabel relasional:

1. `workspaces` — Profil OP, Profil Impersonate WP Badan, Passphrase, Saldo Deposit, dan Mode Panduan per NIK 16 digit.
2. `efaktur_invoices` — Faktur Pajak Keluaran, Masukan, Dokumen Tertentu, Retur, status Pengganti/Pembatalan, dan status Pengkreditan.
3. `ebupot_slips` — Bukti Potong MP (TER), BP 21, BPA1/BPA2, dan BPPU (PPh 23).
4. `tax_returns` — Konsep, Menunggu Pembayaran, dan SPT Dilaporkan (PPN, PPh 21 Masa, Unifikasi, OP Tahunan, Badan Tahunan) lengkap dengan BPE & payload JSON.
5. `billing_codes` — Kode Billing 15 digit, status pembayaran, dan NTPN simulasi.
6. `ledger_entries` — Buku Besar mutasi Deposit Pajak dan pembayaran Billing.

---

## Langkah 1: Buat Database MySQL & Impor Skema di hPanel Hostinger

1. Login ke **hPanel Hostinger** -> menu **Databases** -> **Management**.
2. Buat database MySQL baru (contoh: `u123456789_coretax_sim`), user database, dan password yang kuat. Catat:
   - **Host**: `localhost` (atau `127.0.0.1`)
   - **Database Name**
   - **Username**
   - **Password**
3. Klik **Enter phpMyAdmin** pada database yang baru dibuat.
4. Buka tab **Import**, pilih file `database/schema.sql` dari repository ini, lalu klik **Import / Go**.
5. Pastikan ke-6 tabel (`workspaces`, `efaktur_invoices`, `ebupot_slips`, `tax_returns`, `billing_codes`, `ledger_entries`) berhasil dibuat.

---

## Opsi A: Deploy di Hostinger Shared Web Hosting (hPanel + PHP 8 + MySQL)

Cocok untuk paket **Single / Premium / Business / Cloud Web Hosting** Hostinger tanpa perlu VPS Node.js.

### 1. Build Frontend React
Di komputer lokal Anda (atau CI/CD):
```bash
npm install
npm run build
```
Hasil build statis ada di folder `dist/`.

### 2. Upload ke `public_html` (via File Manager hPanel atau FTP)
1. Upload seluruh isi folder `dist/` ke `public_html/` (sehingga `index.html` berada di `public_html/index.html`).
2. Buat folder `public_html/api/`, lalu upload seluruh isi folder `hostinger-php-api/` ke dalam `public_html/api/`:
   - `public_html/api/index.php`
   - `public_html/api/.htaccess`
   - `public_html/api/config.example.php`
3. Di dalam `public_html/api/`, ubah nama `config.example.php` menjadi `config.php`, lalu isi kredensial MySQL dari Langkah 1:
   ```php
   return [
       'host' => '127.0.0.1',
       'port' => 3306,
       'database' => 'u123456789_coretax_sim',
       'username' => 'u123456789_admin',
       'password' => 'PASSWORD_MYSQL_ANDA',
       'charset' => 'utf8mb4',
   ];
   ```
4. Buat file `public_html/.htaccess` agar routing SPA berjalan mulus tanpa mengganggu `/api/`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     # Jangan arahkan request /api/* ke index.html
     RewriteRule ^api/ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```
5. Pastikan versi PHP di hPanel (**Advanced -> PHP Configuration**) minimal **PHP 8.1+** dengan ekstensi `pdo_mysql` aktif (aktif secara default di Hostinger).
6. Buka domain Anda dan uji login dengan NIK 16 digit (misal `3273011205900001`). Cek tabel `workspaces` di phpMyAdmin — data peserta akan langsung tersimpan!

---

## Opsi B: Deploy di Hostinger Node.js Web Apps (hPanel Git Deploy) atau VPS

Cocok untuk **Hostinger Node.js Hosting (hPanel -> Deploy from GitHub)** maupun **Hostinger KVM VPS**.

### Pengaturan Hostinger Node.js Web App (hPanel)
1. Hubungkan repository GitHub (`main`).
2. Pada bagian **Build and Output Settings**:
   - **Node.js version**: `22`
   - **Build command**: `npm run build` *(wajib diisi — otomatis membangun frontend `dist/` dan entry file `server.js`)*
   - **Entry file**: `server.js`
   - **Output directory**: biarkan kosong / default
3. Pada bagian **Environment Variables**, isi:
   ```env
   NODE_ENV=production
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=u123456789_admin
   MYSQL_PASSWORD=PASSWORD_MYSQL_ANDA
   MYSQL_DATABASE=u123456789_coretax_sim
   VITE_API_BASE_URL=/api
   ```
4. Klik **Deploy / Redeploy**. Setelah selesai, buka `https://domainanda.com/api/health` untuk memastikan respons `{"ok":true}`.

### Jika Deploy Manual di Hostinger VPS (Ubuntu + PM2)
```bash
git clone https://github.com/mulyonomuiz63/sck.git
cd sck
npm install
npm run build
npm install -g pm2
pm2 start server.js --name kelasbrevet-coretax
pm2 save
pm2 startup
```

### 4. Reverse Proxy Nginx (dengan SSL Certbot)
```nginx
server {
    listen 80;
    server_name simulasi.kelasbrevet.id;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
