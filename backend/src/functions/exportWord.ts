import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { generateWordDocument } from '../services/wordExport.js';

app.http('exportWord', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'rca/export/word',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as {
        rca?: {
          summary: string;
          timeline: { datetime: string; event: string; source: string }[];
          rootCause: string;
          resolution: string;
          preventiveAction: string;
          openQuestions: string[];
        };
        ticketSubject?: string;
      };

      if (!body.rca) {
        return {
          status: 400,
          jsonBody: { success: false, error: 'rca document is required' },
        };
      }

      const buffer = await generateWordDocument(body.rca, body.ticketSubject || 'RCA Report');

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="RCA_${Date.now()}.docx"`,
        },
        body: buffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate Word document';
      return {
        status: 500,
        jsonBody: { success: false, error: message },
      };
    }
  },
});
