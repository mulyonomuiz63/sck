import {
  ExamCase,
  ExamRubricRule,
  ExamRuleResult,
  SimulatorSnapshot,
  SptBadanTahunanPayload,
  SptOpTahunanPayload,
  TaxReturn,
} from '../types/tax.ts';

function fmtRp(n: number): string {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

function matchPeriod(
  itemMasa: number,
  itemTahun: number,
  ruleMasa?: number,
  ruleTahun?: number
): boolean {
  if (ruleMasa && ruleMasa > 0 && itemMasa !== ruleMasa) return false;
  if (ruleTahun && ruleTahun > 0 && itemTahun !== ruleTahun) return false;
  return true;
}

function findMatchingReturns(snapshot: SimulatorSnapshot, rule: ExamRubricRule): TaxReturn[] {
  return snapshot.taxReturns.filter((r) => {
    if (rule.returnType && r.returnType !== rule.returnType) return false;
    if (!matchPeriod(r.masaPajak, r.tahunPajak, rule.masaPajak, rule.tahunPajak)) return false;
    return true;
  });
}

function evaluateRule(snapshot: SimulatorSnapshot, rule: ExamRubricRule): ExamRuleResult {
  const weight = Math.max(0, Math.round(Number(rule.weight) || 0));
  const tol = rule.tolerance ?? 100;

  switch (rule.type) {
    case 'EFAKTUR_OUTPUT_APPROVED_MIN': {
      const min = rule.minCount ?? 1;
      const matches = snapshot.efaktur.filter(
        (i) =>
          (i.category === 'OUTPUT' || i.category === 'SPECIAL_OUTPUT') &&
          (i.status === 'APPROVED' || i.status === 'AMENDED') &&
          matchPeriod(i.masaPajak, i.tahunPajak, rule.masaPajak, rule.tahunPajak)
      );
      const passed = matches.length >= min;
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: `${matches.length} faktur keluaran berstatus APPROVED/AMENDED`,
        expectedSummary: `Minimal ${min} faktur keluaran disetujui (APPROVED)`,
      };
    }

    case 'EFAKTUR_INPUT_CREDITED_MIN': {
      const min = rule.minCount ?? 1;
      const matches = snapshot.efaktur.filter(
        (i) =>
          (i.category === 'INPUT' || i.category === 'SPECIAL_INPUT') &&
          i.creditStatus === 'CREDITED' &&
          matchPeriod(i.masaPajak, i.tahunPajak, rule.masaPajak, rule.tahunPajak)
      );
      const passed = matches.length >= min;
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: `${matches.length} faktur masukan berstatus CREDITED`,
        expectedSummary: `Minimal ${min} faktur masukan dikreditkan`,
      };
    }

    case 'EFAKTUR_MATCH_AMOUNT': {
      const target = rule.targetAmount ?? 0;
      const cat = rule.efakturCategory && rule.efakturCategory !== 'ANY' ? rule.efakturCategory : undefined;
      const candidates = snapshot.efaktur.filter(
        (i) =>
          (!cat || i.category === cat) &&
          i.status !== 'CANCELED' &&
          matchPeriod(i.masaPajak, i.tahunPajak, rule.masaPajak, rule.tahunPajak)
      );
      const found = candidates.find(
        (i) => Math.abs(i.dppTotal - target) <= tol || Math.abs(i.ppnTotal - target) <= tol
      );
      const passed = Boolean(found);
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: found
          ? `Cocok pada faktur ${found.invoiceNumber} (DPP ${fmtRp(found.dppTotal)}, PPN ${fmtRp(found.ppnTotal)})`
          : `Belum ada faktur dengan DPP/PPN ${fmtRp(target)}`,
        expectedSummary: `Faktur dengan DPP atau PPN ${fmtRp(target)} (±${fmtRp(tol)})`,
      };
    }

    case 'EBUPOT_ISSUED_MIN': {
      const min = rule.minCount ?? 1;
      const st = rule.slipType && rule.slipType !== 'ANY' ? rule.slipType : undefined;
      const matches = snapshot.ebupot.filter(
        (s) =>
          s.status === 'TELAH_TERBIT' &&
          (!st || s.slipType === st) &&
          matchPeriod(s.masaPajak, s.tahunPajak, rule.masaPajak, rule.tahunPajak)
      );
      const passed = matches.length >= min;
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: `${matches.length} bukti potong ${st || 'semua jenis'} berstatus TELAH_TERBIT`,
        expectedSummary: `Minimal ${min} bukti potong ${st || ''} telah diterbitkan (TTE)`,
      };
    }

    case 'EBUPOT_TOTAL_PPH_MATCH': {
      const target = rule.targetAmount ?? 0;
      const st = rule.slipType && rule.slipType !== 'ANY' ? rule.slipType : undefined;
      const total = snapshot.ebupot
        .filter(
          (s) =>
            s.status === 'TELAH_TERBIT' &&
            (!st || s.slipType === st) &&
            matchPeriod(s.masaPajak, s.tahunPajak, rule.masaPajak, rule.tahunPajak)
        )
        .reduce((acc, s) => acc + s.pphAmount, 0);
      const passed = Math.abs(total - target) <= tol;
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: `Total PPh terbit: ${fmtRp(total)}`,
        expectedSummary: `Total PPh terbit: ${fmtRp(target)} (±${fmtRp(tol)})`,
      };
    }

    case 'SPT_REPORTED': {
      const returns = findMatchingReturns(snapshot, rule);
      const reported = returns.find((r) => r.status === 'DILAPORKAN' && Boolean(r.bpeNumber));
      const passed = Boolean(reported);
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: reported
          ? `Dilaporkan — BPE ${reported.bpeNumber}`
          : returns.length > 0
          ? `SPT masih berstatus ${returns[0].status} (belum terbit BPE)`
          : `Belum ada SPT ${rule.returnType || ''} dibuat`,
        expectedSummary: `SPT ${rule.returnType || ''} berstatus DILAPORKAN (BPE terbit)`,
      };
    }

    case 'SPT_POSITION_MATCH': {
      const returns = findMatchingReturns(snapshot, rule);
      const best = returns.find((r) => r.status === 'DILAPORKAN') || returns[0];
      const expected = rule.expectedPosition || 'NIHIL';
      const passed = Boolean(best && best.taxPosition === expected);
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: best
          ? `Posisi pajak SPT: ${best.taxPosition} (${fmtRp(best.amountDue)})`
          : `Belum ada SPT ${rule.returnType || ''}`,
        expectedSummary: `Posisi pajak harus ${expected}`,
      };
    }

    case 'SPT_AMOUNT_DUE_MATCH': {
      const target = rule.targetAmount ?? 0;
      const returns = findMatchingReturns(snapshot, rule);
      const best = returns.find((r) => r.status === 'DILAPORKAN') || returns[0];
      const passed = Boolean(best && Math.abs(best.amountDue - target) <= tol);
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: best
          ? `Nominal di SPT: ${fmtRp(best.amountDue)} (${best.taxPosition})`
          : `Belum ada SPT ${rule.returnType || ''}`,
        expectedSummary: `Nominal di SPT: ${fmtRp(target)} (±${fmtRp(tol)})`,
      };
    }

    case 'SPT_OP_HARTA_UTANG_MIN': {
      const min = rule.minCount ?? 1;
      const opReturns = snapshot.taxReturns.filter((r) => r.returnType === 'PPH_OP_TAHUNAN');
      const best = opReturns.find((r) => r.status === 'DILAPORKAN') || opReturns[0];
      if (!best) {
        return {
          ruleId: rule.id,
          label: rule.label,
          weight,
          earned: 0,
          passed: false,
          actualSummary: 'Belum ada SPT Tahunan OP dibuat',
          expectedSummary: `SPT Tahunan OP terisi penghasilan & minimal ${min} item Harta/Utang di L-1`,
        };
      }
      const p = best.payload as SptOpTahunanPayload;
      const totalItems = (p.hartaList?.length || 0) + (p.utangList?.length || 0);
      const hasIncome = (p.brutoPekerjaan || 0) > 0 || (p.peredaranBrutoUsaha || 0) > 0;
      const passed = hasIncome && totalItems >= min;
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: `Bruto/Usaha ${hasIncome ? 'terisi' : 'kosong'}, Harta: ${p.hartaList?.length || 0}, Utang: ${p.utangList?.length || 0}`,
        expectedSummary: `Penghasilan terisi & minimal ${min} data Harta/Utang di Lampiran L-1`,
      };
    }

    case 'SPT_BADAN_FISCAL_CHECK': {
      const minCorr = rule.minCount ?? 1;
      const minRev = rule.targetAmount ?? 1;
      const badanReturns = snapshot.taxReturns.filter((r) => r.returnType === 'PPH_BADAN_TAHUNAN');
      const best = badanReturns.find((r) => r.status === 'DILAPORKAN') || badanReturns[0];
      if (!best) {
        return {
          ruleId: rule.id,
          label: rule.label,
          weight,
          earned: 0,
          passed: false,
          actualSummary: 'Belum ada SPT Tahunan PPh Badan dibuat',
          expectedSummary: `Laba Rugi (Peredaran ≥ ${fmtRp(minRev)}) & minimal ${minCorr} Koreksi Fiskal terisi`,
        };
      }
      const p = best.payload as SptBadanTahunanPayload;
      const corrCount = p.koreksiList?.length || 0;
      const passed = (p.peredaranUsaha || 0) >= minRev && corrCount >= minCorr;
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: `Peredaran Usaha ${fmtRp(p.peredaranUsaha || 0)}, ${corrCount} koreksi fiskal, ${p.kreditPajakList?.length || 0} kredit pajak`,
        expectedSummary: `Peredaran Usaha ≥ ${fmtRp(minRev)} & minimal ${minCorr} item koreksi fiskal`,
      };
    }

    case 'PAYMENT_SETTLED': {
      const role = rule.taxpayerRole;
      const paidBill = snapshot.billing.find(
        (b) => b.status === 'LUNAS' && Boolean(b.ntpn) && (!role || b.taxpayerRole === role)
      );
      const depositUsed = snapshot.ledger.find(
        (l) => l.entryType === 'DEPOSIT_TRANSFER' && (!role || l.taxpayerRole === role)
      );
      const passed = Boolean(paidBill || depositUsed);
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: passed ? weight : 0,
        passed,
        actualSummary: paidBill
          ? `Lunas via Kode Billing (NTPN ${paidBill.ntpn})`
          : depositUsed
          ? `Lunas via Pemindahbukuan Deposit (${fmtRp(depositUsed.debit)})`
          : 'Belum ada pelunasan Billing atau pemindahbukuan Deposit',
        expectedSummary: 'Pembayaran pajak lunas melalui Deposit Pajak atau Kode Billing (NTPN)',
      };
    }

    default:
      return {
        ruleId: rule.id,
        label: rule.label,
        weight,
        earned: 0,
        passed: false,
        actualSummary: 'Tipe aturan tidak dikenali',
        expectedSummary: '-',
      };
  }
}

export function gradeExamAttempt(
  snapshot: SimulatorSnapshot,
  examCase: ExamCase
): {
  score: number;
  maxScore: number;
  passed: boolean;
  results: ExamRuleResult[];
} {
  const results = examCase.rubric.map((rule) => evaluateRule(snapshot, rule));
  const rawEarned = results.reduce((acc, r) => acc + r.earned, 0);
  const rawMax = results.reduce((acc, r) => acc + r.weight, 0);
  const maxScore = rawMax > 0 ? rawMax : 100;
  // Normalize to 100-point scale if weights don't sum to 100, else exact sum
  const score = rawMax === 100 ? rawEarned : rawMax > 0 ? Math.round((rawEarned / rawMax) * 100) : 0;
  const passed = score >= examCase.passingScore;
  return {
    score,
    maxScore: rawMax === 100 ? 100 : 100,
    passed,
    results,
  };
}

export function getDefaultExamCases(): ExamCase[] {
  return [
    {
      id: 'exam_op_tuan_a',
      code: 'UJIAN-OP-01',
      title: 'Ujian Praktik SPT Tahunan PPh 21 Karyawan (Kasus Tuan A)',
      moduleType: 'PPH21_TAHUNAN',
      packageAccess: 'ALL',
      passingScore: 75,
      maxAttempts: 3,
      isActive: true,
      scenarioText:
        'Sebagai Wajib Pajak Orang Pribadi (Akun Utama OP — PTKP TK/0), Anda menerima Bukti Potong BPA1 Tahun Pajak 2025 dari PT Maju Bersama Sejahtera dengan Penghasilan Bruto Rp533.500.000 dan PPh Pasal 21 dipotong Rp87.375.000.\n\nTugas Praktik:\n1. Pastikan akun aktif adalah Orang Pribadi (OP) dan cek Bukti Potong BPA1 di Portal Saya.\n2. Buat Konsep SPT Tahunan PPh Orang Pribadi Tahun 2025 di menu Surat Pemberitahuan (SPT).\n3. Jalankan Posting SPT untuk menarik data BPA1, lalu lengkapi Lampiran L-1 dengan minimal 2 data Harta/Utang (contoh: Tabungan Rp300 jt, Mobil Rp200 jt, Utang Bank Rp200 jt).\n4. Pastikan posisi pajak adalah NIHIL (Rp0), centang pernyataan, lalu lakukan Bayar dan Lapor dengan TTE (passphrase: kelasbrevet123) hingga Nomor BPE terbit.',
      rubric: [
        {
          id: 'r_op_1',
          type: 'SPT_OP_HARTA_UTANG_MIN',
          label: 'Penghasilan BPA1 & Lampiran L-1 (Harta/Utang) terisi lengkap',
          weight: 25,
          minCount: 2,
        },
        {
          id: 'r_op_2',
          type: 'SPT_POSITION_MATCH',
          label: 'Posisi SPT Tahunan OP tepat berstatus NIHIL',
          weight: 25,
          returnType: 'PPH_OP_TAHUNAN',
          expectedPosition: 'NIHIL',
          tahunPajak: 2025,
        },
        {
          id: 'r_op_3',
          type: 'SPT_AMOUNT_DUE_MATCH',
          label: 'Nominal Kurang/Lebih Bayar SPT tepat Rp0',
          weight: 20,
          returnType: 'PPH_OP_TAHUNAN',
          targetAmount: 0,
          tolerance: 100,
          tahunPajak: 2025,
        },
        {
          id: 'r_op_4',
          type: 'SPT_REPORTED',
          label: 'SPT Tahunan OP 2025 telah dilaporkan (BPE terbit)',
          weight: 30,
          returnType: 'PPH_OP_TAHUNAN',
          tahunPajak: 2025,
        },
      ],
    },
    {
      id: 'exam_ppn_masa',
      code: 'UJIAN-PPN-01',
      title: 'Ujian Praktik e-Faktur & SPT Masa PPN (PT Simulasi)',
      moduleType: 'PPN',
      packageAccess: 'ALL',
      passingScore: 75,
      maxAttempts: 3,
      isActive: true,
      scenarioText:
        'Anda bertindak sebagai Staf Pajak PT SIMULASI KELASBREVET NUSANTARA (PKP Aktif) untuk Masa Pajak Januari 2025.\n\nTugas Praktik:\n1. Lakukan Impersonate ke akun Wajib Pajak Badan (PT Simulasi) melalui pemilih akun kanan atas.\n2. Buka menu e-Faktur -> Pajak Keluaran, lalu lakukan Submit & TTE minimal 1 Faktur Pajak Keluaran Masa Januari 2025 hingga berstatus APPROVED (NSFP terbit).\n3. Buka tab Pajak Masukan dan kreditkan minimal 2 Faktur Pajak Masukan Masa Januari 2025 (status CREDITED).\n4. Buat Konsep SPT Masa PPN Januari 2025, klik Posting SPT untuk menarik seluruh e-Faktur, periksa hasil Kurang Bayar, lalu selesaikan Bayar dan Lapor (Deposit Pajak atau Kode Billing hingga LUNAS) sampai BPE terbit.',
      rubric: [
        {
          id: 'r_ppn_1',
          type: 'EFAKTUR_OUTPUT_APPROVED_MIN',
          label: 'Minimal 1 Faktur Keluaran Masa Jan 2025 berstatus APPROVED',
          weight: 20,
          minCount: 1,
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_ppn_2',
          type: 'EFAKTUR_INPUT_CREDITED_MIN',
          label: 'Minimal 2 Faktur Masukan Masa Jan 2025 dikreditkan (CREDITED)',
          weight: 15,
          minCount: 2,
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_ppn_3',
          type: 'SPT_POSITION_MATCH',
          label: 'Posisi SPT Masa PPN Jan 2025 adalah KURANG_BAYAR',
          weight: 20,
          returnType: 'PPN',
          expectedPosition: 'KURANG_BAYAR',
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_ppn_4',
          type: 'SPT_REPORTED',
          label: 'SPT Masa PPN Jan 2025 telah dilaporkan (BPE terbit)',
          weight: 25,
          returnType: 'PPN',
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_ppn_5',
          type: 'PAYMENT_SETTLED',
          label: 'Pembayaran Kurang Bayar WP Badan telah lunas (Deposit/NTPN)',
          weight: 20,
          taxpayerRole: 'BADAN',
        },
      ],
    },
    {
      id: 'exam_ebupot_21_23',
      code: 'UJIAN-EBUPOT-01',
      title: 'Ujian Praktik e-Bupot MP (TER) & BPPU PPh 23 + SPT Masa',
      moduleType: 'EBUPOT_21_23',
      packageAccess: 'ALL',
      passingScore: 75,
      maxAttempts: 3,
      isActive: true,
      scenarioText:
        'Sebagai Pemotong Pajak PT SIMULASI KELASBREVET NUSANTARA untuk Masa Pajak Januari 2025:\n\nTugas Praktik:\n1. Impersonate ke WP Badan lalu buka menu e-Bupot.\n2. Terbitkan (TTE) minimal 1 Bukti Potong MP (Pegawai Tetap TER) dan pastikan minimal 1 Bukti Potong BPPU (PPh 23) berstatus TELAH_TERBIT untuk Masa Januari 2025.\n3. Buat Konsep SPT Masa PPh 21/26 Masa Januari 2025, jalankan Posting SPT, lalu laporkan hingga BPE terbit.\n4. Buat Konsep SPT Masa PPh Unifikasi Masa Januari 2025, jalankan Posting SPT, lalu laporkan dan lunasi pajaknya hingga BPE terbit.',
      rubric: [
        {
          id: 'r_bp_1',
          type: 'EBUPOT_ISSUED_MIN',
          label: 'Minimal 1 Bukti Potong MP (Pegawai Tetap TER) berstatus TELAH_TERBIT',
          weight: 20,
          slipType: 'MP',
          minCount: 1,
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_bp_2',
          type: 'EBUPOT_ISSUED_MIN',
          label: 'Minimal 1 Bukti Potong BPPU (PPh 23) berstatus TELAH_TERBIT',
          weight: 20,
          slipType: 'BPPU',
          minCount: 1,
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_bp_3',
          type: 'SPT_REPORTED',
          label: 'SPT Masa PPh 21/26 Jan 2025 telah dilaporkan (BPE terbit)',
          weight: 25,
          returnType: 'PPH21_MASA',
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_bp_4',
          type: 'SPT_REPORTED',
          label: 'SPT Masa PPh Unifikasi Jan 2025 telah dilaporkan (BPE terbit)',
          weight: 25,
          returnType: 'PPH_UNIFIKASI',
          masaPajak: 1,
          tahunPajak: 2025,
        },
        {
          id: 'r_bp_5',
          type: 'PAYMENT_SETTLED',
          label: 'Pelunasan PPh Masa WP Badan tercatat (Deposit/Billing Lunas)',
          weight: 10,
          taxpayerRole: 'BADAN',
        },
      ],
    },
    {
      id: 'exam_pph_badan',
      code: 'UJIAN-BADAN-01',
      title: 'Ujian Praktik SPT Tahunan PPh Badan Lengkap (Rekonsiliasi Fiskal & 31E)',
      moduleType: 'PPH_BADAN',
      packageAccess: 'BREVET_B,BREVET_AB,ALL',
      passingScore: 75,
      maxAttempts: 3,
      isActive: true,
      scenarioText:
        'Susun dan laporkan SPT Tahunan PPh Badan Tahun Pajak 2025 untuk PT SIMULASI KELASBREVET NUSANTARA.\n\nTugas Praktik:\n1. Impersonate ke WP Badan -> buka menu SPT -> Buat Konsep SPT Tahunan PPh Badan 2025.\n2. Isi Laporan Laba Rugi Komersial (Peredaran Usaha minimal Rp1 Miliar), minimal 2 item Rekonsiliasi Fiskal (Positif/Negatif), serta Kredit Pajak (PPh 22/23/25) — Anda dapat mengikuti data studi kasus PT Simulasi.\n3. Pastikan perhitungan PPh Terutang (Tarif 22% / Fasilitas Pasal 31E) menghasilkan posisi PPh Pasal 29 KURANG_BAYAR.\n4. Lakukan pelunasan (Deposit Pajak atau Kode Billing) dan laporkan SPT hingga berstatus DILAPORKAN dengan Nomor BPE.',
      rubric: [
        {
          id: 'r_bd_1',
          type: 'SPT_BADAN_FISCAL_CHECK',
          label: 'Laba Rugi Komersial & minimal 2 Koreksi Fiskal terisi lengkap',
          weight: 30,
          minCount: 2,
          targetAmount: 1000000000,
        },
        {
          id: 'r_bd_2',
          type: 'SPT_POSITION_MATCH',
          label: 'Posisi SPT Tahunan PPh Badan 2025 adalah KURANG_BAYAR (PPh 29)',
          weight: 20,
          returnType: 'PPH_BADAN_TAHUNAN',
          expectedPosition: 'KURANG_BAYAR',
          tahunPajak: 2025,
        },
        {
          id: 'r_bd_3',
          type: 'SPT_REPORTED',
          label: 'SPT Tahunan PPh Badan 2025 telah dilaporkan (BPE terbit)',
          weight: 30,
          returnType: 'PPH_BADAN_TAHUNAN',
          tahunPajak: 2025,
        },
        {
          id: 'r_bd_4',
          type: 'PAYMENT_SETTLED',
          label: 'Pelunasan PPh Pasal 29 Badan selesai (Deposit/NTPN)',
          weight: 20,
          taxpayerRole: 'BADAN',
        },
      ],
    },
  ];
}
