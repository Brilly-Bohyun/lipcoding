interface RCADocument {
  summary: string;
  timeline: { datetime: string; event: string; source: string }[];
  rootCause: string;
  resolution: string;
  preventiveAction: string;
  openQuestions: string[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: { type: string; text: string }[];
  fields?: { type: string; text: string }[];
}

/**
 * Format RCA as Slack Block Kit message.
 */
export function formatSlackBlocks(rca: RCADocument, ticketSubject: string): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 RCA 보고서 공유', emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${ticketSubject}*` },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*📝 장애 요약*\n${rca.summary}` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*🔍 근본 원인*\n${truncate(rca.rootCause, 300)}` },
        { type: 'mrkdwn', text: `*✅ 조치 내역*\n${truncate(rca.resolution, 300)}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*🛡️ 재발 방지 대책*\n${truncate(rca.preventiveAction, 500)}` },
    },
  ];

  if (rca.openQuestions.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*❓ 미해결 사항*\n${rca.openQuestions.map((q) => `• ${q}`).join('\n')}`,
      },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `📅 생성일: ${new Date().toLocaleDateString('ko-KR')} | _Vendor Support RCA Copilot_` },
      ],
    },
  );

  return blocks;
}

/**
 * Send RCA summary to Slack via Incoming Webhook.
 */
export async function sendSlackMessage(
  webhookUrl: string,
  rca: RCADocument,
  ticketSubject: string,
): Promise<{ success: boolean; error?: string }> {
  const blocks = formatSlackBlocks(rca, ticketSubject);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `RCA 보고서: ${ticketSubject}`,
      blocks,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { success: false, error: `Slack API error: ${response.status} ${errorText}` };
  }

  return { success: true };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
