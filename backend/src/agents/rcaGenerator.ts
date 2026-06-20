import OpenAI, { AzureOpenAI } from 'openai';
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

type AIClient = OpenAI | AzureOpenAI;

function getClient(): { client: AIClient; model: string } {
  // Option 1: Azure OpenAI (production)
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;

  if (azureEndpoint && azureKey) {
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    return {
      client: new AzureOpenAI({ endpoint: azureEndpoint, apiKey: azureKey, apiVersion }),
      model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    };
  }

  // Option 2: GitHub Models (development/fallback)
  const githubToken = process.env.GITHUB_MODELS_TOKEN;
  if (githubToken) {
    return {
      client: new OpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: githubToken,
      }),
      model: process.env.GITHUB_MODELS_MODEL || 'gpt-4o',
    };
  }

  throw new Error(
    'No AI provider configured. Set AZURE_OPENAI_ENDPOINT+AZURE_OPENAI_API_KEY or GITHUB_MODELS_TOKEN',
  );
}

export async function* generateRCAStream(
  ticket: TicketData,
): AsyncGenerator<string, void, unknown> {
  const { client, model } = getClient();
  const userPrompt = buildUserPrompt(ticket);

  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: RCA_GENERATOR_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
