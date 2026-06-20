import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sendSlackMessage } from '../services/slackService.js';

app.http('shareSlack', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'rca/share/slack',
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

      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) {
        return {
          status: 500,
          jsonBody: { success: false, error: 'SLACK_WEBHOOK_URL is not configured' },
        };
      }

      const result = await sendSlackMessage(webhookUrl, body.rca, body.ticketSubject || 'RCA Report');

      if (!result.success) {
        return {
          status: 502,
          jsonBody: { success: false, error: result.error },
        };
      }

      return {
        status: 200,
        jsonBody: { success: true, data: { message: 'Slack 메시지가 전송되었습니다.' } },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send Slack message';
      return {
        status: 500,
        jsonBody: { success: false, error: message },
      };
    }
  },
});
