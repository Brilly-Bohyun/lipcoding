# AGENTS.md — Vendor Support RCA Copilot

## Agent 아키텍처 개요

본 프로젝트는 GitHub Copilot SDK를 사용하여 다중 에이전트 체인으로 RCA를 생성합니다.
각 에이전트는 단일 책임을 가지며, 오케스트레이터가 순서를 제어합니다.

```
사용자 요청: "이 티켓의 RCA를 생성해줘"
       │
       ▼
┌──────────────────┐
│  Orchestrator    │  ← 전체 흐름 제어
└──────┬───────────┘
       │
       ├─── (1) MailParserAgent      → 메일 스레드 파싱 & 정리
       │
       ├─── (2) RCAGeneratorAgent    → 한국어 RCA 6섹션 생성
       │
       └─── (3) ReviewAssistantAgent → 검토 보조 (재생성, 질의응답)
```

---

## Agent 정의

### 1. MailParserAgent

**역할:** 메일 스레드 원본을 구조화된 데이터로 변환

**입력:** 메일 스레드 (JSON 배열 또는 Graph API 응답)

**출력:**
```typescript
interface ParsedMailThread {
  ticketId: string;
  subject: string;
  participants: string[];
  messages: {
    index: number;
    from: string;
    date: string;
    bodyText: string;  // HTML 제거, 서명 제거
    isVendor: boolean;
  }[];
  metadata: {
    totalMessages: number;
    dateRange: { start: string; end: string };
    vendor: string;
  };
}
```

**도구 (Tools):**
- `fetchMailThread(ticketId)` — 샘플 JSON 로드 또는 Graph API 호출
- `cleanHtmlBody(html)` — HTML → Plain text 변환, 서명/면책조항 제거
- `classifyParticipant(email)` — 발신자가 벤더인지 내부인지 분류

**시스템 프롬프트 핵심:**
```
당신은 이메일 파싱 전문가입니다.
- 이메일 스레드에서 불필요한 서명, 면책조항, 인용을 제거하세요.
- 각 메시지의 발신자가 벤더 측인지 고객(MSP) 측인지 분류하세요.
- 시간순으로 정렬하세요.
- 원본 내용을 변형하지 마세요.
```

---

### 2. RCAGeneratorAgent

**역할:** 파싱된 메일 데이터를 분석하여 한국어 RCA 보고서 6개 섹션을 생성

**입력:** `ParsedMailThread` (MailParserAgent 출력)

**출력:**
```typescript
interface RCADocument {
  summary: string;           // 장애 요약 (3~5문장)
  timeline: TimelineEntry[]; // 시간순 이벤트
  rootCause: string;         // 근본 원인
  resolution: string;        // 조치 내역
  preventiveAction: string;  // 재발 방지 대책
  openQuestions: string[];   // 미해결 사항
}

interface TimelineEntry {
  datetime: string;  // ISO 8601 또는 "YYYY-MM-DD HH:mm KST"
  event: string;     // 이벤트 설명 (한국어)
  source: string;    // 근거 메일 번호 (예: "메일 #3")
}
```

**도구 (Tools):**
- `generateTimeline(messages)` — 메일에서 시간 정보 추출 및 타임라인 구성
- `identifyRootCause(messages)` — 근본 원인 후보 식별
- `extractActions(messages)` — 수행된 조치 항목 추출

**시스템 프롬프트 핵심:**
```
당신은 MSP 엔지니어를 위한 RCA 보고서 작성 전문가입니다.

규칙:
1. 모든 출력은 한국어로 작성하세요.
2. 메일에 명시된 사실만 기술하세요. 추측하지 마세요.
3. 각 섹션에 근거가 되는 메일 번호를 참조하세요.
4. 기술 용어는 영어 원문을 괄호 안에 병기하세요. (예: "네트워크 보안 그룹(NSG)")
5. 타임라인은 최소 5개 이벤트를 포함하세요.
6. 미해결 사항은 메일에서 답변되지 않은 질문을 식별하세요.

출력 형식: 아래 JSON 스키마를 정확히 따르세요.
{summary, timeline[], rootCause, resolution, preventiveAction, openQuestions[]}
```

**스트리밍 전략:**
- 섹션 단위로 스트리밍 (summary 완료 → timeline 시작 → ...)
- 각 섹션 시작 시 프론트엔드에 섹션 헤더 전송
- 에러 발생 시 부분 결과라도 반환

---

### 3. ReviewAssistantAgent

**역할:** 사용자가 RCA를 검토할 때 보조 (특정 섹션 재생성, 질문 답변)

**입력:** 기존 RCA + 사용자 요청 (자연어)

**출력:** 수정된 섹션 또는 답변

**사용 시나리오:**
- "타임라인에 누락된 이벤트가 있어. 메일 #7 내용을 추가해줘"
- "근본 원인을 더 기술적으로 상세하게 써줘"
- "예방 대책을 3가지로 나눠줘"

**시스템 프롬프트 핵심:**
```
당신은 RCA 보고서 검토 보조자입니다.
사용자가 수정을 요청하면:
1. 기존 RCA 컨텍스트를 유지하면서 요청된 부분만 수정하세요.
2. 수정 근거를 메일 원문에서 찾아 제시하세요.
3. 수정할 수 없는 경우(메일에 정보가 없는 경우) 정직하게 알려주세요.
```

---

## Orchestrator 흐름

```typescript
// 의사 코드 (실제 구현은 Copilot SDK API 사용)
async function generateRCA(ticketId: string): AsyncGenerator<RCAStreamEvent> {
  // Step 1: 메일 파싱
  const mailParser = new MailParserAgent();
  const parsedThread = await mailParser.run({ ticketId });

  // Step 2: RCA 생성 (스트리밍)
  const rcaGenerator = new RCAGeneratorAgent();
  for await (const chunk of rcaGenerator.stream({ thread: parsedThread })) {
    yield { type: 'rca_chunk', data: chunk };
  }

  // Step 3: ReviewAssistant는 사용자 요청 시에만 호출
}
```

---

## Agent 간 데이터 흐름

```
[Raw Mail Data]
     │
     ▼ fetchMailThread tool
[MailParserAgent]
     │
     ▼ ParsedMailThread
[RCAGeneratorAgent]
     │
     ▼ RCADocument (스트리밍)
[Frontend UI]
     │
     ▼ 사용자 수정 요청 (선택)
[ReviewAssistantAgent]
     │
     ▼ 수정된 섹션
[Frontend UI 업데이트]
```

---

## 에러 처리 전략

| 상황 | 처리 |
|------|------|
| Azure OpenAI 타임아웃 | 30초 타임아웃, 재시도 1회, 이후 사용자에게 알림 |
| 토큰 한계 초과 | 메일 스레드 청킹 (최근 30통 우선) |
| JSON 파싱 실패 | 부분 결과 반환 + 실패 섹션 표시 |
| Graph API 인증 실패 | 토큰 갱신 시도, 실패 시 재로그인 안내 |
| Rate Limit (429) | 지수 백오프 재시도 (1s, 2s, 4s) |

---

## 프롬프트 관리 원칙

1. **시스템 프롬프트는 코드 내 상수로 관리** (별도 파일 `prompts/` 폴더)
2. **Few-shot 예시는 1~2개만** (토큰 절약, 과적합 방지)
3. **출력 형식은 JSON Schema로 강제** (structured output)
4. **사용자 입력은 별도 변수로 주입** (프롬프트 인젝션 방지)
5. **한국어 출력 품질 검증:** 번역투 체크 프롬프트 포함
