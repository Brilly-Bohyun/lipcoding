import { Client } from '@microsoft/microsoft-graph-client';
import type { Ticket, MailMessage } from '@rca-copilot/shared';

export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  body: { content: string; contentType: string };
}

interface GraphSearchResult {
  subject: string;
  conversationId: string;
  receivedDateTime: string;
  from: { emailAddress: { name: string; address: string } };
}

/**
 * Search user's mailbox for support ticket threads.
 * Looks for emails with common support patterns (Case #, Ticket, SR#).
 */
export async function searchSupportTickets(client: Client): Promise<Ticket[]> {
  const searchQuery = "subject:Case OR subject:SR OR subject:Ticket OR subject:INC";

  const response = await client
    .api('/me/messages')
    .filter(`contains(subject, 'Case') or contains(subject, 'SR') or contains(subject, 'Ticket')`)
    .select('id,subject,conversationId,from,receivedDateTime')
    .top(50)
    .orderby('receivedDateTime desc')
    .get() as { value: GraphSearchResult[] };

  // Group by conversationId to get unique threads
  const threadMap = new Map<string, GraphSearchResult[]>();
  for (const msg of response.value) {
    const existing = threadMap.get(msg.conversationId) || [];
    existing.push(msg);
    threadMap.set(msg.conversationId, existing);
  }

  const tickets: Ticket[] = [];
  let index = 1;
  for (const [conversationId, messages] of threadMap) {
    const first = messages[messages.length - 1]; // oldest
    const last = messages[0]; // newest
    tickets.push({
      id: conversationId,
      subject: first.subject,
      vendor: extractVendor(first.from.emailAddress.address),
      status: 'open',
      createdAt: first.receivedDateTime,
      updatedAt: last.receivedDateTime,
      messageCount: messages.length,
    });
    index++;
    if (index > 20) break;
  }

  void searchQuery; // used for documentation
  return tickets;
}

/**
 * Fetch all messages in a conversation thread.
 */
export async function fetchMailThread(client: Client, conversationId: string): Promise<MailMessage[]> {
  const response = await client
    .api('/me/messages')
    .filter(`conversationId eq '${conversationId}'`)
    .select('id,subject,from,toRecipients,receivedDateTime,body')
    .orderby('receivedDateTime asc')
    .top(100)
    .get() as { value: GraphMessage[] };

  return response.value.map((msg, index) => ({
    index: index + 1,
    from: formatSender(msg.from.emailAddress),
    to: msg.toRecipients.map((r) => r.emailAddress.address).join(', '),
    date: msg.receivedDateTime,
    subject: msg.subject,
    bodyText: stripHtml(msg.body.content),
    isVendor: isVendorEmail(msg.from.emailAddress.address),
  }));
}

function extractVendor(email: string): string {
  const domain = email.split('@')[1] || '';
  if (domain.includes('microsoft')) return 'Microsoft';
  if (domain.includes('aws') || domain.includes('amazon')) return 'AWS';
  if (domain.includes('google')) return 'Google Cloud';
  if (domain.includes('oracle')) return 'Oracle';
  return domain.split('.')[0] || 'Unknown';
}

function formatSender(emailAddress: { name: string; address: string }): string {
  return emailAddress.name || emailAddress.address;
}

function isVendorEmail(email: string): boolean {
  const internalDomains = ['yourcompany.com', 'contoso.com'];
  const domain = email.split('@')[1] || '';
  return !internalDomains.some((d) => domain.includes(d));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
