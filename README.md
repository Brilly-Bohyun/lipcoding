# Vendor Support RCA Copilot

MSP 엔지니어가 벤더 서포트 이메일 스레드에서 한국어 RCA(Root Cause Analysis) 보고서를 자동 생성하는 AI 기반 생산성 앱.

## 프로젝트 구조

```
├── frontend/    # React + Vite + Fluent UI (Azure App Service)
├── backend/     # Azure Functions v4 (Node.js 20, TypeScript)
├── shared/      # 프론트/백 공통 타입
├── docs/        # 설계 문서
└── infra/       # Bicep IaC (추후)
```

## 기술 스택

- **Frontend:** React 18 + TypeScript + Vite + Fluent UI React
- **Backend:** Azure Functions v4 (Node.js 20 LTS)
- **AI:** Azure OpenAI GPT-4o (Microsoft Foundry) + GitHub Copilot SDK
- **인증:** Microsoft Entra ID (MSAL)
- **데이터:** Azure Table Storage

## 로컬 개발

### 사전 요구사항

- Node.js 20+
- Azure Functions Core Tools v4
- Azure OpenAI 리소스 (GPT-4o)

### 설치 및 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일에 실제 값 채우기

# 3. 프론트엔드 + 백엔드 동시 실행
npm run dev
```

### 개별 실행

```bash
# 프론트엔드만
npm run dev:frontend    # http://localhost:5173

# 백엔드만
npm run dev:backend     # http://localhost:7071
```

## 환경변수

`.env.example` 참조. 최소 필요 항목:

| 변수 | 용도 | 필요 시점 |
|------|------|-----------|
| `AZURE_OPENAI_ENDPOINT` | AI 모델 엔드포인트 | V0 |
| `AZURE_OPENAI_API_KEY` | AI 모델 인증 | V0 |
| `AZURE_OPENAI_DEPLOYMENT` | 배포 모델명 | V0 |

## 설계 문서

- [프로젝트 브리프](docs/PROJECT_BRIEF.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [MVP 범위](docs/MVP_SCOPE.md)
- [구현 계획](docs/IMPLEMENTATION_PLAN.md)
- [Azure 배포 계획](docs/AZURE_DEPLOYMENT_PLAN.md)
- [PRD](docs/PRD.md)
- [심사 기준 대응](docs/CRITERIA.md)
- [액션 플랜](docs/ACTION_PLAN.md)

## 라이선스

Private
