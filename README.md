# 🤖 Vendor Support RCA Copilot

> MSP 엔지니어가 벤더 서포트 이메일 스레드에서 한국어 RCA(Root Cause Analysis) 보고서를 자동 생성하는 Azure AI 기반 생산성 앱

[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-passing-brightgreen)](https://github.com/brilly-bohyun/lipcoding/actions)
[![Azure](https://img.shields.io/badge/Azure-Deployed-0078D4?logo=microsoftazure)](https://portal.azure.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)

## 📋 개요

해외 벤더 서포트팀과 Outlook 이메일로 주고받는 긴 Support Ticket 스레드에서:
- ✅ AI가 한국어 RCA 보고서 자동 생성
- ✅ 장애 요약, 타임라인, 근본 원인, 조치 내역을 6개 섹션으로 정리
- ✅ 사람이 검토/수정 후 Word 문서 내보내기 또는 Slack 공유
- ✅ Microsoft Entra ID 인증으로 실제 Outlook 메일 연동 (V1)

## 🏗️ Azure 아키텍처

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                  Vendor Support RCA Copilot - Azure Architecture                  ║
╚═══════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────┐         ┌──────────────────────┐         ┌────────────────────┐
│    GitHub       │         │  Microsoft Entra ID  │         │  External Services │
│                 │         │                      │         │                    │
│  ⚙️  GitHub     │         │    🔐 Azure AD       │         │  📧 MS Graph API   │
│     Actions     │────────▶│    Authentication    │◀────────│  📧 Outlook Mails  │
│  (CI/CD)        │         │    (MSAL/OIDC)       │         │                    │
│                 │         │                      │         │  💬 Slack Webhook  │
│  🤖 GitHub      │         │                      │         │  💬 Notifications  │
│     Models      │         │                      │         │                    │
│  (GPT-4o)       │         │                      │         │                    │
└─────────────────┘         └──────────────────────┘         └────────────────────┘
        │                              │
        │ Deploy                       │ Auth Token
        ▼                              ▼
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                    Azure Cloud - rg-rca-copilot-prod (Korea Central)             ║
║                                                                                    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  COMPUTE LAYER                                                            │   ║
║  │                                                                            │   ║
║  │   ┌────────────────────┐              ┌─────────────────────┐            │   ║
║  │   │  🌐 App Service    │              │  ⚡ Functions App   │            │   ║
║  │   │  app-rca-copilot   │◀────API─────▶│  func-rca-copilot  │            │   ║
║  │   │  (React SPA)       │              │  (Node.js 20)      │            │   ║
║  │   │  Frontend          │              │  Backend API       │            │   ║
║  │   │  24/7 Hosting      │              │  Serverless        │            │   ║
║  │   └────────────────────┘              └─────────────────────┘            │   ║
║  │            │                                      │                       │   ║
║  └────────────┼──────────────────────────────────────┼───────────────────────┘   ║
║               │                                      │                            ║
║               │                                      │                            ║
║  ┌────────────┼──────────────────────────────────────┼───────────────────────┐   ║
║  │  STORAGE AND SECURITY LAYER                      │                        │   ║
║  │            │                                      │                        │   ║
║  │   ┌────────▼────────┐   ┌─────────────┐   ┌─────▼───────────────┐        │   ║
║  │   │  💾 Storage     │   │  🔑 Key     │◀──│  Managed Identity   │        │   ║
║  │   │  strcacopilot   │   │     Vault   │   │  (Secure Access)    │        │   ║
║  │   │  Blob, Table    │   │  kv-rca-*   │   └─────────────────────┘        │   ║
║  │   │  RCA Docs       │   │  Secrets    │                                   │   ║
║  │   └─────────────────┘   └─────────────┘                                   │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                    ║
║  ┌──────────────────────────────────────────────────────────────────────────┐   ║
║  │  MONITORING                                                               │   ║
║  │                                                                            │   ║
║  │         ┌─────────────────────────────────────────────┐                  │   ║
║  │         │  📊 Application Insights                    │                  │   ║
║  │         │  appi-rca-copilot-prod                      │                  │   ║
║  │         │  Telemetry, Logs, Performance Monitoring    │                  │   ║
║  │         └─────────────────────────────────────────────┘                  │   ║
║  └──────────────────────────────────────────────────────────────────────────┘   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝

                                     ▲
                                     │ HTTPS
                          ┌──────────┴──────────┐
                          │   👤 MSP Engineer   │
                          │   (End User)        │
                          └─────────────────────┘
```

### 데이터 흐름

| 단계 | 설명 | 기술 |
|------|------|------|
| **① Login** | MSP 엔지니어가 Microsoft 계정으로 로그인 | MSAL (OAuth 2.0/OIDC) |
| **② Token** | Entra ID가 Access Token 발급 → Frontend | JWT Bearer Token |
| **③ API** | Frontend가 Backend Functions 호출 | REST API (HTTPS) |
| **④ Backend** | Functions App이 비즈니스 로직 처리 | |
| ├─ **④a Mail** | Microsoft Graph API로 Outlook 메일 조회 | On-behalf-of Flow |
| ├─ **④b AI** | GitHub Models (GPT-4o)로 RCA 생성 | Streaming SSE |
| ├─ **④c Secrets** | Key Vault에서 API 키 읽기 | Managed Identity |
| ├─ **④d Store** | Storage Account에 RCA 문서 저장 | Azure Blob |
| └─ **④e Logs** | Application Insights로 텔레메트리 전송 | OpenTelemetry |
| **⑤ Share** | Slack Webhook으로 RCA 공유 | Incoming Webhook |

### 보안 설계

✅ **HTTPS Only** — TLS 1.2+ 강제  
✅ **CORS Restricted** — localhost:5173, production domain만 허용  
✅ **Managed Identity** — 하드코딩된 시크릿 없음  
✅ **Key Vault** — 런타임 시크릿 중앙 관리  
✅ **Entra ID Auth** — MSAL/OIDC 인증  
✅ **Secret Scan** — CI/CD에서 gitleaks로 시크릿 검출

### CI/CD 파이프라인 흐름

```
GitHub Actions (workflow_dispatch)
  └─→ Deploy Infrastructure (Bicep)
       ├─ Functions App 생성
       ├─ App Service 생성
       ├─ Storage Account 생성
       ├─ Key Vault 생성 (Secrets 저장)
       └─ Application Insights 생성
  └─→ Build (Backend + Frontend 병렬)
  └─→ Deploy (Functions + App Service)
  └─→ Health Check
```

### 🔑 주요 Azure 리소스

| 서비스 | 리소스명 | 역할 |
|--------|---------|------|
| **App Service** | `app-rca-copilot-prod` | React SPA 호스팅 (24시간 가동) |
| **Functions App** | `func-rca-copilot-prod` | 서버리스 백엔드 API (이벤트 기반) |
| **Storage Account** | `strcacopilotprod` | RCA 문서 및 로그 저장 |
| **Key Vault** | `kv-rca-copilot-prod` | API 키/토큰 보안 관리 |
| **Application Insights** | `appi-rca-copilot-prod` | 성능 모니터링 및 로깅 |
| **Entra ID App** | `96804e88-...` | MSAL 인증 (OIDC) |

### 🔒 시크릿 관리 전략

```
GitHub Secrets (CI/CD 전용)
  ├─ AZURE_CLIENT_ID
  ├─ AZURE_TENANT_ID
  ├─ AZURE_SUBSCRIPTION_ID
  ├─ GH_MODELS_TOKEN ──┐
  └─ SLACK_WEBHOOK_URL ┘
           │
           ▼ (Bicep 배포 시 전달)
Azure Key Vault (런타임 보관)
  ├─ github-models-token
  ├─ slack-webhook-url
  └─ (미래: azure-openai-key)
           │
           ▼ (Managed Identity로 접근)
Functions App 설정
  └─ @Microsoft.KeyVault(VaultName=kv-rca-copilot-prod;SecretName=...)
```

## 🛠️ 기술 스택

| 레이어 | 기술 |
|--------|------|
| **Frontend** | React 18 + TypeScript + Vite + Fluent UI React |
| **Backend** | Azure Functions v4 (Node.js 20 LTS, TypeScript) |
| **AI** | GitHub Models (GPT-4o) + GitHub Copilot SDK |
| **인증** | Microsoft Entra ID (MSAL) |
| **데이터** | Azure Table Storage |
| **배포** | Azure App Service + Functions + GitHub Actions |
| **모니터링** | Application Insights |
| **보안** | Azure Key Vault + Managed Identity |

## 📂 프로젝트 구조

```
lipcoding/
├── frontend/              # React SPA
│   ├── src/
│   │   ├── components/    # Fluent UI 컴포넌트
│   │   ├── pages/         # TicketList, TicketDetail, RCAView
│   │   ├── hooks/         # useAuth, useMsal
│   │   └── services/      # API 호출 레이어
│   └── package.json
├── backend/               # Azure Functions
│   ├── src/
│   │   ├── functions/     # HTTP Triggers (health, tickets, rca)
│   │   ├── agents/        # Copilot SDK Agents
│   │   ├── tools/         # Agent Tools
│   │   └── services/      # 비즈니스 로직
│   ├── samples/           # 샘플 메일 데이터 (JSON)
│   └── package.json
├── shared/                # 공통 TypeScript 타입
├── infra/                 # Bicep IaC (main.bicep)
├── docs/                  # 설계 문서 9개
└── .github/
    └── workflows/
        ├── quality-guard.yml  # CI (lint, test, secret scan)
        └── deploy.yml         # CD (infra → build → deploy)
```

## 🚀 빠른 시작 (로컬 개발)

### 사전 요구사항

- Node.js 20+
- Azure Functions Core Tools v4
- GitHub Personal Access Token (GitHub Models 접근용)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/brilly-bohyun/lipcoding.git
cd lipcoding

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp backend/local.settings.json.example backend/local.settings.json
# local.settings.json에 GITHUB_MODELS_TOKEN과 SLACK_WEBHOOK_URL 입력

# 4. 프론트엔드 + 백엔드 동시 실행
npm run dev
```

### 개별 실행

```bash
# 프론트엔드만 (React SPA)
npm run dev:frontend    # → http://localhost:5173

# 백엔드만 (Azure Functions)
npm run dev:backend     # → http://localhost:7071
```

## 🎬 데모 시나리오

### V0 MVP (샘플 데이터)
1. **`http://localhost:5173`** 접속
2. 티켓 목록에서 아무 티켓 클릭 (예: "Azure VM Network Connectivity Issue")
3. 메일 스레드 확인 → 우측 상단 **"RCA 생성"** 버튼 클릭
4. RCA 생성 페이지에서 **"🚀 RCA 생성 시작"** 클릭
5. AI가 한국어 RCA를 실시간 스트리밍으로 생성 (약 30초)
6. 완료 후 6개 섹션 확인:
   - 📋 **장애 요약** (3-5문장)
   - 📅 **타임라인** (표 형식, 시간순 이벤트)
   - 🔍 **근본 원인** (기술적 분석)
   - ✅ **조치 내역** (수행한 작업)
   - 🛡️ **재발 방지 대책** (예방 조치)
   - ❓ **미해결 사항** (추가 확인 필요 항목)
7. 각 섹션의 **"수정"** 버튼으로 인라인 편집 가능
8. **"📄 Word 내보내기"** 버튼으로 .docx 파일 다운로드
9. **"💬 Slack 공유"** 버튼으로 채널에 공유 (확인 다이얼로그 표시)

### V1 (실제 Outlook 메일)
- Microsoft 계정으로 로그인 → 실제 Outlook 메일 스레드로 RCA 생성

## 🔌 API 엔드포인트

| Method | Route | 설명 |
|--------|-------|------|
| `GET` | `/api/health` | 서버 상태 확인 |
| `GET` | `/api/tickets` | 티켓 목록 (샘플 또는 실제) |
| `GET` | `/api/tickets/{id}` | 티켓 상세 (메일 스레드) |
| `POST` | `/api/rca/generate` | RCA 생성 (SSE 스트리밍) |
| `POST` | `/api/rca/export-word` | Word 문서 생성 |
| `POST` | `/api/rca/share-slack` | Slack 채널 공유 |

## ⚙️ 환경변수

### 로컬 개발 (`backend/local.settings.json`)

| 변수 | 용도 | 필수 여부 |
|------|------|----------|
| `GITHUB_MODELS_TOKEN` | GitHub Models API 인증 (GPT-4o) | ✅ 필수 |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | ✅ 필수 |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 엔드포인트 (대안) | 선택 |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API 키 (대안) | 선택 |
| `AZURE_OPENAI_DEPLOYMENT` | 배포 모델명 (gpt-4o) | 선택 |

> **참고:** Azure OpenAI가 없어도 GitHub Models로 동작합니다!

### Azure 배포 (Key Vault 관리)

배포 시 모든 시크릿은 Azure Key Vault에 저장되며, Functions App이 Managed Identity로 읽습니다.

## 🚢 Azure 배포

### CI/CD 파이프라인

GitHub Actions를 통해 완전 자동화된 배포:

```
git push main
  ↓
Quality Guard (CI)
  ├─ ESLint + Prettier
  ├─ TypeScript 타입 체크
  ├─ Unit/Integration 테스트
  ├─ Secret Scan (gitleaks)
  └─ Build 검증
  ↓ (Pass)
Deploy to Azure (CD)
  ├─ 1️⃣ Deploy Infrastructure (Bicep)
  │    └─ Functions, App Service, Storage, Key Vault 프로비저닝
  ├─ 2️⃣ Build Backend + Frontend (병렬)
  ├─ 3️⃣ Deploy Backend → Functions
  ├─ 4️⃣ Deploy Frontend → App Service
  └─ 5️⃣ Health Check
```

### 수동 배포 트리거

```bash
# GitHub Actions → "Deploy to Azure" 워크플로우 → "Run workflow"
# deploy_infra: true (최초 1회)
# 이후에는 false로 설정 (앱만 재배포)
```

### Azure 리소스 프로비저닝 (Bicep)

```bash
# 로컬에서 Bicep 배포 (선택)
cd infra
az deployment group create \
  --resource-group rg-rca-copilot-prod \
  --template-file main.bicep \
  --parameters \
    location=koreacentral \
    githubModelsToken="$GH_MODELS_TOKEN" \
    slackWebhookUrl="$SLACK_WEBHOOK_URL"
```

## 📊 모니터링

- **Application Insights:** 실시간 텔레메트리, 로그 검색
- **Azure Portal:** 리소스 상태, 메트릭 대시보드
- **Health Endpoint:** `https://func-rca-copilot-prod.azurewebsites.net/api/health`

## 🔐 보안 및 Responsible AI

### 보안 설계

| 영역 | 구현 |
|------|------|
| **인증** | Microsoft Entra ID (MSAL) OIDC |
| **시크릿 관리** | Azure Key Vault (Managed Identity) |
| **네트워크** | HTTPS only, CORS 제한 |
| **CI/CD** | Secret Scan (gitleaks), Branch Protection |
| **모니터링** | Application Insights (민감 정보 마스킹) |

### Responsible AI 원칙

✅ **Human-in-the-loop:** AI 생성 결과를 사람이 검토 후 수정 가능  
✅ **투명성:** RCA 각 섹션에 근거 메일 번호 참조  
✅ **사용자 주도권:** 자동 전송 없음, 모든 공유는 명시적 확인  
✅ **면책 안내:** Footer에 "AI 생성 콘텐츠 검토 필수" 문구 표시  
✅ **프롬프트 인젝션 방지:** 사용자 입력을 별도 변수로 주입  
✅ **환각(Hallucination) 완화:** 메일 원문 기반 사실만 기술

## 📚 설계 문서

- [📄 프로젝트 브리프](docs/PROJECT_BRIEF.md) — 배경, 목표, 핵심 사용자 흐름
- [🏗️ 아키텍처](docs/ARCHITECTURE.md) — 기술 스택, 데이터 흐름, 컴포넌트 구조
- [🎯 MVP 범위](docs/MVP_SCOPE.md) — V0-V3 단계별 구현 범위
- [🤖 Agent 역할](docs/AGENT_ROLES.md) — Copilot SDK Agent 정의
- [💾 데이터 모델](docs/DATA_MODEL.md) — TypeScript 인터페이스, 스키마
- [🔌 API 명세](docs/API_SPEC.md) — 엔드포인트, 요청/응답 예시
- [📋 구현 계획](docs/IMPLEMENTATION_PLAN.md) — Step-by-Step 작업 목록
- [☁️ Azure 배포 계획](docs/AZURE_DEPLOYMENT_PLAN.md) — Bicep, CI/CD 설계
- [📖 PRD](docs/PRD.md) — 제품 요구사항 정의서
- [✅ 심사 기준 대응](docs/CRITERIA.md) — GitHub Copilot 앱 심사 기준 매핑

## 🧑‍💻 개발 참고

### GitHub Copilot Agent 구조

이 프로젝트는 GitHub Copilot SDK를 사용한 다중 에이전트 아키텍처를 채택했습니다:

1. **MailParserAgent** — 메일 스레드 파싱 & 정리
2. **RCAGeneratorAgent** — 한국어 RCA 6섹션 생성
3. **ReviewAssistantAgent** — 검토 보조 (재생성, 질의응답)
4. **ExportAgent** — Word 생성 & Slack 공유
5. **QualityGuardAgent** — CI/CD 품질 검증 (lint, test, secret scan)

자세한 내용은 [AGENTS.md](AGENTS.md)를 참고하세요.

### Copilot Instructions

이 프로젝트는 `.github/copilot-instructions.md`에 프로젝트별 컨텍스트를 정의하여 GitHub Copilot이 코드 작성 시 참고하도록 설정했습니다.

### 코딩 규칙

- TypeScript strict mode 사용
- 환경변수는 `.env` 파일로 관리 (하드코딩 금지)
- 에러 처리: try-catch + 사용자 친화적 메시지
- Fluent UI React 컴포넌트 우선 사용
- 주석은 "왜(why)"를 설명할 때만 작성

## 🐛 트러블슈팅

### 로컬 실행 오류

**문제:** `Cannot find module './index.js'`  
**해결:** `npm run build -w backend` 실행 후 재시도

**문제:** `GITHUB_MODELS_TOKEN not configured`  
**해결:** `backend/local.settings.json`에 토큰 추가

**문제:** CORS 오류  
**해결:** `backend/host.json`에서 CORS 설정 확인 (localhost:5173 허용)

### Azure 배포 오류

**문제:** Key Vault 접근 권한 오류  
**해결:** Functions App의 Managed Identity가 Key Vault RBAC에 등록되었는지 확인

**문제:** Bicep 배포 실패 (할당량 초과)  
**해결:** Azure Portal에서 해당 서비스 할당량 증가 요청

## 🤝 기여

본 프로젝트는 Private 저장소입니다. 기여는 프로젝트 관리자 승인 후 가능합니다.

## 📝 라이선스

Private — Unauthorized copying of this project is strictly prohibited.

---

**Built with ❤️ using GitHub Copilot SDK and Azure AI**
