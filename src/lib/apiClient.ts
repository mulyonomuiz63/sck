import {
  BillingCode,
  EBupotSlip,
  EFakturInvoice,
  LedgerEntry,
  SimulatorSnapshot,
  TaxReturn,
  TaxWorkspace,
} from '../types/tax';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function requestJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const mysqlApi = {
  loginNik(nik: string, customName?: string) {
    return requestJson<SimulatorSnapshot>('/auth/nik', {
      method: 'POST',
      body: JSON.stringify({ nik, customName }),
    });
  },
  getWorkspace(nik: string) {
    return requestJson<SimulatorSnapshot>(`/workspace/${nik}`, { method: 'GET' });
  },
  updateWorkspace(nik: string, patch: Partial<TaxWorkspace>) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  resetWorkspace(nik: string) {
    return requestJson<SimulatorSnapshot>(`/workspace/${nik}/reset`, { method: 'POST' });
  },
  saveEFaktur(nik: string, invoice: EFakturInvoice) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/efaktur`, {
      method: 'PUT',
      body: JSON.stringify(invoice),
    });
  },
  deleteEFaktur(nik: string, id: string) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/efaktur/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  saveEBupotBatch(nik: string, slips: EBupotSlip[]) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/ebupot`, {
      method: 'PUT',
      body: JSON.stringify({ slips }),
    });
  },
  deleteEBupot(nik: string, id: string) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/ebupot/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  saveTaxReturn(nik: string, taxReturn: TaxReturn) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/tax-returns`, {
      method: 'PUT',
      body: JSON.stringify(taxReturn),
    });
  },
  deleteTaxReturn(nik: string, id: string) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/tax-returns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  saveBilling(nik: string, billing: BillingCode) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/billing`, {
      method: 'PUT',
      body: JSON.stringify(billing),
    });
  },
  addLedgerEntry(nik: string, entry: LedgerEntry) {
    return requestJson<{ ok: boolean }>(`/workspace/${nik}/ledger`, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },
};
