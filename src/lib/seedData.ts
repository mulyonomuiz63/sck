import {
  BillingCode,
  EBupotSlip,
  EFakturInvoice,
  GuidedCaseDefinition,
  LedgerEntry,
  SimulatorSnapshot,
  SptBadanTahunanPayload,
  SptOpTahunanPayload,
  SptPph21MasaPayload,
  SptPpnPayload,
  SptUnifikasiPayload,
  TaxWorkspace,
} from '../types/tax';

export const DEMO_NIK_TUAN_A = '3273011205900001';
export const DEFAULT_PASSPHRASE = 'kelasbrevet123';

export function createDefaultSptPpnPayload(): SptPpnPayload {
  return {
    a1EksporDpp: 0,
    a2KeluaranDpp: 0,
    a2KeluaranPpn: 0,
    a2DipungutSendiriPpn: 0,
    a2DipungutPemungutPpn: 0,
    a2TidakDipungutDpp: 0,
    b1ImporDpp: 0,
    b1ImporPpn: 0,
    b2MasukanKreditDpp: 0,
    b2MasukanKreditPpn: 0,
    b3TidakDikreditkanDpp: 0,
    b3TidakDikreditkanPpn: 0,
    cDipungutPihakLainPpn: 0,
    kompensasiMasaLalu: 0,
    ppnKms: 0,
    ppnbmTerutang: 0,
    overpaymentAction: 'KOMPENSASI',
    declarationChecked: false,
    linkedInvoiceIds: [],
  };
}

export function createDefaultSptPph21MasaPayload(): SptPph21MasaPayload {
  return {
    jumlahPegawaiTetap: 0,
    brutoPegawaiTetap: 0,
    pphPegawaiTetap: 0,
    jumlahBukanPegawai: 0,
    brutoBukanPegawai: 0,
    pphBukanPegawai: 0,
    jumlahBpa1: 0,
    pphBpa1: 0,
    kompensasiSebelumnya: 0,
    declarationChecked: false,
    linkedSlipIds: [],
  };
}

export function createDefaultSptUnifikasiPayload(): SptUnifikasiPayload {
  return {
    jumlahBppu: 0,
    dppPph23: 0,
    pph23Terutang: 0,
    dppPph4Ayat2: 0,
    pph4Ayat2Terutang: 0,
    dppPph22: 0,
    pph22Terutang: 0,
    declarationChecked: false,
    linkedSlipIds: [],
  };
}

export function createDefaultSptOpPayload(ptkp = 'TK/0'): SptOpTahunanPayload {
  return {
    sumberPenghasilan: 'PEKERJAAN',
    metodePembukuan: 'PENCATATAN',
    statusKewajibanSuamiIstri: 'KK',
    ptkpStatus: ptkp,
    hasPenghasilanPekerjaan: true,
    hasPenghasilanUsaha: false,
    hasPenghasilanFinal: false,
    hasPenghasilanBukanObjek: false,
    hasPenghasilanLN: false,
    hasZakatSumbangan: false,
    brutoPekerjaan: 0,
    biayaJabatan: 0,
    iuranPensiun: 0,
    peredaranBrutoUsaha: 0,
    normaPersen: 50,
    netoUsaha: 0,
    zakatSumbangan: 0,
    kreditPajakDipungut: 0,
    angsuranPph25: 0,
    hartaList: [],
    utangList: [],
    keluargaList: [],
    linkedSlipIds: [],
    penghasilanFinalList: [],
    penghasilanBukanObjekList: [],
    penghasilanLNBruto: 0,
    kreditPajakPph24: 0,
    declarationChecked: false,
  };
}

export function createTuanAPresetOpPayload(): SptOpTahunanPayload {
  return {
    postedAt: new Date().toISOString(),
    sumberPenghasilan: 'PEKERJAAN',
    metodePembukuan: 'PENCATATAN',
    statusKewajibanSuamiIstri: 'KK',
    ptkpStatus: 'TK/0',
    hasPenghasilanPekerjaan: true,
    hasPenghasilanUsaha: false,
    hasPenghasilanFinal: false,
    hasPenghasilanBukanObjek: false,
    hasPenghasilanLN: false,
    hasZakatSumbangan: false,
    brutoPekerjaan: 533_500_000,
    biayaJabatan: 6_000_000,
    iuranPensiun: 0,
    peredaranBrutoUsaha: 0,
    normaPersen: 50,
    netoUsaha: 0,
    zakatSumbangan: 0,
    kreditPajakDipungut: 87_375_000,
    angsuranPph25: 0,
    hartaList: [
      {
        id: 'harta_kas_1',
        subCategory: 'KAS',
        kodeHarta: '011',
        deskripsi: 'Tabungan Bank Nasional (Kas & Setara Kas)',
        tahunPerolehan: 2024,
        hargaPerolehan: 300_000_000,
        nilaiSaatIni: 300_000_000,
        keterangan: 'Rekening Pribadi Tuan A',
      },
      {
        id: 'harta_mobil_1',
        subCategory: 'HARTA_BERGERAK',
        kodeHarta: '043',
        deskripsi: 'Mobil Penumpang MPV 1500cc',
        tahunPerolehan: 2025,
        hargaPerolehan: 200_000_000,
        nilaiSaatIni: 200_000_000,
        keterangan: 'Kredit Bank',
      },
    ],
    utangList: [
      {
        id: 'utang_bank_1',
        kodeUtang: '101',
        namaPemberiPinjaman: 'Bank Mandiri / Lembaga Keuangan',
        tahunPinjam: 2025,
        saldoAkhir: 200_000_000,
      },
    ],
    keluargaList: [],
    linkedSlipIds: ['slip_bpa1_tuan_a'],
    penghasilanFinalList: [],
    penghasilanBukanObjekList: [],
    penghasilanLNBruto: 0,
    kreditPajakPph24: 0,
    declarationChecked: true,
  };
}

export function createDefaultSptBadanPayload(): SptBadanTahunanPayload {
  return {
    tahunBuku: '01/2025 - 12/2025',
    metodePenyusutan: 'GARIS_LURUS',
    peredaranUsaha: 0,
    hpp: 0,
    bebanUsaha: 0,
    penghasilanLuarUsaha: 0,
    bebanLuarUsaha: 0,
    koreksiList: [],
    kompensasiKerugian: 0,
    gunakanFasilitas31E: true,
    kreditPajakList: [],
    angsuranPph25Setahun: 0,
    declarationChecked: false,
  };
}

export function createPresetSptBadanPayload(): SptBadanTahunanPayload {
  return {
    postedAt: new Date().toISOString(),
    tahunBuku: '01/2025 - 12/2025',
    metodePenyusutan: 'GARIS_LURUS',
    peredaranUsaha: 12_000_000_000,
    hpp: 7_200_000_000,
    bebanUsaha: 3_150_000_000,
    penghasilanLuarUsaha: 120_000_000,
    bebanLuarUsaha: 70_000_000,
    koreksiList: [
      {
        id: 'kor_1',
        jenis: 'POSITIF',
        akun: 'Biaya Jamuan / Entertainment tanpa Daftar Nominatif',
        dasarHukum: 'Pasal 9 ayat (1) UU PPh',
        nilai: 85_000_000,
      },
      {
        id: 'kor_2',
        jenis: 'POSITIF',
        akun: 'Sanksi Administrasi Perpajakan (Denda/Bunga)',
        dasarHukum: 'Pasal 9 ayat (1) huruf k UU PPh',
        nilai: 25_000_000,
      },
      {
        id: 'kor_3',
        jenis: 'NEGATIF',
        akun: 'Pendapatan Bunga Deposito (Dikenakan PPh Final)',
        dasarHukum: 'Pasal 4 ayat (2) UU PPh',
        nilai: 60_000_000,
      },
    ],
    kompensasiKerugian: 0,
    gunakanFasilitas31E: true,
    kreditPajakList: [
      {
        id: 'kr_1',
        pasal: 'PPh 23',
        pemotong: 'PT Mitra Korporasi Indonesia',
        nomorBukti: 'BPPU-25-8821041',
        nilai: 42_000_000,
      },
      {
        id: 'kr_2',
        pasal: 'PPh 22',
        pemotong: 'DJBC — PPh 22 Impor API',
        nomorBukti: 'SSPCP-25-004192',
        nilai: 35_000_000,
      },
    ],
    angsuranPph25Setahun: 180_000_000,
    declarationChecked: true,
  };
}

export function createSeedSnapshot(nik: string, ownerId = 'local_user', customName?: string): SimulatorSnapshot {
  const cleanNik = nik.replace(/\D/g, '').padEnd(16, '0').slice(0, 16);
  const isTuanA = cleanNik === DEMO_NIK_TUAN_A;
  const workspaceId = `ws_${cleanNik}`;
  const nowIso = new Date().toISOString();

  const opName = customName?.trim() || (isTuanA ? 'TUAN A (PESERTA BREVET)' : `PESERTA BREVET ${cleanNik.slice(-4)}`);
  const badanNpwp = `03${cleanNik.slice(2, 12)}0910`;

  const workspace: TaxWorkspace = {
    id: workspaceId,
    ownerId,
    nik: cleanNik,
    opProfile: {
      nik: cleanNik,
      npwp: cleanNik,
      nama: opName,
      alamat: 'Jl. Pendidikan Perpajakan No. 45, Jakarta Selatan',
      klu: '96301 — Pegawai Swasta / Orang Pribadi',
      ptkp: 'TK/0',
      pekerjaan: 'Pegawai Tetap Swasta',
      email: 'peserta@kelasbrevet.simulasi',
      passphrase: DEFAULT_PASSPHRASE,
      depositBalance: 15_000_000,
    },
    badanProfile: {
      npwp: badanNpwp,
      nama: 'PT SIMULASI KELASBREVET NUSANTARA',
      alamat: 'Gedung Edukasi Pajak Lt. 8, Kawasan Bisnis Sudirman, Jakarta',
      klu: '62019 — Jasa Konsultansi & Perdagangan Umum',
      statusPkp: 'AKTIF',
      penanggungJawab: opName,
      passphrase: DEFAULT_PASSPHRASE,
      depositBalance: 150_000_000,
    },
    activeRole: 'OP',
    guidedMode: true,
    activeCaseId: 'case_pph21_tuan_a',
  };

  const efaktur: EFakturInvoice[] = [
    {
      id: `inv_in1_${cleanNik}`,
      ownerId,
      workspaceId,
      category: 'INPUT',
      transactionCode: '01',
      invoiceNumber: '010025812004511',
      invoiceDate: '2025-01-12',
      masaPajak: 1,
      tahunPajak: 2025,
      counterpartyNpwp: '0134567890123000',
      counterpartyName: 'PT SUMBER LOGISTIK PRIMA',
      status: 'APPROVED',
      creditStatus: 'UNCREDITED',
      dppTotal: 45_000_000,
      dppNilaiLain: 45_000_000,
      ppnTotal: 4_950_000,
      ppnbmTotal: 0,
      items: [
        {
          id: 'item_in_1',
          itemType: 'BARANG',
          itemCode: '010100',
          name: 'Perangkat Workstation & Server Kantor',
          unit: 'Unit',
          unitPrice: 15_000_000,
          qty: 3,
          discount: 0,
          dpp: 45_000_000,
          useDppNilaiLain: false,
          dppNilaiLain: 45_000_000,
          ppn: 4_950_000,
          ppnbm: 0,
        },
      ],
      referenceDoc: 'PO-KB-2025-001',
      sp2dNumber: '',
      amendmentOf: '',
      createdAtIso: nowIso,
    },
    {
      id: `inv_in2_${cleanNik}`,
      ownerId,
      workspaceId,
      category: 'INPUT',
      transactionCode: '01',
      invoiceNumber: '010025812009822',
      invoiceDate: '2025-01-18',
      masaPajak: 1,
      tahunPajak: 2025,
      counterpartyNpwp: '0298765432109000',
      counterpartyName: 'PT DIGITAL INFRASTRUKTUR JAYA',
      status: 'APPROVED',
      creditStatus: 'CREDITED',
      dppTotal: 25_000_000,
      dppNilaiLain: 25_000_000,
      ppnTotal: 2_750_000,
      ppnbmTotal: 0,
      items: [
        {
          id: 'item_in_2',
          itemType: 'JASA',
          itemCode: '220200',
          name: 'Layanan Lisensi Cloud & Keamanan Jaringan',
          unit: 'Paket',
          unitPrice: 25_000_000,
          qty: 1,
          discount: 0,
          dpp: 25_000_000,
          useDppNilaiLain: false,
          dppNilaiLain: 25_000_000,
          ppn: 2_750_000,
          ppnbm: 0,
        },
      ],
      referenceDoc: 'INV-DIJ-2025-018',
      sp2dNumber: '',
      amendmentOf: '',
      createdAtIso: nowIso,
    },
    {
      id: `inv_out1_${cleanNik}`,
      ownerId,
      workspaceId,
      category: 'OUTPUT',
      transactionCode: '01',
      invoiceNumber: 'DRAFT-001',
      invoiceDate: '2025-01-20',
      masaPajak: 1,
      tahunPajak: 2025,
      counterpartyNpwp: '0344556677889000',
      counterpartyName: 'PT KARYA MANDIRI SEJAHTERA',
      status: 'CREATED',
      creditStatus: 'NA',
      dppTotal: 100_000_000,
      dppNilaiLain: 100_000_000,
      ppnTotal: 11_000_000,
      ppnbmTotal: 0,
      items: [
        {
          id: 'item_out_1',
          itemType: 'JASA',
          itemCode: '210100',
          name: 'Jasa Implementasi Sistem Akuntansi & Pajak',
          unit: 'Paket',
          unitPrice: 100_000_000,
          qty: 1,
          discount: 0,
          dpp: 100_000_000,
          useDppNilaiLain: false,
          dppNilaiLain: 100_000_000,
          ppn: 11_000_000,
          ppnbm: 0,
        },
      ],
      referenceDoc: 'INV-KB-2025-001',
      sp2dNumber: '',
      amendmentOf: '',
      createdAtIso: nowIso,
    },
  ];

  const ebupot: EBupotSlip[] = [
    // Bukti Potong BPA1 Tuan A (muncul di Dokumen Saya OP & dipakai untuk Posting SPT Tahunan OP)
    {
      id: `slip_bpa1_${cleanNik}`,
      ownerId,
      workspaceId,
      slipType: 'BPA1',
      slipNumber: 'BPA1-25-0001721',
      masaPajak: 12,
      tahunPajak: 2025,
      recipientNik: cleanNik,
      recipientName: opName,
      ptkpStatus: 'TK/0',
      terCategory: 'A',
      objectCode: '21-100-01',
      objectName: 'Pegawai Tetap (Bukti Potong Tahunan A1 — Jan s.d. Des 2025)',
      grossAmount: 533_500_000,
      taxRate: 16.38,
      pphAmount: 87_375_000,
      referenceDoc: '1.1-12.25-0000017',
      status: 'TELAH_TERBIT',
      issuerNpwp: '0188899900112000',
      issuerName: 'PT MAJU BERSAMA SEJAHTERA',
      createdAtIso: nowIso,
    },
    // Sample e-Bupot MP (Pegawai Tetap TER) milik PT Simulasi — siap diterbitkan atau ditambah
    {
      id: `slip_mp1_${cleanNik}`,
      ownerId,
      workspaceId,
      slipType: 'MP',
      slipNumber: 'DRAFT-MP-001',
      masaPajak: 1,
      tahunPajak: 2025,
      recipientNik: '3174012208920004',
      recipientName: 'BUDI SANTOSO',
      ptkpStatus: 'K/1',
      terCategory: 'B',
      objectCode: '21-100-01',
      objectName: 'Pegawai Tetap (TER Bulanan)',
      grossAmount: 15_000_000,
      taxRate: 6,
      pphAmount: 900_000,
      referenceDoc: 'PAYROLL-JAN-2025',
      status: 'BELUM_TERBIT',
      issuerNpwp: badanNpwp,
      issuerName: workspace.badanProfile.nama,
      createdAtIso: nowIso,
    },
    // Sample e-Bupot BPPU PPh 23 milik PT Simulasi
    {
      id: `slip_bppu1_${cleanNik}`,
      ownerId,
      workspaceId,
      slipType: 'BPPU',
      slipNumber: 'BPPU-25-2410429',
      masaPajak: 1,
      tahunPajak: 2025,
      recipientNik: '0255566677889000',
      recipientName: 'CV KONSULTAN PAJAK NUSANTARA',
      ptkpStatus: 'NA',
      terCategory: 'NA',
      objectCode: '24-104-29',
      objectName: 'Jasa Konsultan / Manajemen',
      grossAmount: 30_000_000,
      taxRate: 2,
      pphAmount: 600_000,
      referenceDoc: 'SPK-2025/KB/014',
      status: 'TELAH_TERBIT',
      issuerNpwp: badanNpwp,
      issuerName: workspace.badanProfile.nama,
      createdAtIso: nowIso,
    },
  ];

  const billing: BillingCode[] = [];

  const ledger: LedgerEntry[] = [
    {
      id: `led_op_${cleanNik}`,
      ownerId,
      workspaceId,
      taxpayerRole: 'OP',
      entryDate: '2025-01-05',
      entryType: 'DEPOSIT_TOPUP',
      referenceNumber: 'NTPN-DEP-OP001',
      description: 'Saldo Awal Deposit Pajak Simulasi KelasBrevet (OP)',
      debit: 0,
      credit: 15_000_000,
      balanceAfter: 15_000_000,
      createdAtIso: nowIso,
    },
    {
      id: `led_bd_${cleanNik}`,
      ownerId,
      workspaceId,
      taxpayerRole: 'BADAN',
      entryDate: '2025-01-05',
      entryType: 'DEPOSIT_TOPUP',
      referenceNumber: 'NTPN-DEP-BD001',
      description: 'Saldo Awal Deposit Pajak Simulasi KelasBrevet (PT Simulasi)',
      debit: 0,
      credit: 150_000_000,
      balanceAfter: 150_000_000,
      createdAtIso: nowIso,
    },
  ];

  return {
    workspace,
    efaktur,
    ebupot,
    taxReturns: [],
    billing,
    ledger,
  };
}

export const GUIDED_CASES: GuidedCaseDefinition[] = [
  {
    id: 'case_pph21_tuan_a',
    moduleCode: 'Modul 2',
    title: 'SPT Tahunan PPh 21 Karyawan (Kasus Tuan A)',
    summary:
      'Praktik pelaporan SPT Tahunan OP Karyawan status Nihil sesuai PDF: cek Bukti Potong BPA1 (Bruto Rp533,5 jt, PPh Rp87,375 jt), buat konsep SPT 2025, Posting SPT, lengkapi Harta & Utang di L-1, lalu lapor hingga BPE terbit.',
    recommendedRole: 'OP',
    steps: [
      {
        id: 'step_op_1',
        title: '1. Pastikan peran Akun Utama (Orang Pribadi)',
        instruction: 'Gunakan pemilih akun di kanan atas dan pastikan peran aktif adalah Orang Pribadi (OP).',
        targetNav: 'portal_saya',
        requiredRole: 'OP',
        check: (s) => s.workspace.activeRole === 'OP',
      },
      {
        id: 'step_op_2',
        title: '2. Buat Konsep SPT Tahunan OP 2025',
        instruction: 'Buka menu Surat Pemberitahuan (SPT) → klik Buat Konsep SPT → pilih PPh Orang Pribadi Tahun 2025.',
        targetNav: 'spt',
        requiredRole: 'OP',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH_OP_TAHUNAN'),
      },
      {
        id: 'step_op_3',
        title: '3. Jalankan Posting SPT & Lengkapi Harta/Utang (L-1)',
        instruction:
          'Di dalam editor SPT Tahunan OP, klik Posting SPT (atau Muat Preset Tuan A) untuk menarik BPA1 Rp87.375.000 serta mengisi Harta (Kas Rp300 jt & Mobil Rp200 jt) dan Utang (Bank Rp200 jt).',
        targetNav: 'spt',
        requiredRole: 'OP',
        check: (s) =>
          s.taxReturns.some((r) => {
            if (r.returnType !== 'PPH_OP_TAHUNAN') return false;
            const p = r.payload as SptOpTahunanPayload;
            return p.brutoPekerjaan > 0 && p.hartaList.length > 0;
          }),
      },
      {
        id: 'step_op_4',
        title: '4. Tandatangani (TTE) & Laporkan hingga BPE Terbit',
        instruction:
          'Centang pernyataan di Bagian K, klik Bayar dan Lapor, masukkan passphrase kelasbrevet123, lalu lihat BPE pada tab SPT Dilaporkan.',
        targetNav: 'spt',
        requiredRole: 'OP',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH_OP_TAHUNAN' && r.status === 'DILAPORKAN'),
      },
    ],
  },
  {
    id: 'case_ppn_masa',
    moduleCode: 'Modul 1',
    title: 'e-Faktur & SPT Masa PPN (PT Simulasi)',
    summary:
      'Praktik penuh PPN: Impersonate ke PT Simulasi, terbitkan Faktur Keluaran (APPROVED + NSFP), kreditkan Pajak Masukan, Posting ke SPT Masa PPN (Lampiran A-1 s.d. C), dan selesaikan pembayaran Kurang Bayar.',
    recommendedRole: 'BADAN',
    steps: [
      {
        id: 'step_ppn_1',
        title: '1. Lakukan Impersonate ke WP Badan',
        instruction: 'Klik pemilih akun di pojok kanan atas dan pilih PT SIMULASI KELASBREVET NUSANTARA.',
        targetNav: 'efaktur',
        requiredRole: 'BADAN',
        check: (s) => s.workspace.activeRole === 'BADAN',
      },
      {
        id: 'step_ppn_2',
        title: '2. Submit & TTE minimal 1 Faktur Keluaran (APPROVED)',
        instruction:
          'Di menu e-Faktur → Pajak Keluaran, klik Submit & TTE pada draft faktur (atau buat faktur baru Kode 01–10) hingga berstatus APPROVED.',
        targetNav: 'efaktur',
        requiredRole: 'BADAN',
        check: (s) => s.efaktur.some((inv) => inv.category === 'OUTPUT' && inv.status === 'APPROVED'),
      },
      {
        id: 'step_ppn_3',
        title: '3. Kreditkan Pajak Masukan',
        instruction: 'Buka tab Pajak Masukan lalu klik Kreditkan pada faktur masukan yang belum dikreditkan.',
        targetNav: 'efaktur',
        requiredRole: 'BADAN',
        check: (s) =>
          s.efaktur.filter((inv) => inv.category === 'INPUT' && inv.creditStatus === 'CREDITED').length >= 2,
      },
      {
        id: 'step_ppn_4',
        title: '4. Buat Konsep, Posting & Laporkan SPT Masa PPN',
        instruction:
          'Buka menu SPT → Buat Konsep SPT Masa PPN Masa Januari 2025 → klik Posting SPT → periksa Lampiran A-2 & B-2 → klik Bayar dan Lapor (Deposit atau Kode Billing).',
        targetNav: 'spt',
        requiredRole: 'BADAN',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPN' && r.status === 'DILAPORKAN'),
      },
    ],
  },
  {
    id: 'case_ebupot_21_23',
    moduleCode: 'Modul 3',
    title: 'e-Bupot MP (TER) & BPPU PPh 23 + SPT Masa',
    summary:
      'Praktik pemotongan pajak perusahaan: terbitkan e-Bupot Bulanan Pegawai Tetap (TER) dan e-Bupot Unifikasi PPh 23 (tarif 2%), lalu laporkan SPT Masa PPh 21/26 dan SPT Masa PPh Unifikasi.',
    recommendedRole: 'BADAN',
    steps: [
      {
        id: 'step_bp_1',
        title: '1. Terbitkan e-Bupot MP (Pegawai Tetap TER)',
        instruction:
          'Masuk e-Bupot (akun Badan) → tab MP Pegawai Tetap → centang draft e-Bupot MP atau buat baru → klik Terbitkan (TTE) hingga status TELAH_TERBIT.',
        targetNav: 'ebupot',
        requiredRole: 'BADAN',
        check: (s) => s.ebupot.some((sl) => sl.slipType === 'MP' && sl.status === 'TELAH_TERBIT'),
      },
      {
        id: 'step_bp_2',
        title: '2. Buat & Terbitkan e-Bupot BPPU (PPh 23)',
        instruction:
          'Buka tab BPPU (PPh 23), buat bukti potong jasa (misal kode 24-104-29 tarif 2%) atau verifikasi slip terbit.',
        targetNav: 'ebupot',
        requiredRole: 'BADAN',
        check: (s) => s.ebupot.filter((sl) => sl.slipType === 'BPPU' && sl.status === 'TELAH_TERBIT').length >= 1,
      },
      {
        id: 'step_bp_3',
        title: '3. Laporkan SPT Masa PPh 21/26',
        instruction:
          'Buka menu SPT → Buat Konsep SPT Masa PPh 21/26 Masa Januari 2025 → klik Posting SPT → Bayar dan Lapor.',
        targetNav: 'spt',
        requiredRole: 'BADAN',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH21_MASA' && r.status === 'DILAPORKAN'),
      },
      {
        id: 'step_bp_4',
        title: '4. Laporkan SPT Masa PPh Unifikasi (PPh 23)',
        instruction:
          'Buat Konsep SPT Masa PPh Unifikasi Masa Januari 2025 → klik Posting SPT → Bayar dan Lapor hingga BPE terbit.',
        targetNav: 'spt',
        requiredRole: 'BADAN',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH_UNIFIKASI' && r.status === 'DILAPORKAN'),
      },
    ],
  },
  {
    id: 'case_op_umum',
    moduleCode: 'Modul 4',
    title: 'SPT Tahunan Orang Pribadi (Usaha / Penghasilan Tambahan)',
    summary:
      'Simulasi WP OP dengan penghasilan tambahan (usaha/pekerjaan bebas atau penghasilan final UMKM di Lampiran L-2) hingga penyelesaian pembayaran jika Kurang Bayar.',
    recommendedRole: 'OP',
    steps: [
      {
        id: 'step_opu_1',
        title: '1. Aktifkan akun Orang Pribadi (OP)',
        instruction: 'Pastikan peran aktif adalah Orang Pribadi.',
        targetNav: 'spt',
        requiredRole: 'OP',
        check: (s) => s.workspace.activeRole === 'OP',
      },
      {
        id: 'step_opu_2',
        title: '2. Isi Penghasilan Usaha / Lampiran L-2 (Final/Bukan Objek)',
        instruction:
          'Pada Konsep SPT Tahunan OP, aktifkan pertanyaan Penghasilan Usaha/Bebas atau Penghasilan Final (L-2) lalu tambahkan minimal 1 baris data.',
        targetNav: 'spt',
        requiredRole: 'OP',
        check: (s) =>
          s.taxReturns.some((r) => {
            if (r.returnType !== 'PPH_OP_TAHUNAN') return false;
            const p = r.payload as SptOpTahunanPayload;
            return p.hasPenghasilanUsaha || p.penghasilanFinalList.length > 0;
          }),
      },
      {
        id: 'step_opu_3',
        title: '3. Lapor & Verifikasi BPE di Dokumen Saya',
        instruction: 'Selesaikan pelaporan SPT Tahunan OP dan unduh/cetak BPE.',
        targetNav: 'portal_saya',
        requiredRole: 'OP',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH_OP_TAHUNAN' && r.status === 'DILAPORKAN'),
      },
    ],
  },
  {
    id: 'case_pph_badan',
    moduleCode: 'Modul 5',
    title: 'SPT Tahunan PPh Badan Lengkap (Laba Rugi & Rekonsiliasi Fiskal)',
    summary:
      'Praktik menyusun SPT Tahunan PPh Badan: input Laba Rugi Komersial, Rekonsiliasi Fiskal (koreksi positif/negatif), tarif 22% / Pasal 31E, Kredit Pajak (PPh 22/23/25), serta pelunasan PPh Pasal 29.',
    recommendedRole: 'BADAN',
    steps: [
      {
        id: 'step_bdn_1',
        title: '1. Impersonate ke PT Simulasi & Buat Konsep SPT PPh Badan',
        instruction: 'Gunakan peran WP Badan → menu SPT → Buat Konsep SPT Tahunan PPh Badan 2025.',
        targetNav: 'spt',
        requiredRole: 'BADAN',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH_BADAN_TAHUNAN'),
      },
      {
        id: 'step_bdn_2',
        title: '2. Lengkapi Laba Rugi & Rekonsiliasi Fiskal',
        instruction:
          'Isi Peredaran Usaha, HPP, Beban Usaha, serta Koreksi Fiskal Positif/Negatif (atau gunakan tombol Muat Studi Kasus PT Simulasi).',
        targetNav: 'spt',
        requiredRole: 'BADAN',
        check: (s) =>
          s.taxReturns.some((r) => {
            if (r.returnType !== 'PPH_BADAN_TAHUNAN') return false;
            const p = r.payload as SptBadanTahunanPayload;
            return p.peredaranUsaha > 0 && p.koreksiList.length > 0;
          }),
      },
      {
        id: 'step_bdn_3',
        title: '3. Bayar PPh Pasal 29 & Laporkan SPT PPh Badan',
        instruction:
          'Periksa PPh Terutang (Pasal 31E / 22%) dikurangi Kredit Pajak, lalu klik Bayar dan Lapor (Deposit atau Kode Billing) hingga berstatus DILAPORKAN.',
        targetNav: 'spt',
        requiredRole: 'BADAN',
        check: (s) => s.taxReturns.some((r) => r.returnType === 'PPH_BADAN_TAHUNAN' && r.status === 'DILAPORKAN'),
      },
    ],
  },
];
