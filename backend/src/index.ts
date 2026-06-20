import { app } from '@azure/functions';
import { initTelemetry } from './services/telemetry.js';
import './functions/tickets.js';
import './functions/rcaGenerate.js';
import './functions/rcaStore.js';
import './functions/exportWord.js';
import './functions/shareSlack.js';

// Initialize Application Insights
initTelemetry();

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (_request, _context) => {
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '0.1.0',
        },
      },
    };
  },
});
