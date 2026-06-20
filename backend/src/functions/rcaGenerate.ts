import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRCAStream } from '../agents/rcaGenerator.js';
import { parseMailThread } from '../agents/mailParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getSamplesDir(): string {
  return join(__dirname, '..', '..', 'samples');
}

app.http('generateRCA', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'rca/generate',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { ticketId?: string; messages?: unknown[] };
      const ticketId = body.ticketId;

      if (!ticketId) {
        return {
          status: 400,
          jsonBody: { success: false, error: 'ticketId is required' },
        };
      }

      // Load ticket data (sample or passed-in messages)
      let ticketData;
      if (body.messages) {
        // Direct messages from Graph API
        ticketData = { ticketId, subject: '', vendor: '', messages: body.messages };
      } else {
        try {
          const filePath = join(getSamplesDir(), `${ticketId}.json`);
          ticketData = JSON.parse(readFileSync(filePath, 'utf-8'));
        } catch {
          return {
            status: 404,
            jsonBody: { success: false, error: `Ticket ${ticketId} not found` },
          };
        }
      }

      // Parse and clean mail thread through MailParserAgent
      const parsedThread = parseMailThread(
        ticketData.ticketId || ticketId,
        ticketData.subject || '',
        ticketData.vendor || '',
        ticketData.messages || [],
      );

      // Stream RCA generation via SSE using cleaned messages
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller): Promise<void> {
          try {
            controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

            let fullContent = '';
            for await (const chunk of generateRCAStream({
              ...ticketData,
              messages: parsedThread.messages,
            })) {
              fullContent += chunk;
              const event = JSON.stringify({ type: 'chunk', content: chunk });
              controller.enqueue(encoder.encode(`data: ${event}\n\n`));
            }

            // Send complete event with full parsed RCA
            try {
              const rca = JSON.parse(fullContent);
              const doneEvent = JSON.stringify({ type: 'done', rca });
              controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
            } catch {
              const doneEvent = JSON.stringify({ type: 'done', rawContent: fullContent });
              controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : 'Unknown error during RCA generation';
            const errorEvent = JSON.stringify({ type: 'error', error: errorMsg });
            controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5173',
        },
        body: stream,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return {
        status: 500,
        jsonBody: { success: false, error: message },
      };
    }
  },
});
