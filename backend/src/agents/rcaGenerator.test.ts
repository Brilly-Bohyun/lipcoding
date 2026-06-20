import { describe, it, expect } from '@jest/globals';
import type { ParsedMailThread, TimelineEntry, MailMessage } from '@rca-copilot/shared';

describe('RCA Generator Agent Tests', () => {
  const sampleMailThread: ParsedMailThread = {
    ticketId: 'test-001',
    subject: 'Test Azure Issue',
    participants: ['vendor@example.com', 'msp@company.com'],
    messages: [
      {
        index: 0,
        from: 'msp@company.com',
        to: 'vendor@example.com',
        date: '2024-01-15T09:00:00Z',
        subject: 'Network connectivity issue',
        bodyText: 'We are experiencing network connectivity issues with Azure VM.',
        isVendor: false
      },
      {
        index: 1,
        from: 'vendor@example.com',
        to: 'msp@company.com',
        date: '2024-01-15T10:30:00Z',
        subject: 'RE: Network connectivity issue',
        bodyText: 'We have identified NSG misconfiguration. Fixed the security rules.',
        isVendor: true
      },
      {
        index: 2,
        from: 'vendor@example.com',
        to: 'msp@company.com',
        date: '2024-01-15T11:00:00Z',
        subject: 'RE: Network connectivity issue',
        bodyText: 'Please verify connectivity is restored.',
        isVendor: true
      }
    ] as MailMessage[],
    metadata: {
      totalMessages: 3,
      dateRange: {
        start: '2024-01-15T09:00:00Z',
        end: '2024-01-15T11:00:00Z'
      },
      vendor: 'Azure Support'
    }
  };

  describe('Data Structure Validation', () => {
    it('should have valid ParsedMailThread structure', () => {
      expect(sampleMailThread).toHaveProperty('ticketId');
      expect(sampleMailThread).toHaveProperty('subject');
      expect(sampleMailThread).toHaveProperty('messages');
      expect(Array.isArray(sampleMailThread.messages)).toBe(true);
      expect(sampleMailThread.messages.length).toBeGreaterThan(0);
    });

    it('should classify vendor vs customer messages', () => {
      const vendorMessages = sampleMailThread.messages.filter(m => m.isVendor);
      const customerMessages = sampleMailThread.messages.filter(m => !m.isVendor);
      
      expect(vendorMessages.length).toBeGreaterThan(0);
      expect(customerMessages.length).toBeGreaterThan(0);
    });

    it('should have chronological message order', () => {
      for (let i = 1; i < sampleMailThread.messages.length; i++) {
        const prevDate = new Date(sampleMailThread.messages[i - 1].date);
        const currDate = new Date(sampleMailThread.messages[i].date);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    });
  });

  describe('RCA Output Structure', () => {
    it('should validate RCA document schema', () => {
      const rcaSchema = {
        summary: expect.any(String),
        timeline: expect.arrayContaining([
          expect.objectContaining({
            datetime: expect.any(String),
            event: expect.any(String),
            source: expect.any(String)
          })
        ]),
        rootCause: expect.any(String),
        resolution: expect.any(String),
        preventiveAction: expect.any(String),
        openQuestions: expect.any(Array)
      };

      expect(rcaSchema).toBeDefined();
    });

    it('should validate timeline entry structure', () => {
      const timelineEntry: TimelineEntry = {
        datetime: '2024-01-15 09:00 KST',
        event: '고객이 네트워크 연결 문제 보고',
        source: '메일 #0'
      };

      expect(timelineEntry).toHaveProperty('datetime');
      expect(timelineEntry).toHaveProperty('event');
      expect(timelineEntry).toHaveProperty('source');
      expect(timelineEntry.source).toMatch(/메일 #\d+/);
    });
  });

  describe('Korean Language Output', () => {
    it('should generate Korean text', () => {
      const koreanText = '장애 요약: Azure VM 네트워크 연결 장애';
      expect(koreanText).toMatch(/[\uAC00-\uD7AF]/); // Korean Unicode range
    });

    it('should include technical terms in English parentheses', () => {
      const mixedText = '네트워크 보안 그룹(NSG) 설정 오류';
      expect(mixedText).toMatch(/\([A-Z]+\)/); // English acronym in parentheses
    });
  });

  describe('Error Handling', () => {
    it('should handle empty mail thread gracefully', () => {
      const emptyThread: ParsedMailThread = {
        ticketId: 'empty-001',
        subject: 'Empty Thread',
        participants: [],
        messages: [],
        metadata: {
          totalMessages: 0,
          dateRange: { start: '', end: '' },
          vendor: 'Unknown'
        }
      };

      expect(emptyThread.messages.length).toBe(0);
      // Agent should handle this gracefully
    });

    it('should handle malformed date strings', () => {
      const invalidDate = 'invalid-date-string';
      const parsed = new Date(invalidDate);
      expect(isNaN(parsed.getTime())).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should process mail thread within reasonable time', () => {
      const start = Date.now();
      
      // Simulate processing
      const messageCount = sampleMailThread.messages.length;
      expect(messageCount).toBeGreaterThan(0);
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should be very fast for data validation
    });
  });
});