import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGraphClient, searchSupportTickets, fetchMailThread } from '../services/graphService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TicketSummary {
  id: string;
  subject: string;
  status: string;
  vendor: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function extractBearerToken(request: HttpRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
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
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const token = extractBearerToken(request);

    if (token) {
      try {
        const client = createGraphClient(token);
        const tickets = await searchSupportTickets(client);
        return {
          status: 200,
          jsonBody: { success: true, data: tickets, source: 'graph' },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Graph API error';
        return {
          status: 200,
          jsonBody: { success: true, data: loadAllTickets(), source: 'sample', warning: message },
        };
      }
    }

    const tickets = loadAllTickets();
    return {
      status: 200,
      jsonBody: { success: true, data: tickets, source: 'sample' },
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

    const token = extractBearerToken(request);

    // If authenticated and ticketId looks like a conversationId (not a sample ID)
    if (token && !ticketId.startsWith('ticket-')) {
      try {
        const client = createGraphClient(token);
        const messages = await fetchMailThread(client, ticketId);
        return {
          status: 200,
          jsonBody: {
            success: true,
            data: {
              ticketId,
              subject: messages[0]?.subject || 'Unknown',
              messages,
              source: 'graph',
            },
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Graph API error';
        return {
          status: 500,
          jsonBody: { success: false, error: `Failed to fetch mail thread: ${message}` },
        };
      }
    }

    // Fallback to sample data
    const ticket = loadTicket(ticketId);
    if (!ticket) {
      return {
        status: 404,
        jsonBody: { success: false, error: `Ticket ${ticketId} not found` },
      };
    }

    return {
      status: 200,
      jsonBody: { success: true, data: { ...ticket, source: 'sample' } },
    };
  },
});
