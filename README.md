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
cp backend/local.settings.json.example backend/local.settings.json
# local.settings.json에 Azure OpenAI endpoint/key 채우기

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

## 데모 시나리오 (V0 MVP)

1. **`http://localhost:5173`** 접속
2. 티켓 목록에서 아무 티켓 클릭 (예: "Azure VM Network Connectivity Issue")
3. 메일 스레드 확인 → 우측 상단 **"RCA 생성"** 버튼 클릭
4. RCA 생성 페이지에서 **"🚀 RCA 생성 시작"** 클릭
5. AI가 한국어 RCA를 실시간 스트리밍으로 생성
6. 완료 후 6개 섹션 확인:
   - 📋 장애 요약
   - 📅 타임라인 (표 형식)
   - 🔍 근본 원인
   - ✅ 조치 내역
   - 🛡️ 재발 방지 대책
   - ❓ 미해결 사항
7. 각 섹션의 **"수정"** 버튼으로 인라인 편집 가능

## API 엔드포인트

| Method | Route | 설명 |
|--------|-------|------|
| GET | `/api/health` | 서버 상태 확인 |
| GET | `/api/tickets` | 티켓 목록 |
| GET | `/api/tickets/{id}` | 티켓 상세 (메일 스레드) |
| POST | `/api/rca/generate` | RCA 생성 (SSE 스트리밍) |

## 환경변수

`backend/local.settings.json`에 아래 값을 설정하세요:

| 변수 | 용도 | 필요 시점 |
|------|------|-----------|
| `AZURE_OPENAI_ENDPOINT` | AI 모델 엔드포인트 | V0 (필수) |
| `AZURE_OPENAI_API_KEY` | AI 모델 인증 키 | V0 (필수) |
| `AZURE_OPENAI_DEPLOYMENT` | 배포 모델명 (gpt-4o) | V0 (필수) |
| `AZURE_OPENAI_API_VERSION` | API 버전 | V0 (선택) |

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
