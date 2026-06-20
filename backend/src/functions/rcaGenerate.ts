import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateRCAStream } from '../agents/rcaGenerator.js';
import { parseMailThread } from '../agents/mailParser.js';
import { saveTicket, saveRCA } from '../services/storageService.js';

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

      // 이메일(메일 스레드) 내용을 스토리지에 영구 저장 (실패해도 생성은 계속)
      saveTicket({
        ticketId: ticketData.ticketId || ticketId,
        subject: ticketData.subject || '',
        vendor: ticketData.vendor || '',
        status: ticketData.status,
        messages: parsedThread.messages,
        participants: parsedThread.participants,
        metadata: parsedThread.metadata,
      }).catch(() => undefined);

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
            // AI 응답이 ```json ... ``` 코드펜스로 감싸지는 경우가 있어 제거 후 파싱
            const cleaned = fullContent
              .trim()
              .replace(/^```(?:json)?\s*/i, '')
              .replace(/\s*```$/i, '')
              .trim();
            try {
              const rca = JSON.parse(cleaned);
              // RCA를 스토리지에 저장 (Table 최신본 + Blob 버전 스냅샷)
              const stored = await saveRCA(ticketId, rca).catch(() => null);
              const doneEvent = JSON.stringify({
                type: 'done',
                rca,
                version: stored?.version,
                persisted: stored !== null,
              });
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
