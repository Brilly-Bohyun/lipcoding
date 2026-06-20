import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface TicketSummary {
  id: string;
  subject: string;
  status: string;
  vendor: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function getSamplesDir(): string {
  return join(__dirname, '..', '..', 'samples');
}

function loadTicket(ticketId: string): Record<string, unknown> | null {
  try {
    const filePath = join(getSamplesDir(), `${ticketId}.json`);
    const data = readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function loadAllTickets(): TicketSummary[] {
  const samplesDir = getSamplesDir();
  const files = readdirSync(samplesDir).filter((f) => f.endsWith('.json'));

  return files.map((file) => {
    const data = JSON.parse(readFileSync(join(samplesDir, file), 'utf-8'));
    return {
      id: data.ticketId,
      subject: data.subject,
      status: data.status,
      vendor: data.vendor,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      messageCount: data.messages.length,
    };
  });
}

app.http('getTickets', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'tickets',
  handler: async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const tickets = loadAllTickets();
    return {
      status: 200,
      jsonBody: { success: true, data: tickets },
    };
  },
});

app.http('getTicketById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'tickets/{ticketId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const ticketId = request.params.ticketId;
    if (!ticketId) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'ticketId is required' },
      };
    }

    const ticket = loadTicket(ticketId);
    if (!ticket) {
      return {
        status: 404,
        jsonBody: { success: false, error: `Ticket ${ticketId} not found` },
      };
    }

    return {
      status: 200,
      jsonBody: { success: true, data: ticket },
    };
  },
});
