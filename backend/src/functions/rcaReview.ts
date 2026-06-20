import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { reviewRCAStream } from '../agents/reviewAssistant.js';

/**
 * RCA 검토 보조 — Copilot SDK 툴 호출 기반.
 * POST /api/rca/review  { rca, messages, question }
 */
app.http('reviewRCA', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'rca/review',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as {
        rca?: unknown;
        messages?: Array<{
          index: number;
          from: string;
          date: string;
          bodyText: string;
          isVendor: boolean;
        }>;
        question?: string;
      };

      if (!body.rca || !body.question) {
        return {
          status: 400,
          jsonBody: { success: false, error: 'rca and question are required' },
        };
      }

      const messages = body.messages || [];
      const question = body.question;
      const rca = body.rca;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller): Promise<void> {
          try {
            controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));
            for await (const event of reviewRCAStream(rca, messages, question)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
            controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Review failed';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`));
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
      return { status: 500, jsonBody: { success: false, error: message } };
    }
  },
});
