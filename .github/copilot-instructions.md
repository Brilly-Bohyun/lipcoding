# Copilot Instructions — Vendor Support RCA Copilot

## 프로젝트 개요

이 프로젝트는 MSP 엔지니어가 벤더 서포트 이메일 스레드에서 한국어 RCA(Root Cause Analysis) 보고서를 자동 생성하는 Azure 기반 생산성 앱입니다.

## 기술 스택

- **Frontend:** React 18 + TypeScript + Vite + Fluent UI React
- **Backend:** Azure Functions v4 (Node.js 20 LTS, TypeScript)
- **AI:** Azure OpenAI GPT-4o (Microsoft Foundry) + GitHub Copilot SDK
- **인증:** Microsoft Entra ID (MSAL)
- **데이터:** Azure Table Storage
- **배포:** Azure App Service (Frontend) + Azure Functions (Backend)

## 프로젝트 구조

```
/
├── frontend/           # React SPA
│   ├── src/
│   │   ├── components/ # UI 컴포넌트
│   │   ├── pages/      # 페이지 컴포넌트
│   │   ├── hooks/      # Custom hooks
│   │   ├── services/   # API 호출 레이어
│   │   └── types/      # TypeScript 타입
│   └── package.json
├── backend/            # Azure Functions
│   ├── src/
│   │   ├── functions/  # HTTP Trigger 함수
│   │   ├── agents/     # Copilot SDK Agent 정의
│   │   ├── tools/      # Agent Tool 정의
│   │   ├── services/   # 비즈니스 로직
│   │   └── types/      # TypeScript 타입
│   ├── samples/        # 샘플 메일 데이터 (JSON)
│   └── package.json
├── shared/             # 프론트/백 공통 타입
├── infra/              # Bicep IaC
├── docs/               # 설계 문서
└── .env.example        # 환경변수 템플릿
```

## 코딩 규칙

### 일반

- TypeScript strict mode 사용
- 모든 함수에 명시적 반환 타입 작성
- 환경변수는 반드시 `.env` 파일로 관리 (하드코딩 금지)
- 에러 처리: try-catch + 사용자 친화적 메시지 반환
- 주석은 "왜(why)"를 설명할 때만 작성

### Frontend

- Fluent UI React 컴포넌트 우선 사용
- 상태 관리: Zustand (전역), useState (로컬)
- API 호출: 커스텀 hook으로 캡슐화
- 로딩/에러 상태를 항상 처리할 것

### Backend (Azure Functions)

- 각 함수는 단일 책임 (하나의 HTTP endpoint = 하나의 함수)
- Copilot SDK Agent는 `agents/` 폴더에 별도 정의
- Tool은 `tools/` 폴더에 별도 정의
- 응답 형식: `{ success: boolean, data?: T, error?: string }`

### Copilot SDK 사용

- Agent 정의 시 시스템 프롬프트에 역할/제약/출력 형식을 명확히 기술
- Tool calling은 반드시 입출력 스키마를 정의
- 스트리밍 응답은 SSE (Server-Sent Events) 사용
- 에러 발생 시 graceful fallback 제공

## 환경변수 (.env)

```
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Microsoft Entra ID
ENTRA_CLIENT_ID=your-client-id
ENTRA_TENANT_ID=your-tenant-id

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# App
FRONTEND_URL=http://localhost:5173
```

## Git 규칙

- 브랜치: `feature/v0-{기능명}`, `feature/v1-{기능명}` 형식
- 커밋 메시지: `feat:`, `fix:`, `docs:`, `chore:` prefix 사용
- PR은 하나의 기능 단위로 생성

## 주의사항

- .env 파일은 절대 커밋하지 않을 것 (.gitignore에 포함)
- 샘플 데이터에 실제 고객/회사명을 사용하지 않을 것
- AI 생성 결과를 자동으로 외부에 전송하지 않을 것 (Human-in-the-loop 필수)
- Azure Functions의 Cold Start를 고려한 타임아웃 설정
- 프론트엔드에서 민감한 정보(API Key 등)를 노출하지 않을 것
