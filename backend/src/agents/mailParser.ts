/**
 * MailParserAgent — Cleans and structures raw email content for AI input.
 *
 * Responsibilities:
 * - HTML → plain text conversion (preserving structure)
 * - Email signature and disclaimer removal
 * - Quoted/forwarded message cleanup
 * - Participant classification (vendor vs internal)
 */

export interface ParsedMessage {
  index: number;
  from: string;
  to: string;
  date: string;
  subject: string;
  bodyText: string;
  isVendor: boolean;
}

export interface ParsedMailThread {
  ticketId: string;
  subject: string;
  vendor: string;
  participants: string[];
  messages: ParsedMessage[];
  metadata: {
    totalMessages: number;
    dateRange: { start: string; end: string };
  };
}

interface RawMessage {
  index?: number;
  from: string;
  to: string;
  date: string;
  subject: string;
  bodyText?: string;
  body?: string;
  isVendor?: boolean;
}

// Patterns for signature detection
const SIGNATURE_PATTERNS: RegExp[] = [
  /^--\s*$/m,
  /^_{3,}$/m,
  /^-{3,}$/m,
  /^Regards,?\s*$/im,
  /^Best regards,?\s*$/im,
  /^Thanks,?\s*$/im,
  /^Thank you,?\s*$/im,
  /^Sincerely,?\s*$/im,
  /^Kind regards,?\s*$/im,
  /^Sent from my /im,
  /^Get Outlook for /im,
];

// Patterns for disclaimer/legal notices
const DISCLAIMER_PATTERNS: RegExp[] = [
  /CONFIDENTIAL|DISCLAIMER|PRIVILEGED/i,
  /This email and any attachments/i,
  /This message is intended only for/i,
  /If you are not the intended recipient/i,
  /본 메일은.*수신자.*외/,
  /이 이메일은.*기밀/,
];

// Patterns for quoted/forwarded messages
const QUOTE_HEADER_PATTERN = /^On .+ wrote:$/m;
const ORIGINAL_MSG_PATTERN = /^-{3,}\s*Original Message\s*-{3,}$/im;

// Known vendor domains
const VENDOR_DOMAINS = [
  'microsoft.com',
  'amazon.com',
  'aws.amazon.com',
  'google.com',
  'cloud.google.com',
  'oracle.com',
  'salesforce.com',
  'vmware.com',
  'redhat.com',
  'ibm.com',
  'cisco.com',
  'paloaltonetworks.com',
  'fortinet.com',
  'zscaler.com',
];

/**
 * Parse and clean a raw mail thread for RCA generation.
 */
export function parseMailThread(
  ticketId: string,
  subject: string,
  vendor: string,
  rawMessages: RawMessage[],
): ParsedMailThread {
  const messages: ParsedMessage[] = rawMessages.map((msg, idx) => ({
    index: msg.index ?? idx + 1,
    from: msg.from,
    to: msg.to,
    date: msg.date,
    subject: msg.subject,
    bodyText: cleanEmailBody(msg.bodyText || msg.body || ''),
    isVendor: msg.isVendor ?? classifyParticipant(msg.from),
  }));

  const participants = [...new Set(messages.map((m) => m.from))];
  const dates = messages.map((m) => m.date).sort();

  return {
    ticketId,
    subject,
    vendor,
    participants,
    messages,
    metadata: {
      totalMessages: messages.length,
      dateRange: {
        start: dates[0] || '',
        end: dates[dates.length - 1] || '',
      },
    },
  };
}

/**
 * Clean email body: strip HTML, remove signatures, disclaimers, and quoted text.
 */
export function cleanEmailBody(body: string): string {
  let text = body;

  // Strip HTML if present
  if (/<[^>]+>/.test(text)) {
    text = stripHtml(text);
  }

  // Remove disclaimers
  text = removeDisclaimers(text);

  // Remove signatures
  text = removeSignature(text);

  // Clean quoted messages (keep first level, remove deep nesting)
  text = cleanQuotedMessages(text);

  // Normalize whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  return text;
}

/**
 * Convert HTML email body to plain text, preserving structure.
 */
function stripHtml(html: string): string {
  let text = html;

  // Remove style and script blocks
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Convert block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');

  // Convert table cells to tab separation
  text = text.replace(/<td[^>]*>/gi, '\t');
  text = text.replace(/<th[^>]*>/gi, '\t');

  // Convert links: keep text and URL
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  return text;
}

/**
 * Remove email signature block.
 */
function removeSignature(text: string): string {
  const lines = text.split('\n');
  let signatureStart = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (SIGNATURE_PATTERNS.some((pattern) => pattern.test(line))) {
      // Only treat as signature if it's in the last 30% of the email
      if (i > lines.length * 0.6) {
        signatureStart = i;
        break;
      }
    }
  }

  if (signatureStart > 0) {
    return lines.slice(0, signatureStart).join('\n');
  }

  return text;
}

/**
 * Remove legal disclaimers typically appended at end of emails.
 */
function removeDisclaimers(text: string): string {
  const lines = text.split('\n');
  let disclaimerStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (DISCLAIMER_PATTERNS.some((pattern) => pattern.test(lines[i]))) {
      // Only if in the last 40% of the email
      if (i > lines.length * 0.6) {
        disclaimerStart = i;
        break;
      }
    }
  }

  if (disclaimerStart > 0) {
    return lines.slice(0, disclaimerStart).join('\n');
  }

  return text;
}

/**
 * Clean quoted/forwarded messages — remove deep nesting but keep context.
 */
function cleanQuotedMessages(text: string): string {
  // Remove "--- Original Message ---" blocks if they repeat earlier content
  const originalMsgMatch = text.match(ORIGINAL_MSG_PATTERN);
  if (originalMsgMatch && originalMsgMatch.index !== undefined) {
    const beforeQuote = text.slice(0, originalMsgMatch.index).trim();
    if (beforeQuote.length > 50) {
      return beforeQuote;
    }
  }

  // Remove "On ... wrote:" quote headers
  const quoteHeaderMatch = text.match(QUOTE_HEADER_PATTERN);
  if (quoteHeaderMatch && quoteHeaderMatch.index !== undefined) {
    const beforeQuote = text.slice(0, quoteHeaderMatch.index).trim();
    if (beforeQuote.length > 50) {
      return beforeQuote;
    }
  }

  // Remove deeply nested quotes (>>)
  const lines = text.split('\n');
  const cleaned = lines.filter((line) => {
    return !(/^>{2,}/.test(line.trim()));
  });

  // Clean single-level quote markers
  return cleaned
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n');
}

/**
 * Classify whether an email sender is a vendor or internal team member.
 */
export function classifyParticipant(from: string): boolean {
  const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
  const email = emailMatch ? emailMatch[1] : from;
  const domain = email.split('@')[1]?.toLowerCase() || '';

  return VENDOR_DOMAINS.some((vendorDomain) => domain.includes(vendorDomain));
}
