// Shared types for Vendor Support RCA Copilot

export interface RCADocument {
  summary: string;
  timeline: TimelineEntry[];
  rootCause: string;
  resolution: string;
  preventiveAction: string;
  openQuestions: string[];
}

export interface TimelineEntry {
  datetime: string;
  event: string;
  source: string;
}

export interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  vendor: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface TicketDetail extends Ticket {
  messages: MailMessage[];
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

export interface ParsedMailThread {
  ticketId: string;
  subject: string;
  participants: string[];
  messages: MailMessage[];
  metadata: {
    totalMessages: number;
    dateRange: { start: string; end: string };
    vendor: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ExportResult {
  type: 'word' | 'slack';
  success: boolean;
  fileUrl?: string;
  slackMessageTs?: string;
  error?: string;
}
