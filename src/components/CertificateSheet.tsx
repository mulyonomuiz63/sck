import React from 'react';
import { Award, ShieldCheck } from 'lucide-react';
import { CertificateConfig } from '../types/tax';

export interface CertificateSheetProps {
  config: CertificateConfig;
  certificateNumber: string;
  participantName: string;
  participantNik: string;
  packageCode: string;
  caseCode: string;
  caseTitle: string;
  moduleLabel: string;
  score: number;
  maxScore: number;
  passingScore: number;
  issuedAt: string;
  compact?: boolean;
}

function formatIndonesianDate(isoOrDate: string): string {
  const dateObj = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(dateObj.getTime())) {
    return isoOrDate.slice(0, 10);
  }
  return dateObj.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getPredicate(score: number): string {
  if (score >= 90) return 'Sangat Kompeten (Dengan Pujian)';
  if (score >= 80) return 'Kompeten';
  return 'Lulus Memenuhi KKM';
}

export const CertificateSheet: React.FC<CertificateSheetProps> = ({
  config,
  certificateNumber,
  participantName,
  participantNik,
  packageCode,
  caseCode,
  caseTitle,
  moduleLabel,
  score,
  maxScore,
  passingScore,
  issuedAt,
  compact = false,
}) => {
  const formattedDate = formatIndonesianDate(issuedAt);
  const hasTwoSigners = Boolean(config.signer2Name.trim());

  return (
    <div
      className={`bg-white text-slate-900 border-[6px] border-[#1A2B5F] p-2 ${
        compact ? 'text-[11px]' : 'text-sm'
      }`}
    >
      <div className={`border-2 border-[#F5C518] ${compact ? 'p-5' : 'p-8 sm:p-10'} relative`}>
        {/* Top Institutional Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            {config.logoDataUrl ? (
              <img
                src={config.logoDataUrl}
                alt={config.organizationName}
                className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} object-contain shrink-0`}
              />
            ) : (
              <div
                className={`${
                  compact ? 'h-9 w-9' : 'h-12 w-12'
                } rounded-md bg-[#1A2B5F] text-[#F5C518] flex items-center justify-center shrink-0`}
              >
                <Award className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
              </div>
            )}
            <div>
              <div
                className={`font-bold text-[#1A2B5F] tracking-tight ${
                  compact ? 'text-xs' : 'text-base'
                }`}
              >
                {config.organizationName || 'KelasBrevet — Lembaga Pendidikan Perpajakan'}
              </div>
              <div className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {config.programSubtitle}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <div className={`text-slate-500 uppercase tracking-wider ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
              Nomor Sertifikat Resmi
            </div>
            <div className={`font-num font-bold text-[#1A2B5F] mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {certificateNumber || `${config.numberPrefix || 'CERT-KB'}/${new Date().getFullYear()}/0001`}
            </div>
          </div>
        </div>

        {/* Centerpiece */}
        <div className={`${compact ? 'my-5' : 'my-8'} text-center`}>
          <div
            className={`font-bold uppercase tracking-[0.14em] text-[#B45309] ${
              compact ? 'text-[10px]' : 'text-xs'
            }`}
          >
            {config.certificateTitle || 'SERTIFIKAT KELULUSAN UJIAN PRAKTIK CORETAX'}
          </div>

          <p className={`text-slate-500 ${compact ? 'mt-3 text-[11px]' : 'mt-5 text-xs'}`}>
            Diberikan dengan bangga kepada:
          </p>

          <h2
            className={`font-bold text-[#1A2B5F] tracking-tight ${
              compact ? 'mt-1 text-xl' : 'mt-2 text-3xl sm:text-4xl'
            }`}
          >
            {participantName}
          </h2>

          <div className={`font-num text-slate-600 ${compact ? 'mt-1 text-[11px]' : 'mt-1.5 text-xs'}`}>
            NIK: <strong className="text-slate-900">{participantNik}</strong> · Paket:{' '}
            <strong className="text-slate-900">{packageCode}</strong>
          </div>

          <p
            className={`mx-auto max-w-xl text-slate-600 leading-relaxed ${
              compact ? 'mt-3 text-[11px]' : 'mt-5 text-sm'
            }`}
          >
            Telah dinyatakan <strong className="text-emerald-800">LULUS</strong> dalam Uji Kompetensi Praktik
            Simulasi Sistem Administrasi Perpajakan (Coretax) pada studi kasus:
          </p>

          <div
            className={`mx-auto max-w-xl bg-slate-50 border border-slate-200 rounded-md ${
              compact ? 'mt-3 px-4 py-2.5' : 'mt-4 px-6 py-4'
            }`}
          >
            <div className={`font-bold text-[#1A2B5F] ${compact ? 'text-xs' : 'text-base'}`}>
              {caseCode} — {caseTitle}
            </div>
            <div className={`text-slate-500 mt-0.5 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              Modul: {moduleLabel}
            </div>

            <div
              className={`grid grid-cols-3 gap-3 border-t border-slate-200 ${
                compact ? 'mt-2.5 pt-2.5' : 'mt-3.5 pt-3.5'
              }`}
            >
              <div>
                <div className="text-[10px] text-slate-500">Skor Akhir</div>
                <div className={`font-num font-bold text-[#1A2B5F] ${compact ? 'text-sm' : 'text-lg'}`}>
                  {score} / {maxScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">KKM Minimal</div>
                <div className={`font-num font-bold text-slate-800 ${compact ? 'text-sm' : 'text-lg'}`}>
                  {passingScore}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Predikat</div>
                <div className={`font-bold text-emerald-700 ${compact ? 'text-[11px]' : 'text-xs'} mt-1`}>
                  {getPredicate(score)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Issue City & Signatures */}
        <div className={`${compact ? 'mt-5' : 'mt-8'}`}>
          <div className={`text-center text-slate-600 ${compact ? 'text-[10px] mb-3' : 'text-xs mb-5'}`}>
            Diterbitkan di <strong>{config.issueCity || 'Jakarta'}</strong>, pada tanggal{' '}
            <strong>{formattedDate}</strong>
          </div>

          <div
            className={`grid gap-6 items-end ${
              hasTwoSigners ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'
            }`}
          >
            {/* Signer 1 */}
            <div className="text-center">
              <div className={`${compact ? 'h-12' : 'h-16'} flex items-center justify-center`}>
                {config.signature1DataUrl ? (
                  <img
                    src={config.signature1DataUrl}
                    alt={config.signer1Name}
                    className={`${compact ? 'max-h-11' : 'max-h-14'} object-contain`}
                  />
                ) : (
                  <div className="w-28 border-b border-dashed border-slate-300 mt-8" />
                )}
              </div>
              <div className={`font-bold text-[#1A2B5F] mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                {config.signer1Name || 'Direktur Program'}
              </div>
              <div className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {config.signer1Title || 'KelasBrevet'}
              </div>
            </div>

            {/* Signer 2 (Optional) */}
            {hasTwoSigners && (
              <div className="text-center">
                <div className={`${compact ? 'h-12' : 'h-16'} flex items-center justify-center`}>
                  {config.signature2DataUrl ? (
                    <img
                      src={config.signature2DataUrl}
                      alt={config.signer2Name}
                      className={`${compact ? 'max-h-11' : 'max-h-14'} object-contain`}
                    />
                  ) : (
                    <div className="w-28 border-b border-dashed border-slate-300 mt-8" />
                  )}
                </div>
                <div className={`font-bold text-[#1A2B5F] mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {config.signer2Name}
                </div>
                <div className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                  {config.signer2Title}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Verification Footer */}
        <div
          className={`border-t border-slate-200 flex items-center justify-center gap-1.5 text-slate-500 text-center ${
            compact ? 'mt-4 pt-3 text-[9px]' : 'mt-7 pt-4 text-[11px]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#1A2B5F] shrink-0" />
          <span>{config.footerNote}</span>
        </div>
      </div>
    </div>
  );
};
