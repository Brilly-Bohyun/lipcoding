import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateRCAStream } from '../agents/rcaGenerator.js';

function getSamplesDir(): string {
  return join(__dirname, '..', '..', 'samples');
}

app.http('generateRCA', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'rca/generate',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { ticketId?: string };
      const ticketId = body.ticketId;

      if (!ticketId) {
        return {
          status: 400,
          jsonBody: { success: false, error: 'ticketId is required' },
        };
      }

      // Load ticket data
      let ticketData;
      try {
        const filePath = join(getSamplesDir(), `${ticketId}.json`);
        ticketData = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch {
        return {
          status: 404,
          jsonBody: { success: false, error: `Ticket ${ticketId} not found` },
        };
      }

      // Stream RCA generation via SSE
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));

            let fullContent = '';
            for await (const chunk of generateRCAStream(ticketData)) {
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
              // If JSON parse fails, send raw content
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
