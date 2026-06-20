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
       ├─── (3) ReviewAssistantAgent → 검토 보조 (재생성, 질의응답)
       │
       └─── (4) ExportAgent          → Word 생성 & Slack 공유
```

```
CI/CD Pipeline (GitHub Actions)
       │
       ▼
┌──────────────────┐
│ QualityGuardAgent│  ← PR/Push 시 자동 실행
└──────┬───────────┘
       │
       ├─── lint check (ESLint + Prettier)
       ├─── unit/integration test
       ├─── secret scan (hardcoded key 탐지)
       └─── build verification
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

### 4. ExportAgent

**역할:** 완성된 RCA를 Word 문서로 변환하거나 Slack 채널에 공유

**입력:** `RCADocument` + 내보내기 옵션 (형식, 대상 채널)

**출력:**
```typescript
interface ExportResult {
  type: 'word' | 'slack';
  success: boolean;
  // Word: 다운로드 URL 또는 Buffer
  fileUrl?: string;
  // Slack: 메시지 timestamp (전송 확인용)
  slackMessageTs?: string;
  error?: string;
}
```

**도구 (Tools):**
- `generateWordDocument(rca, template)` — docx 패키지로 RCA를 Word 파일로 변환
- `sendSlackMessage(channel, blocks)` — Slack Incoming Webhook으로 Block Kit 메시지 전송
- `formatSlackBlocks(rca)` — RCA를 Slack Block Kit 형식으로 포맷팅

**시스템 프롬프트 핵심:**
```
당신은 문서 변환 및 공유 전문가입니다.

Word 내보내기:
- RCA 6개 섹션을 표준 보고서 템플릿에 매핑하세요.
- 타임라인은 표(table) 형식으로 렌더링하세요.
- 한글 폰트(맑은 고딕)를 기본으로 사용하세요.

Slack 공유:
- 요약(summary)과 근본 원인(rootCause)을 핵심 정보로 포함하세요.
- 전체 내용을 보내지 말고, "상세 보기" 링크를 포함하세요.
- Block Kit 형식으로 가독성 좋게 구성하세요.
```

**Human-in-the-loop:**
- Word 내보내기: 사용자가 "Export" 버튼을 명시적으로 클릭해야 실행
- Slack 공유: 전송 전 미리보기 표시 → 사용자 확인 후 전송

---

### 5. QualityGuardAgent

**역할:** CI/CD 파이프라인에서 코드 품질, 보안, 테스트를 자동 검증

**실행 환경:** GitHub Actions (PR 생성/Push 시 자동 트리거)

**검증 항목:**

| 검증 | 도구 | 실패 시 동작 |
|------|------|-------------|
| Lint 검사 | ESLint + Prettier | PR 블록, 에러 위치 코멘트 |
| 타입 체크 | `tsc --noEmit` | PR 블록 |
| 단위 테스트 | Vitest (frontend), Jest (backend) | PR 블록, 실패 테스트 리포트 |
| 통합 테스트 | API endpoint 호출 테스트 | PR 블록 |
| Secret 스캔 | `gitleaks` + custom regex | PR 블록, 보안 경고 |
| 빌드 검증 | `npm run build` (frontend + backend) | PR 블록 |
| 의존성 취약점 | `npm audit` | 경고 (critical은 블록) |

**Secret 스캔 규칙:**
```yaml
# .gitleaks.toml에 정의
rules:
  - description: "Azure API Key"
    regex: '[a-f0-9]{32}'
    path: '(?i)(\.ts|\.js|\.json)$'
    allowlist:
      - '.env.example'  # 예시 파일은 허용

  - description: "Slack Webhook URL"
    regex: 'https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[a-zA-Z0-9]+'

  - description: "Hardcoded secret pattern"
    regex: '(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*["\x27][^"\x27]{8,}'
    allowlist:
      - '.env.example'
      - '*.test.ts'
```

**GitHub Actions 워크플로우 구조:**
```yaml
# .github/workflows/quality-guard.yml
name: Quality Guard

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test -- --coverage

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build:
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
```

**완료 기준:**
- PR 생성 시 모든 검증이 자동 실행됨
- 하나라도 실패하면 merge 불가 (branch protection rule)
- Secret이 감지되면 PR에 경고 코멘트 자동 생성
- 테스트 커버리지 리포트가 PR에 표시됨

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

async function exportRCA(rca: RCADocument, target: 'word' | 'slack'): Promise<ExportResult> {
  // Step 4: Export (사용자 명시적 요청 시)
  const exportAgent = new ExportAgent();
  return await exportAgent.run({ rca, target });
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
[Frontend UI — 검토/수정]
     │
     ├─▶ 사용자 수정 요청 (선택)
     │   └─▶ [ReviewAssistantAgent] → 수정된 섹션 → UI 업데이트
     │
     ├─▶ "Word 내보내기" 클릭
     │   └─▶ [ExportAgent] → .docx 파일 → 다운로드
     │
     └─▶ "Slack 공유" 클릭
         └─▶ [ExportAgent] → Slack 메시지 → 채널 전송
```

```
[GitHub PR/Push]
     │
     ▼ GitHub Actions trigger
[QualityGuardAgent]
     │
     ├─▶ lint → pass/fail
     ├─▶ typecheck → pass/fail
     ├─▶ test → pass/fail + coverage
     ├─▶ secret-scan → pass/alert
     └─▶ build → pass/fail
         │
         ▼
[PR Status Check] → merge 허용/차단
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
