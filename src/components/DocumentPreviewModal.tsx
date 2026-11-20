import React from 'react';
import { Printer, X } from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { formatNpwp16 } from '../lib/taxCalculations';
import { CertificateSheet } from './CertificateSheet';

export const DocumentPreviewModal: React.FC = () => {
  const { previewDoc, closePreviewDoc } = useSimulator();

  if (!previewDoc) return null;

  const isCertificate = previewDoc.kind === 'SERTIFIKAT' && Boolean(previewDoc.certificateMeta);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className={`bg-white border border-slate-200 rounded-lg w-full my-8 overflow-hidden ${
          isCertificate ? 'max-w-4xl' : 'max-w-2xl'
        }`}
      >
        {/* Modal Toolbar */}
        <div className="no-print bg-[#1A2B5F] text-white px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-bold">
            {isCertificate
              ? 'Sertifikat Kelulusan Ujian Praktik — KelasBrevet'
              : 'Pratinjau Dokumen Simulasi — KelasBrevet'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F5C518] text-[#1A2B5F] text-xs font-bold rounded-md hover:bg-[#EAB308] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              type="button"
              onClick={closePreviewDoc}
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Tutup pratinjau dokumen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper */}
        <div id="printable-tax-document" className={isCertificate ? 'p-4 sm:p-6 bg-white' : 'p-8 bg-white text-slate-900'}>
          {isCertificate && previewDoc.certificateMeta ? (
            <CertificateSheet
              config={previewDoc.certificateMeta.config}
              certificateNumber={previewDoc.docNumber}
              participantName={previewDoc.taxpayerName}
              participantNik={previewDoc.taxpayerNpwp}
              packageCode={previewDoc.certificateMeta.packageCode}
              caseCode={previewDoc.certificateMeta.caseCode}
              caseTitle={previewDoc.certificateMeta.caseTitle}
              moduleLabel={previewDoc.certificateMeta.moduleLabel}
              score={previewDoc.certificateMeta.score}
              maxScore={previewDoc.certificateMeta.maxScore}
              passingScore={previewDoc.certificateMeta.passingScore}
              issuedAt={previewDoc.certificateMeta.issuedAt}
            />
          ) : (
            <>
              <div className="border-b-2 border-[#1A2B5F] pb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-wide text-[#B45309]">
                    SIMULASI CORETAX — LISENSI PEMBELAJARAN KELASBREVET
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-[#1A2B5F]">{previewDoc.title}</h2>
                  <p className="text-xs text-slate-600 mt-0.5">{previewDoc.subtitle}</p>
                </div>
                <div className="text-right text-xs">
                  <div className="text-slate-500">Nomor Dokumen</div>
                  <div className="font-num font-bold text-slate-900 mt-0.5">{previewDoc.docNumber}</div>
                  <div className="text-slate-500 mt-1">Tanggal: {previewDoc.date}</div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-md text-xs">
                <div>
                  <div className="text-slate-500">Nama Wajib Pajak</div>
                  <div className="font-bold text-slate-900 mt-0.5">{previewDoc.taxpayerName}</div>
                </div>
                <div>
                  <div className="text-slate-500">NPWP / NIK (16 Digit)</div>
                  <div className="font-num font-bold text-slate-900 mt-0.5">{formatNpwp16(previewDoc.taxpayerNpwp)}</div>
                </div>
              </div>

              <table className="mt-5 w-full text-xs border-collapse">
                <tbody>
                  {previewDoc.rows.map((row, idx) => (
                    <tr
                      key={`${row.label}-${idx}`}
                      className={`border-b border-slate-200 ${row.highlight ? 'bg-amber-50/70 font-bold' : ''}`}
                    >
                      <td className="py-2.5 pr-4 text-slate-600">{row.label}</td>
                      <td className="py-2.5 text-right font-num text-slate-900">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>
                  <div className="font-semibold text-slate-700">Ditandatangani secara elektronik (Simulasi)</div>
                  <div className="mt-0.5">
                    {previewDoc.footerNote ||
                      'Dokumen ini diterbitkan oleh Sistem Simulasi Pembelajaran KelasBrevet untuk keperluan latihan Brevet Pajak dan bukan dokumen resmi DJP.'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
