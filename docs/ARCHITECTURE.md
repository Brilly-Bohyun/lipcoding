# Architecture — Vendor Support RCA Copilot

## 시스템 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 (MSP 엔지니어)                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────────────┐
│              Azure App Service (Frontend)                         │
│              React + Vite SPA                                    │
│              - 티켓 목록/선택 UI                                   │
│              - RCA 검토/수정 에디터                                 │
│              - Export/Share 버튼                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────────────┐
│              Azure Functions (Backend API)                        │
│              Node.js / TypeScript                                 │
│              ┌──────────────────────────────────────────┐        │
│              │  /api/tickets       - 티켓 목록 조회       │        │
│              │  /api/tickets/:id   - 티켓 상세 조회       │        │
│              │  /api/rca/generate  - RCA 생성 요청        │        │
│              │  /api/rca/:id       - RCA 조회/수정        │        │
│              │  /api/export/word   - Word 내보내기        │        │
│              │  /api/share/slack   - Slack 공유           │        │
│              └──────────────────────────────────────────┘        │
└───────┬──────────────┬──────────────────┬───────────────────────┘
        │              │                  │
        ▼              ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
│ Microsoft    │ │ Azure OpenAI │ │ External Services    │
│ Graph API    │ │ (Foundry)    │ │                      │
│              │ │              │ │ - Slack Webhook      │
│ - Mail Read  │ │ - GPT-4o    │ │ - (Future: Teams)    │
│ - User Info  │ │ - RCA 생성   │ │                      │
└──────────────┘ └──────────────┘ └──────────────────────┘
        │              │
        │              │
        ▼              ▼
┌─────────────────────────────────────────┐
│       GitHub Copilot SDK                 │
│       (Agent Orchestration Layer)        │
│                                          │
│  - Mail Parser Agent                     │
│  - RCA Generator Agent                   │
│  - Review Assistant Agent                │
│  - Export Agent                           │
└─────────────────────────────────────────┘
```

## 컴포넌트 상세

### 1. Frontend (Azure App Service)

- **런타임:** Azure App Service (Linux, B1 tier)
- **프레임워크:** React 18 + TypeScript + Vite
- **UI 라이브러리:** Fluent UI React (Microsoft 디자인 시스템)
- **상태 관리:** Zustand (경량)
- **인증:** MSAL.js (Microsoft Entra ID)

**선택 이유:**
- App Service는 24시간 가용 (Always On)
- Fluent UI는 Microsoft 생태계와 일관된 UX
- 서버리스 SSR 불필요 (SPA로 충분)

### 2. Backend (Azure Functions)

- **런타임:** Azure Functions v4 (Node.js 20 LTS)
- **호스팅 플랜:** Consumption Plan (V0~V2) → Premium Plan (V3 운영)
- **언어:** TypeScript
- **트리거:** HTTP Trigger (API), Timer Trigger (선택)

**선택 이유:**
- 이벤트 기반 서버리스로 비용 효율적
- Cold start 허용 가능 (실시간 스트리밍이 아님)
- Azure Functions의 Microsoft Graph 바인딩 활용 가능

### 3. AI 계층 (Azure OpenAI + Copilot SDK)

- **모델:** Azure OpenAI GPT-4o (Microsoft Foundry 배포)
- **SDK:** GitHub Copilot SDK (에이전트 정의, 도구 호출, 스트리밍)
- **프롬프트 관리:** 구조화된 시스템 프롬프트 + Few-shot 예시

**Copilot SDK 활용 포인트:**
1. **Multi-Agent 오케스트레이션:** 메일 파싱 → RCA 생성 → 검토 보조를 에이전트 체인으로 구성
2. **Tool Calling:** Graph API 호출, 문서 생성을 도구로 등록
3. **Streaming:** RCA 생성 과정을 실시간으로 사용자에게 스트리밍
4. **Context Management:** 긴 메일 스레드를 효과적으로 컨텍스트에 주입

### 4. 데이터 저장소

- **V0~V1:** Azure Table Storage (간단한 Key-Value)
- **V2+:** Azure Cosmos DB (NoSQL, 구조화된 RCA 문서)

**저장 데이터:**
- 생성된 RCA 문서 (JSON)
- 사용자 수정 이력
- 티켓 메타데이터 캐시

### 5. 인증 & 보안

- **인증:** Microsoft Entra ID (Azure AD)
- **권한:** Mail.Read, User.Read (Graph API)
- **비밀 관리:** Azure Key Vault (Production) / .env (Development)
- **CORS:** App Service origin만 허용

## 네트워크 흐름

```
사용자 브라우저
    │
    │ (1) MSAL 로그인 → Entra ID → Access Token
    │
    │ (2) API 호출 (Bearer Token)
    ▼
Azure Functions
    │
    ├─ (3a) Graph API 호출 (On-behalf-of flow) → Outlook 메일 가져오기
    │
    ├─ (3b) Azure OpenAI 호출 (API Key / Managed Identity)
    │        └─ Copilot SDK Agent 실행
    │
    └─ (3c) Slack Webhook 호출 → 채널 메시지 전송
```

## 환경 분리

| 환경 | Frontend | Backend | AI |
|------|----------|---------|-----|
| Local Dev | localhost:5173 | localhost:7071 | Azure OpenAI (dev endpoint) |
| Staging | App Service (staging slot) | Functions (staging slot) | Azure OpenAI (dev deployment) |
| Production | App Service (prod) | Functions (prod) | Azure OpenAI (prod deployment) |

## 확장성 고려

- Azure Functions Consumption Plan은 자동 스케일링
- App Service는 수동 스케일업 가능 (B1 → S1)
- Cosmos DB는 RU 기반 자동 스케일링
- 향후 Azure Event Grid로 비동기 이벤트 처리 가능
