import {
  AppSettingsConfig,
  BillingCode,
  CertificateConfig,
  EBupotSlip,
  EFakturInvoice,
  EnrolledParticipant,
  ExamAttempt,
  ExamCase,
  LedgerEntry,
  ParticipantStatus,
  SimulatorSnapshot,
  TaxReturn,
  TaxWorkspace,
} from '../types/tax';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  code?: string;
}

async function requestDetail<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      ...init,
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: typeof parsed?.error === 'string' ? parsed.error : `Permintaan gagal (HTTP ${res.status}).`,
        code: typeof parsed?.code === 'string' ? parsed.code : undefined,
      };
    }
    return { ok: true, status: res.status, data: parsed as unknown as T };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Tidak dapat terhubung ke server.',
    };
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const r = await requestDetail<T>(url, init);
  return r.ok ? r.data : null;
}

export const mysqlApi = {
  loginNikDetailed(nik: string, customName?: string) {
    return requestDetail<SimulatorSnapshot>('/auth/nik', {
      method: 'POST',
      body: JSON.stringify({ nik, customName }),
    });
  },
  loginSsoDetailed(token: string) {
    return requestDetail<SimulatorSnapshot>('/auth/sso', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  loginNik(nik: string, customName?: string) {
    return requestJson<SimulatorSnapshot>('/auth/nik', {
      method: 'POST',
      body: JSON.stringify({ nik, customName }),
    });
  },
  getWorkspaceDetailed(nik: string) {
    return requestDetail<SimulatorSnapshot>(`/workspace/${nik}`, { method: 'GET' });
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

export const examApi = {
  getParticipantExams(nik: string) {
    return requestDetail<{
      cases: ExamCase[];
      attempts: ExamAttempt[];
      enrollment: EnrolledParticipant | null;
      certificateConfig: CertificateConfig;
    }>(`/exams/participant/${nik}`, { method: 'GET' });
  },
  startExam(nik: string, caseId: string, resetWorkspace = false) {
    return requestDetail<{ attempt: ExamAttempt; snapshot: SimulatorSnapshot }>(
      `/exams/participant/${nik}/start`,
      {
        method: 'POST',
        body: JSON.stringify({ caseId, resetWorkspace }),
      }
    );
  },
  submitExam(nik: string, caseId: string) {
    return requestDetail<{ attempt: ExamAttempt }>(`/exams/participant/${nik}/submit`, {
      method: 'POST',
      body: JSON.stringify({ caseId }),
    });
  },
};

export interface AdminOverviewPayload {
  settings: AppSettingsConfig;
  participants: EnrolledParticipant[];
  examCases: ExamCase[];
  attempts: ExamAttempt[];
}

export const adminApi = {
  login(username: string, password: string) {
    return requestDetail<{ ok: boolean; token: string; username: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  getOverview(token: string) {
    return requestDetail<AdminOverviewPayload>('/admin/overview', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  updateSettings(token: string, patch: Partial<AppSettingsConfig>) {
    return requestDetail<{ ok: boolean; settings: AppSettingsConfig }>('/admin/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
  },
  saveParticipant(token: string, participant: EnrolledParticipant) {
    return requestDetail<{ ok: boolean; participant: EnrolledParticipant }>('/admin/participants', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(participant),
    });
  },
  importParticipants(token: string, participants: EnrolledParticipant[]) {
    return requestDetail<{ ok: boolean; imported: number }>('/admin/participants/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ participants }),
    });
  },
  updateParticipantStatus(token: string, nik: string, status: ParticipantStatus) {
    return requestDetail<{ ok: boolean }>(`/admin/participants/${nik}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
  },
  deleteParticipant(token: string, nik: string) {
    return requestDetail<{ ok: boolean }>(`/admin/participants/${nik}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  saveExamCase(token: string, examCase: ExamCase) {
    return requestDetail<{ ok: boolean; examCase: ExamCase }>('/admin/cases', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(examCase),
    });
  },
  deleteExamCase(token: string, caseId: string) {
    return requestDetail<{ ok: boolean }>(`/admin/cases/${encodeURIComponent(caseId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  simulatePurchase(
    token: string,
    payload: { nik: string; fullName: string; email: string; packageCode: string; orderId: string }
  ) {
    return requestDetail<{ ok: boolean; participant: EnrolledParticipant; loginUrl: string }>(
      '/admin/simulate-purchase',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      }
    );
  },
};
