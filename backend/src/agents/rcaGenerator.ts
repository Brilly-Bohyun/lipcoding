import { RCA_GENERATOR_SYSTEM_PROMPT } from '../prompts/rcaGenerator.js';
import { streamPrompt, getPromptConfig } from './copilotClient.js';

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

export async function* generateRCAStream(
  ticket: TicketData,
): AsyncGenerator<string, void, unknown> {
  // 구성 검증 (미설정 시 명확한 에러)
  getPromptConfig();

  const userPrompt = buildUserPrompt(ticket);

  // Copilot SDK(prompt.stream)를 통해 RCA 보고서를 스트리밍 생성한다.
  yield* streamPrompt(
    [
      { role: 'system', content: RCA_GENERATOR_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { jsonMode: true, temperature: 0.3, maxTokens: 4000 },
  );
}
