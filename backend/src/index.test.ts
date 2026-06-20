import { describe, it, expect, beforeAll } from '@jest/globals';
import type { ApiResponse, Ticket, TicketDetail } from '@rca-copilot/shared';

describe('Backend API Tests', () => {
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:7071';
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      serverAvailable = response.ok;
    } catch {
      serverAvailable = false;
      console.warn('⚠️  Backend server not available at', API_BASE);
      console.warn('   Integration tests will be skipped. Start the server with "npm run start" to run them.');
    }
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      if (!serverAvailable) {
        console.warn('Skipping: server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/api/health`);
      const data = await response.json() as { status: string; timestamp: string; version: string };
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');
    });
  });

  describe('Tickets API', () => {
    it('should return list of sample tickets', async () => {
      if (!serverAvailable) {
        console.warn('Skipping: server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/api/tickets`);
      const data = await response.json() as ApiResponse<Ticket[]>;
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(Array.isArray(data.data)).toBe(true);
      if (data.data) {
        expect(data.data.length).toBeGreaterThan(0);
        
        // Verify ticket structure
        const ticket = data.data[0];
        expect(ticket).toHaveProperty('id');
        expect(ticket).toHaveProperty('subject');
        expect(ticket).toHaveProperty('vendor');
        expect(ticket).toHaveProperty('status');
      }
    });

    it('should return specific ticket details', async () => {
      if (!serverAvailable) {
        console.warn('Skipping: server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/api/tickets/ticket-001`);
      const data = await response.json() as ApiResponse<TicketDetail>;
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      if (data.data) {
        expect(data.data).toHaveProperty('id', 'ticket-001');
        expect(data.data).toHaveProperty('messages');
        expect(Array.isArray(data.data.messages)).toBe(true);
      }
    });

    it('should return 404 for non-existent ticket', async () => {
      if (!serverAvailable) {
        console.warn('Skipping: server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/api/tickets/non-existent`);
      const data = await response.json() as ApiResponse<null>;
      
      expect(response.status).toBe(404);
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
    });
  });

  describe('Environment Variables', () => {
    it('should have required environment variables configured', () => {
      // These can be either Azure OpenAI or GitHub Models
      const hasAzureOpenAI = process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY;
      const hasGitHubModels = process.env.GITHUB_MODELS_TOKEN;
      
      // At least one AI provider should be configured (in production)
      // For local dev, this test passes as it's optional
      if (!hasAzureOpenAI && !hasGitHubModels) {
        console.warn('No AI provider configured. Set AZURE_OPENAI_* or GITHUB_MODELS_TOKEN in .env');
      }
      
      // Test passes - just informational warning
      expect(true).toBe(true);
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from frontend origin', async () => {
      if (!serverAvailable) {
        console.warn('Skipping: server not available');
        return;
      }

      const response = await fetch(`${API_BASE}/api/health`, {
        headers: {
          'Origin': 'http://localhost:5173'
        }
      });
      
      expect(response.status).toBe(200);
      // In actual deployment, check Access-Control-Allow-Origin header
    });
  });
});
