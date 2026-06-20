/**
 * ReviewAssistantAgent — Copilot SDK 툴 호출 기반 RCA 검토 보조.
 *
 * 사용자가 생성된 RCA에 대해 질문하면, 에이전트는 SDK의 tool calling을 통해
 * 원본 메일을 조회(get_mail_message)하여 근거 기반으로 답변한다.
 */
import { promptWithTools, streamPrompt, ToolDefinition, InteropMessage } from './copilotClient.js';

interface MailMessage {
  index: number;
  from: string;
  date: string;
  bodyText: string;
  isVendor: boolean;
}

const REVIEW_SYSTEM_PROMPT = `당신은 MSP 엔지니어를 돕는 RCA 보고서 검토 보조자입니다.
- 사용자의 질문에 답하기 위해 필요하면 get_mail_message 도구로 원본 메일을 조회하세요.
- 메일에 명시된 사실만 근거로 답하고, 정보가 없으면 정직하게 "메일에 해당 정보가 없습니다"라고 답하세요.
- 모든 답변은 한국어로, 간결하고 명확하게 작성하세요.`;

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_mail_message',
      description: '특정 번호의 원본 메일 전문을 조회한다. RCA 근거 확인에 사용한다.',
      parameters: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: '조회할 메일 번호 (1부터 시작)' },
        },
        required: ['index'],
      },
    },
  },
];

/**
 * 사용자 질문에 대해 툴 호출 → 근거 조회 → 최종 답변을 스트리밍한다.
 */
export async function* reviewRCAStream(
  rca: unknown,
  messages: MailMessage[],
  userQuestion: string,
): AsyncGenerator<{ type: 'tool' | 'text'; content: string }, void, unknown> {
  const context: InteropMessage[] = [
    { role: 'system', content: REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: `## 현재 RCA 보고서\n${JSON.stringify(rca)}\n\n## 질문\n${userQuestion}` },
  ];

  // 1) 툴 호출 여부 판단 (best-effort — 실패해도 답변은 계속)
  let usedTool = false;
  try {
    const { toolCalls } = await promptWithTools(context, TOOLS);
    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        if (call.function.name !== 'get_mail_message') continue;
        let idx = 0;
        try {
          idx = JSON.parse(call.function.arguments).index;
        } catch {
          continue;
        }
        const mail = messages.find((m) => m.index === idx);
        const evidence = mail
          ? `메일 #${mail.index} (${mail.isVendor ? '벤더' : '고객'}, ${mail.date})\n${mail.bodyText}`
          : `메일 #${idx}을 찾을 수 없습니다.`;
        yield { type: 'tool', content: `🔍 근거 조회: 메일 #${idx}` };
        context.push({ role: 'assistant', content: `(도구 get_mail_message 결과)\n${evidence}` });
        usedTool = true;
      }
    }
  } catch {
    // 툴 호출 실패 시 폴백으로 진행
  }

  // 2) 툴 근거가 없으면 전체 메일을 컨텍스트로 주입해 근거 기반 답변 보장
  if (!usedTool && messages.length > 0) {
    const allMail = messages
      .map((m) => `메일 #${m.index} (${m.isVendor ? '벤더' : '고객'}, ${m.date})\n${m.bodyText}`)
      .join('\n\n');
    context.push({ role: 'assistant', content: `(참고 원본 메일)\n${allMail}` });
  }

  // 3) 근거를 바탕으로 최종 답변 스트리밍
  for await (const chunk of streamPrompt(context, { temperature: 0.3, maxTokens: 1500 })) {
    yield { type: 'text', content: chunk };
  }
}
