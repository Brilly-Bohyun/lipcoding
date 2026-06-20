import { AzureOpenAI } from 'openai';
import { RCA_GENERATOR_SYSTEM_PROMPT } from '../prompts/rcaGenerator.js';

interface MailMessage {
  index: number;
  from: string;
  date: string;
  bodyText: string;
  isVendor: boolean;
}

interface TicketData {
  ticketId: string;
  subject: string;
  messages: MailMessage[];
}

function buildUserPrompt(ticket: TicketData): string {
  const mailSummary = ticket.messages
    .map(
      (m) =>
        `--- 메일 #${m.index} ---\n발신: ${m.from}\n일시: ${m.date}\n유형: ${m.isVendor ? '벤더' : '고객(MSP)'}\n내용:\n${m.bodyText}`,
    )
    .join('\n\n');

  return `## 티켓 정보\n- 제목: ${ticket.subject}\n- 티켓 ID: ${ticket.ticketId}\n- 메일 수: ${ticket.messages.length}통\n\n## 메일 스레드\n${mailSummary}\n\n위 메일 스레드를 분석하여 RCA 보고서를 JSON 형식으로 작성하세요.`;
}

function getClient(): AzureOpenAI {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

  if (!endpoint || !apiKey) {
    throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set');
  }

  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
  });
}

export async function* generateRCAStream(
  ticket: TicketData,
): AsyncGenerator<string, void, unknown> {
  const client = getClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const userPrompt = buildUserPrompt(ticket);

  const stream = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: RCA_GENERATOR_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
