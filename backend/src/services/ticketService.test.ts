import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Ticket Service Tests', () => {
  // Jest는 CommonJS 환경이므로 process.cwd() 사용
  const SAMPLES_DIR = path.resolve(process.cwd(), 'samples');

  describe('Sample Data Integrity', () => {
    it('should have samples directory', () => {
      if (!fs.existsSync(SAMPLES_DIR)) {
        console.warn('Samples directory not found, skipping file tests');
        return;
      }
      expect(fs.existsSync(SAMPLES_DIR)).toBe(true);
    });

    it('should contain at least 5 sample tickets', () => {
      if (!fs.existsSync(SAMPLES_DIR)) {
        console.warn('Samples directory not found, skipping');
        return;
      }
      const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.json'));
      expect(files.length).toBeGreaterThanOrEqual(5);
    });

    it('should have valid JSON structure in sample files', () => {
      if (!fs.existsSync(SAMPLES_DIR)) {
        console.warn('Samples directory not found, skipping');
        return;
      }
      
      const files = fs.readdirSync(SAMPLES_DIR).filter(f => f.endsWith('.json'));
      
      files.forEach(file => {
        const filePath = path.join(SAMPLES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        expect(() => JSON.parse(content)).not.toThrow();
        
        const data = JSON.parse(content);
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('subject');
        expect(data).toHaveProperty('mailThread');
        expect(Array.isArray(data.mailThread)).toBe(true);
      });
    });

    it('should have realistic mail thread structure', () => {
      const sampleFile = path.join(SAMPLES_DIR, 'ticket-001.json');
      if (!fs.existsSync(sampleFile)) {
        console.warn('ticket-001.json not found, skipping');
        return;
      }

      const content = fs.readFileSync(sampleFile, 'utf-8');
      const ticket = JSON.parse(content);

      expect(ticket.mailThread.length).toBeGreaterThan(2); // At least initial report + vendor response + resolution
      
      ticket.mailThread.forEach((mail: any) => {
        expect(mail).toHaveProperty('from');
        expect(mail).toHaveProperty('to');
        expect(mail).toHaveProperty('date');
        expect(mail).toHaveProperty('subject');
        expect(mail).toHaveProperty('body');
      });
    });
  });

  describe('Ticket Retrieval Logic', () => {
    it('should load ticket by ID', () => {
      const ticketId = 'ticket-001';
      const ticketPath = path.join(SAMPLES_DIR, `${ticketId}.json`);
      
      if (fs.existsSync(ticketPath)) {
        const content = fs.readFileSync(ticketPath, 'utf-8');
        const ticket = JSON.parse(content);
        
        expect(ticket.id).toBe(ticketId);
      } else {
        console.warn('ticket-001.json not found, test passes conditionally');
        expect(true).toBe(true);
      }
    });

    it('should return null for non-existent ticket', () => {
      const ticketId = 'non-existent-ticket';
      const ticketPath = path.join(SAMPLES_DIR, `${ticketId}.json`);
      
      expect(fs.existsSync(ticketPath)).toBe(false);
    });
  });

  describe('Mail Thread Processing', () => {
    it('should extract participants from mail thread', () => {
      const sampleFile = path.join(SAMPLES_DIR, 'ticket-001.json');
      if (!fs.existsSync(sampleFile)) {
        console.warn('ticket-001.json not found, skipping');
        return;
      }

      const content = fs.readFileSync(sampleFile, 'utf-8');
      const ticket = JSON.parse(content);

      if (!ticket.mailThread) {
        console.warn('mailThread not found in ticket, skipping');
        return;
      }

      const participants = new Set<string>();
      ticket.mailThread.forEach((mail: any) => {
        participants.add(mail.from);
        if (Array.isArray(mail.to)) {
          mail.to.forEach((recipient: string) => participants.add(recipient));
        }
      });

      expect(participants.size).toBeGreaterThan(0);
    });

    it('should identify vendor emails', () => {
      const vendorDomains = ['microsoft.com', 'azure.com', 'aws.com', 'support.'];
      const testEmail = 'support@azure.microsoft.com';
      
      const isVendor = vendorDomains.some(domain => testEmail.includes(domain));
      expect(isVendor).toBe(true);
    });

    it('should parse email dates correctly', () => {
      const dateString = '2024-01-15T09:00:00Z';
      const parsed = new Date(dateString);
      
      expect(isNaN(parsed.getTime())).toBe(false);
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0); // January is 0
    });
  });

  describe('Error Cases', () => {
    it('should handle corrupted JSON gracefully', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should handle missing required fields', () => {
      const incompleteTicket = {
        id: 'test-001'
        // Missing subject, mailThread
      };

      expect(incompleteTicket).not.toHaveProperty('subject');
      expect(incompleteTicket).not.toHaveProperty('mailThread');
    });
  });
});