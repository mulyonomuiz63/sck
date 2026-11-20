import React, { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Circle, RotateCcw, X } from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { GUIDED_CASES } from '../lib/seedData';

export const GuidedStudyDrawer: React.FC = () => {
  const {
    snapshot,
    toggleGuidedMode,
    setActiveCaseId,
    setActiveNav,
    switchRole,
    resetSimulationData,
  } = useSimulator();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!snapshot || !snapshot.workspace.guidedMode) return null;

  const currentCase =
    GUIDED_CASES.find((c) => c.id === snapshot.workspace.activeCaseId) || GUIDED_CASES[0];

  const completedCount = currentCase.steps.filter((st) => st.check(snapshot)).length;
  const pct = Math.round((completedCount / currentCase.steps.length) * 100);

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col h-[calc(100vh-4rem)] sticky top-16">
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 className="text-xs font-bold text-[#1A2B5F]">Panduan Studi Kasus KelasBrevet</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mode Panduan · {completedCount}/{currentCase.steps.length} langkah selesai
          </p>
        </div>
        <button
          type="button"
          onClick={toggleGuidedMode}
          className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
          title="Tutup panel panduan (Mode Bebas / Sandbox)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Case Selector */}
      <div className="p-4 border-b border-slate-200 space-y-2">
        <label htmlFor="case-selector" className="block text-xs font-semibold text-slate-700">
          Pilih Studi Kasus Praktik
        </label>
        <select
          id="case-selector"
          value={currentCase.id}
          onChange={(e) => setActiveCaseId(e.target.value)}
          className="w-full h-9 px-2.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1A2B5F]"
        >
          {GUIDED_CASES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.moduleCode}: {c.title}
            </option>
          ))}
        </select>

        {/* Progress bar */}
        <div className="pt-1">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Progres Kasus</span>
            <span className="font-num font-semibold text-[#1A2B5F]">{pct}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A34A] transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed pt-1">{currentCase.summary}</p>
      </div>

      {/* Checklist Steps */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {currentCase.steps.map((step) => {
          const done = step.check(snapshot);
          return (
            <div
              key={step.id}
              className={`p-3 rounded-md border text-xs transition-colors ${
                done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${done ? 'text-emerald-900' : 'text-slate-900'}`}>
                    {step.title}
                  </div>
                  <p className="mt-1 text-slate-600 leading-relaxed">{step.instruction}</p>
                  {!done && (
                    <button
                      type="button"
                      onClick={() => {
                        if (step.requiredRole && snapshot.workspace.activeRole !== step.requiredRole) {
                          switchRole(step.requiredRole);
                        }
                        setActiveNav(step.targetNav);
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[#1A2B5F] font-semibold hover:underline cursor-pointer"
                    >
                      <span>Buka Menu Terkait</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions: Mode Bebas & Reset */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
        <button
          type="button"
          onClick={toggleGuidedMode}
          className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 cursor-pointer"
        >
          Beralih ke Mode Bebas (Sandbox)
        </button>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="w-full py-2 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data Latihan</span>
          </button>
        ) : (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-md space-y-2">
            <p className="text-xs text-red-800">
              Reset semua faktur, e-Bupot, SPT, dan saldo deposit ke awal?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resetSimulationData();
                  setConfirmReset(false);
                }}
                className="flex-1 py-1.5 text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
