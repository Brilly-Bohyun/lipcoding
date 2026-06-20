const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export interface TicketSummary {
  id: string;
  subject: string;
  status: string;
  vendor: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface MailMessage {
  index: number;
  from: string;
  to: string;
  date: string;
  subject: string;
  bodyText: string;
  isVendor: boolean;
}

export interface TicketDetail {
  ticketId: string;
  subject: string;
  status: string;
  vendor: string;
  createdAt: string;
  updatedAt: string;
  messages: MailMessage[];
}

export interface RCADocument {
  summary: string;
  timeline: { datetime: string; event: string; source: string }[];
  rootCause: string;
  resolution: string;
  preventiveAction: string;
  openQuestions: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function fetchTickets(): Promise<TicketSummary[]> {
  const res = await fetch(`${API_BASE}/tickets`, { headers: getAuthHeaders() });
  const json: ApiResponse<TicketSummary[]> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Failed to fetch tickets');
  return json.data;
}

export async function fetchTicketDetail(ticketId: string): Promise<TicketDetail> {
  const res = await fetch(`${API_BASE}/tickets/${ticketId}`, { headers: getAuthHeaders() });
  const json: ApiResponse<TicketDetail> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || 'Ticket not found');
  return json.data;
}

export interface RCAStreamEvent {
  type: 'start' | 'chunk' | 'done' | 'error';
  content?: string;
  rca?: RCADocument;
  rawContent?: string;
  error?: string;
}

export async function* streamRCAGeneration(
  ticketId: string,
): AsyncGenerator<RCAStreamEvent, void, unknown> {
  const res = await fetch(`${API_BASE}/rca/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ ticketId }),
  });

  if (!res.ok) {
    throw new Error(`RCA generation failed: ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: RCAStreamEvent = JSON.parse(line.slice(6));
          yield event;
        } catch {
          // Skip malformed events
        }
      }
    }
  }
}

export async function exportToWord(rca: RCADocument, ticketSubject: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/rca/export/word`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ rca, ticketSubject }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({ error: 'Export failed' }));
    throw new Error((errorJson as { error?: string }).error || 'Word 내보내기 실패');
  }

  return res.blob();
}

export async function shareToSlack(rca: RCADocument, ticketSubject: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rca/share/slack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ rca, ticketSubject }),
  });

  const json: ApiResponse<{ message: string }> = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Slack 공유 실패');
  }
}
