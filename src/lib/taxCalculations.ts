import { SptBadanTahunanPayload, SptOpTahunanPayload } from '../types/tax';

export const MASA_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const PTKP_VALUES: Record<string, number> = {
  'TK/0': 54_000_000,
  'TK/1': 58_500_000,
  'TK/2': 63_000_000,
  'TK/3': 67_500_000,
  'K/0': 58_500_000,
  'K/1': 63_000_000,
  'K/2': 67_500_000,
  'K/3': 72_000_000,
};

export const EFAKTUR_TRANSACTION_CODES = [
  { code: '01', label: '01 — Kepada selain Pemungut PPN (Normal)' },
  { code: '02', label: '02 — Kepada Pemungut PPN Instansi Pemerintah (SP2D)' },
  { code: '03', label: '03 — Kepada Pemungut PPN Lainnya (BUMN/KKS)' },
  { code: '04', label: '04 — DPP Nilai Lain' },
  { code: '05', label: '05 — Besaran Tertentu' },
  { code: '06', label: '06 — Penyerahan Lainnya (Turis Asing/dll)' },
  { code: '07', label: '07 — PPN Tidak Dipungut / DTP (Kawasan Berikat)' },
  { code: '08', label: '08 — PPN Dibebaskan' },
  { code: '09', label: '09 — Penyerahan Aktiva Pasal 16D' },
  { code: '10', label: '10 — Penyerahan Lainnya Tertentu' },
];

export const EFAKTUR_ITEM_CODES = [
  { code: '000000', type: 'BARANG' as const, name: 'Barang Umum / Dagangan' },
  { code: '010100', type: 'BARANG' as const, name: 'Perangkat Komputer & Elektronik Kantor' },
  { code: '020300', type: 'BARANG' as const, name: 'Perlengkapan & Mesin Industri' },
  { code: '030500', type: 'BARANG' as const, name: 'Bahan Baku Manufaktur & Logistik' },
  { code: '040100', type: 'BARANG' as const, name: 'Kendaraan Bermotor & Suku Cadang' },
  { code: '210100', type: 'JASA' as const, name: 'Jasa Konsultansi Manajemen & Pajak' },
  { code: '220200', type: 'JASA' as const, name: 'Jasa Pengembangan Perangkat Lunak & TI' },
  { code: '230400', type: 'JASA' as const, name: 'Jasa Pelatihan, Seminar & Sertifikasi' },
  { code: '240100', type: 'JASA' as const, name: 'Jasa Perawatan & Perbaikan Peralatan' },
];

export const PPH23_OBJECT_CODES = [
  { code: '24-104-29', name: 'Jasa Konsultan / Manajemen', rate: 2 },
  { code: '24-104-01', name: 'Jasa Teknik', rate: 2 },
  { code: '24-104-04', name: 'Jasa Akuntansi, Pembukuan & Atestasi', rate: 2 },
  { code: '24-104-37', name: 'Jasa Perawatan / Perbaikan / Pemeliharaan', rate: 2 },
  { code: '24-104-50', name: 'Jasa Penyelenggara Kegiatan (Event Organizer)', rate: 2 },
  { code: '24-100-02', name: 'Sewa & Penghasilan Sehubungan Penggunaan Harta', rate: 2 },
  { code: '24-104-21', name: 'Jasa Perancang / Desain & Pembuatan Web', rate: 2 },
];

export const PPH21_OBJECT_CODES = [
  { code: '21-100-01', name: 'Pegawai Tetap (TER Bulanan)', slipType: 'MP' as const },
  { code: '21-100-07', name: 'Tenaga Ahli (Bukan Pegawai)', slipType: 'BP21' as const },
  { code: '21-100-09', name: 'Imbalan Bukan Pegawai Bersifat Tidak Berkesinambungan', slipType: 'BP21' as const },
  { code: '21-100-10', name: 'Honorarium / Peserta Kegiatan', slipType: 'BP21' as const },
];

export function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const prefix = safe < 0 ? '-Rp ' : 'Rp ';
  return prefix + Math.abs(safe).toLocaleString('id-ID');
}

export function formatNumber(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return safe.toLocaleString('id-ID');
}

export function formatNpwp16(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  if (digits.length < 16) return digits || '-';
  return `${digits.slice(0, 4)}.${digits.slice(4, 8)}.${digits.slice(8, 12)}.${digits.slice(12, 16)}`;
}

// PP 58/2023 TER Category mapping from PTKP
export function getTerCategory(ptkp: string): 'A' | 'B' | 'C' {
  if (['TK/0', 'TK/1', 'K/0'].includes(ptkp)) return 'A';
  if (['TK/2', 'TK/3', 'K/1', 'K/2'].includes(ptkp)) return 'B';
  return 'C';
}

// Representative PP 58/2023 TER Bulanan Brackets (percent)
const TER_BRACKETS: Record<'A' | 'B' | 'C', [number, number][]> = {
  A: [
    [5_400_000, 0],
    [5_650_000, 0.25],
    [5_950_000, 0.5],
    [6_300_000, 0.75],
    [6_750_000, 1],
    [7_500_000, 1.25],
    [8_550_000, 1.5],
    [9_650_000, 1.75],
    [10_050_000, 2],
    [10_350_000, 2.25],
    [10_700_000, 2.5],
    [11_050_000, 3],
    [11_600_000, 3.5],
    [12_500_000, 4],
    [13_750_000, 5],
    [15_100_000, 6],
    [16_950_000, 7],
    [19_750_000, 8],
    [24_150_000, 9],
    [26_450_000, 10],
    [28_000_000, 11],
    [30_050_000, 12],
    [32_400_000, 13],
    [35_400_000, 14],
    [39_100_000, 15],
    [43_850_000, 16],
    [47_800_000, 17],
    [51_400_000, 18],
    [56_300_000, 19],
    [62_200_000, 20],
    [68_600_000, 21],
    [77_500_000, 22],
    [89_000_000, 23],
    [103_000_000, 24],
    [125_000_000, 25],
    [157_000_000, 26],
    [206_000_000, 27],
    [337_000_000, 28],
    [454_000_000, 29],
    [550_000_000, 30],
    [695_000_000, 31],
    [910_000_000, 32],
    [1_400_000_000, 33],
    [Number.POSITIVE_INFINITY, 34],
  ],
  B: [
    [6_200_000, 0],
    [6_500_000, 0.25],
    [6_850_000, 0.5],
    [7_300_000, 0.75],
    [9_200_000, 1],
    [10_750_000, 1.5],
    [11_250_000, 2],
    [11_600_000, 2.5],
    [12_600_000, 3],
    [13_600_000, 4],
    [14_950_000, 5],
    [16_400_000, 6],
    [18_450_000, 7],
    [21_850_000, 8],
    [26_000_000, 9],
    [27_700_000, 10],
    [29_350_000, 11],
    [31_450_000, 12],
    [33_950_000, 13],
    [37_100_000, 14],
    [41_100_000, 15],
    [45_800_000, 16],
    [49_500_000, 17],
    [53_800_000, 18],
    [58_500_000, 19],
    [64_000_000, 20],
    [71_000_000, 21],
    [80_000_000, 22],
    [93_000_000, 23],
    [109_000_000, 24],
    [129_000_000, 25],
    [163_000_000, 26],
    [211_000_000, 27],
    [374_000_000, 28],
    [459_000_000, 29],
    [555_000_000, 30],
    [704_000_000, 31],
    [957_000_000, 32],
    [1_405_000_000, 33],
    [Number.POSITIVE_INFINITY, 34],
  ],
  C: [
    [6_600_000, 0],
    [6_950_000, 0.25],
    [7_350_000, 0.5],
    [7_800_000, 0.75],
    [8_850_000, 1],
    [9_800_000, 1.25],
    [10_950_000, 1.5],
    [11_200_000, 1.75],
    [12_050_000, 2],
    [12_950_000, 3],
    [14_150_000, 4],
    [15_550_000, 5],
    [17_050_000, 6],
    [19_500_000, 7],
    [22_700_000, 8],
    [26_600_000, 9],
    [28_100_000, 10],
    [30_100_000, 11],
    [32_600_000, 12],
    [35_400_000, 13],
    [38_900_000, 14],
    [43_000_000, 15],
    [47_400_000, 16],
    [51_200_000, 17],
    [55_800_000, 18],
    [60_400_000, 19],
    [66_700_000, 20],
    [74_500_000, 21],
    [83_200_000, 22],
    [95_600_000, 23],
    [110_400_000, 24],
    [134_000_000, 25],
    [169_000_000, 26],
    [221_000_000, 27],
    [390_000_000, 28],
    [463_000_000, 29],
    [561_000_000, 30],
    [709_000_000, 31],
    [965_000_000, 32],
    [1_419_000_000, 33],
    [Number.POSITIVE_INFINITY, 34],
  ],
};

export function calculateTerPph21(grossMonthly: number, ptkp: string): {
  category: 'A' | 'B' | 'C';
  ratePercent: number;
  pph: number;
} {
  const category = getTerCategory(ptkp);
  const brackets = TER_BRACKETS[category];
  let ratePercent = 0;
  for (const [maxGross, rate] of brackets) {
    if (grossMonthly <= maxGross) {
      ratePercent = rate;
      break;
    }
  }
  const pph = Math.floor((grossMonthly * ratePercent) / 100);
  return { category, ratePercent, pph };
}

// Progressive Pasal 17 UU HPP
export function calculatePasal17Op(pkpRaw: number): {
  pkpRounded: number;
  pphTerutang: number;
  layers: { label: string; base: number; rate: number; tax: number }[];
} {
  // PKP dibulatkan ribuan ke bawah
  const pkpRounded = Math.max(0, Math.floor(pkpRaw / 1000) * 1000);
  let remaining = pkpRounded;
  const layerSpecs = [
    { label: 'Lapisan I (s.d. Rp60.000.000)', limit: 60_000_000, rate: 5 },
    { label: 'Lapisan II (Rp60 jt – Rp250 jt)', limit: 190_000_000, rate: 15 },
    { label: 'Lapisan III (Rp250 jt – Rp500 jt)', limit: 250_000_000, rate: 25 },
    { label: 'Lapisan IV (Rp500 jt – Rp5 M)', limit: 4_500_000_000, rate: 30 },
    { label: 'Lapisan V (di atas Rp5 M)', limit: Number.POSITIVE_INFINITY, rate: 35 },
  ];

  const layers: { label: string; base: number; rate: number; tax: number }[] = [];
  let totalTax = 0;
  for (const spec of layerSpecs) {
    if (remaining <= 0) break;
    const base = Math.min(remaining, spec.limit);
    const tax = Math.floor((base * spec.rate) / 100);
    layers.push({ label: spec.label, base, rate: spec.rate, tax });
    totalTax += tax;
    remaining -= base;
  }

  return { pkpRounded, pphTerutang: totalTax, layers };
}

export function calculateSptOpSummary(payload: SptOpTahunanPayload) {
  const netoPekerjaan = payload.hasPenghasilanPekerjaan
    ? Math.max(0, payload.brutoPekerjaan - payload.biayaJabatan - payload.iuranPensiun)
    : 0;
  const netoUsaha = payload.hasPenghasilanUsaha
    ? payload.metodePembukuan === 'PENCATATAN'
      ? Math.round((payload.peredaranBrutoUsaha * payload.normaPersen) / 100)
      : payload.netoUsaha
    : 0;
  const netoLN = payload.hasPenghasilanLN ? payload.penghasilanLNBruto : 0;
  const totalPenghasilanNeto = netoPekerjaan + netoUsaha + netoLN;
  const zakat = payload.hasZakatSumbangan ? payload.zakatSumbangan : 0;
  const netoSetelahZakat = Math.max(0, totalPenghasilanNeto - zakat);
  const ptkp = PTKP_VALUES[payload.ptkpStatus] ?? 54_000_000;
  const pkpRaw = Math.max(0, netoSetelahZakat - ptkp);
  const pasal17 = calculatePasal17Op(pkpRaw);
  const kreditLN = payload.hasPenghasilanLN ? payload.kreditPajakPph24 : 0;
  const totalKredit = payload.kreditPajakDipungut + payload.angsuranPph25 + kreditLN;
  const selisih = pasal17.pphTerutang - totalKredit;

  const totalHarta = payload.hartaList.reduce((acc, h) => acc + (Number(h.nilaiSaatIni) || 0), 0);
  const totalUtang = payload.utangList.reduce((acc, u) => acc + (Number(u.saldoAkhir) || 0), 0);
  const totalPphFinal = payload.penghasilanFinalList.reduce((acc, f) => acc + (Number(f.pphTerutang) || 0), 0);

  return {
    netoPekerjaan,
    netoUsaha,
    netoLN,
    totalPenghasilanNeto,
    netoSetelahZakat,
    ptkp,
    pkpRounded: pasal17.pkpRounded,
    pphTerutang: pasal17.pphTerutang,
    layers: pasal17.layers,
    totalKredit,
    selisih, // >0 Kurang Bayar, 0 Nihil, <0 Lebih Bayar
    taxPosition: selisih > 0 ? ('KURANG_BAYAR' as const) : selisih < 0 ? ('LEBIH_BAYAR' as const) : ('NIHIL' as const),
    amountDue: Math.abs(selisih),
    totalHarta,
    totalUtang,
    totalPphFinal,
  };
}

export function calculateSptBadanSummary(payload: SptBadanTahunanPayload) {
  const labaBruto = payload.peredaranUsaha - payload.hpp;
  const labaUsaha = labaBruto - payload.bebanUsaha;
  const labaKomersial = labaUsaha + payload.penghasilanLuarUsaha - payload.bebanLuarUsaha;

  const totalKoreksiPositif = payload.koreksiList
    .filter((k) => k.jenis === 'POSITIF')
    .reduce((acc, k) => acc + (Number(k.nilai) || 0), 0);
  const totalKoreksiNegatif = payload.koreksiList
    .filter((k) => k.jenis === 'NEGATIF')
    .reduce((acc, k) => acc + (Number(k.nilai) || 0), 0);

  const penghasilanNetoFiskal = labaKomersial + totalKoreksiPositif - totalKoreksiNegatif;
  const pkpRaw = Math.max(0, penghasilanNetoFiskal - payload.kompensasiKerugian);
  const pkpRounded = Math.floor(pkpRaw / 1000) * 1000;

  // PPh Badan Tarif 22% & Fasilitas Pasal 31E (diskon 50% -> 11% untuk bagian peredaran <= 4,8M jika total peredaran <= 50M)
  let pkpFasilitas = 0;
  let pkpNonFasilitas = pkpRounded;
  const eligible31E = payload.gunakanFasilitas31E && payload.peredaranUsaha > 0 && payload.peredaranUsaha <= 50_000_000_000;

  if (eligible31E) {
    if (payload.peredaranUsaha <= 4_800_000_000) {
      pkpFasilitas = pkpRounded;
      pkpNonFasilitas = 0;
    } else {
      pkpFasilitas = Math.floor((4_800_000_000 / payload.peredaranUsaha) * pkpRounded);
      pkpNonFasilitas = Math.max(0, pkpRounded - pkpFasilitas);
    }
  }

  const pphFasilitas = Math.floor(pkpFasilitas * 0.11);
  const pphNonFasilitas = Math.floor(pkpNonFasilitas * 0.22);
  const pphTerutang = pphFasilitas + pphNonFasilitas;

  const totalKreditBuktiPotong = payload.kreditPajakList.reduce((acc, c) => acc + (Number(c.nilai) || 0), 0);
  const totalKreditPajak = totalKreditBuktiPotong + payload.angsuranPph25Setahun;
  const selisih = pphTerutang - totalKreditPajak;

  return {
    labaBruto,
    labaUsaha,
    labaKomersial,
    totalKoreksiPositif,
    totalKoreksiNegatif,
    penghasilanNetoFiskal,
    pkpRounded,
    eligible31E,
    pkpFasilitas,
    pkpNonFasilitas,
    pphFasilitas,
    pphNonFasilitas,
    pphTerutang,
    totalKreditBuktiPotong,
    totalKreditPajak,
    selisih,
    taxPosition: selisih > 0 ? ('KURANG_BAYAR' as const) : selisih < 0 ? ('LEBIH_BAYAR' as const) : ('NIHIL' as const),
    amountDue: Math.abs(selisih),
  };
}

export function generateNsfp(transactionCode: string, isAmended = false): string {
  const code = (transactionCode || '01').padStart(2, '0');
  const statusDigit = isAmended ? '1' : '0';
  const rand = Math.floor(100000000 + Math.random() * 899999999);
  return `${code}${statusDigit}025${rand}`;
}

export function generateSlipNumber(prefix: string): string {
  const rand = Math.floor(1000000 + Math.random() * 8999999);
  return `${prefix}-25-${rand}`;
}

export function generateBpeNumber(): string {
  const rand1 = Math.floor(100000 + Math.random() * 899999);
  const rand2 = Math.floor(10000000 + Math.random() * 89999999);
  return `BPE-KB-${rand1}-${rand2}`;
}

export function generateBillingNumber(): string {
  let num = '025';
  for (let i = 0; i < 12; i++) {
    num += Math.floor(Math.random() * 10).toString();
  }
  return num;
}

export function generateNtpn(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
