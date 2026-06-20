/**
 * Copilot SDK 기반 LLM 호출 계층.
 *
 * @copilot-extensions/preview-sdk 의 prompt / prompt.stream / getFunctionCalls 를
 * 앱의 핵심 AI 호출 경로로 사용한다. 모델 계층은 Azure OpenAI(Microsoft Foundry)에
 * 연결되며(엔드포인트 + 커스텀 fetch로 api-key 인증), 미설정 시 GitHub Models로 폴백한다.
 */
import { prompt, getFunctionCalls } from '@copilot-extensions/preview-sdk';

export interface InteropMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PromptConfig {
  endpoint: string;
  token: string;
  model: string;
  fetch?: typeof fetch;
  provider: 'azure-openai' | 'github-models';
}

/**
 * Copilot SDK가 호출할 모델 백엔드 구성을 결정한다.
 */
export function getPromptConfig(): PromptConfig {
  const azEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azKey = process.env.AZURE_OPENAI_API_KEY;

  // 1순위: Azure OpenAI (Microsoft Foundry)
  if (azEndpoint && azKey) {
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    const base = azEndpoint.replace(/\/$/, '');
    const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    // SDK는 Authorization: Bearer 를 보내므로, Azure OpenAI 인증(api-key)으로 교체
    const azureFetch: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.delete('authorization');
      headers.set('api-key', azKey);
      return fetch(input, { ...init, headers });
    };

    return { endpoint: url, token: azKey, model: deployment, fetch: azureFetch, provider: 'azure-openai' };
  }

  // 2순위: GitHub Models (Azure-hosted inference)
  const ghToken = process.env.GITHUB_MODELS_TOKEN;
  if (ghToken) {
    return {
      endpoint: 'https://models.inference.ai.azure.com/chat/completions',
      token: ghToken,
      model: process.env.GITHUB_MODELS_MODEL || 'gpt-4o',
      provider: 'github-models',
    };
  }

  throw new Error(
    'No AI provider configured. Set AZURE_OPENAI_ENDPOINT+AZURE_OPENAI_API_KEY or GITHUB_MODELS_TOKEN',
  );
}

/**
 * Copilot SDK prompt.stream 으로 스트리밍 응답을 받아 텍스트 청크를 yield 한다.
 */
export async function* streamPrompt(
  messages: InteropMessage[],
  options?: { jsonMode?: boolean; temperature?: number; maxTokens?: number },
): AsyncGenerator<string, void, unknown> {
  const config = getPromptConfig();

  const promptOptions = {
    token: config.token,
    endpoint: config.endpoint,
    model: config.model,
    messages,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4000,
    ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    ...(config.fetch ? { request: { fetch: config.fetch } } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const { stream } = await prompt.stream(promptOptions);

  const decoder = new TextDecoder();
  let buffer = '';

  const iterable = stream as unknown as AsyncIterable<Uint8Array>;
  for await (const chunk of iterable) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // 부분 JSON — 다음 청크에서 이어붙임
      }
    }
  }
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

/**
 * Copilot SDK prompt + getFunctionCalls 로 툴 호출을 수행한다.
 * 모델이 툴을 호출하면 ToolCall 목록을, 아니면 최종 텍스트를 반환한다.
 */
export async function promptWithTools(
  messages: InteropMessage[],
  tools: ToolDefinition[],
): Promise<{ toolCalls: ToolCall[]; content: string | null }> {
  const config = getPromptConfig();

  const promptOptions = {
    token: config.token,
    endpoint: config.endpoint,
    model: config.model,
    messages,
    tools,
    ...(config.fetch ? { request: { fetch: config.fetch } } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const result = await prompt(promptOptions);
  const toolCalls = getFunctionCalls(result) as ToolCall[];
  return {
    toolCalls,
    content: result.message?.content ?? null,
  };
}
