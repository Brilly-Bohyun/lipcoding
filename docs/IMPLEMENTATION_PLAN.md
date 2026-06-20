# Implementation Plan — Vendor Support RCA Copilot

## 구현 단계 요약

| Phase | 이름 | 기간 | 핵심 산출물 |
|-------|------|------|-------------|
| V0 | MVP (샘플 데이터 + AI RCA) | 1~2주 | 로컬 데모 가능한 풀스택 앱 |
| V1 | Outlook 연동 | 1주 | Microsoft Graph API로 실제 메일 연동 |
| V2 | Export & Share | 1주 | Word 문서 생성 + Slack 공유 |
| V3 | Azure 배포 & 운영 | 1주 | Production 배포 + 모니터링 |

---

## Phase V0: MVP — 샘플 데이터 + AI RCA 생성

### V0-1. 프로젝트 초기 설정

**작업:**
- monorepo 구조 생성 (`frontend/`, `backend/`, `shared/`)
- `package.json` 루트 설정 (npm workspaces)
- `.env.example` 작성 (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT)
- `.gitignore`, `tsconfig.json` 기본 설정
- ESLint + Prettier 설정

**완료 기준:**
- `npm install` 성공
- 프로젝트 구조가 README에 설명됨

---

### V0-2. 백엔드 — Azure Functions 로컬 프로젝트 생성

**작업:**
- Azure Functions v4 (Node.js 20, TypeScript) 프로젝트 생성
- `local.settings.json` 템플릿 작성
- Health check endpoint (`GET /api/health`) 구현
- CORS 설정 (localhost:5173 허용)

**완료 기준:**
- `cd backend && func start`로 로컬 서버 기동
- `curl http://localhost:7071/api/health` → 200 OK

---

### V0-3. 샘플 메일 데이터 생성

**작업:**
- `backend/samples/` 폴더에 5개 시나리오 JSON 파일 생성
- 각 시나리오: 티켓 메타데이터 + 10~20개 메일 메시지 배열
- 영어 기술 메일 형식 (From, To, Date, Subject, Body)
- 실제 벤더 서포트 패턴 반영 (초기 보고 → 정보 요청 → 진단 → 해결)

**완료 기준:**
- 5개 JSON 파일, 각각 유효한 구조
- `GET /api/tickets` → 5개 티켓 목록 반환

---

### V0-4. Copilot SDK Agent 구현 — RCA Generator

**작업:**
- GitHub Copilot SDK 설치 및 설정
- `RCAGeneratorAgent` 정의
  - 시스템 프롬프트: MSP 엔지니어 컨텍스트, 한국어 출력, RCA 6섹션 구조
  - Tool: `fetchMailThread` (샘플 JSON 로드)
  - Tool: `parseMailMetadata` (발신자, 날짜, 제목 추출)
- Azure OpenAI GPT-4o 연결 (Microsoft Foundry 배포)
- 스트리밍 응답 지원 (SSE 또는 chunked response)

**완료 기준:**
- `POST /api/rca/generate { ticketId: "sample-1" }` → 한국어 RCA JSON 스트리밍 반환
- 6개 섹션 (summary, timeline, rootCause, resolution, preventiveAction, openQuestions) 모두 포함
- 응답 시간 30초 이내

---

### V0-5. 프론트엔드 — React 프로젝트 초기화

**작업:**
- Vite + React + TypeScript 프로젝트 생성
- Fluent UI React 설치 및 테마 설정
- 라우팅 설정 (React Router): `/tickets`, `/tickets/:id`, `/rca/:id`
- 레이아웃 컴포넌트 (Header, Sidebar, Content)

**완료 기준:**
- `cd frontend && npm run dev` → localhost:5173에서 앱 표시
- 기본 레이아웃 + 라우팅 동작

---

### V0-6. 프론트엔드 — 티켓 목록 & 상세 화면

**작업:**
- 티켓 목록 페이지 (`/tickets`)
  - 백엔드 API에서 티켓 목록 fetch
  - Fluent UI DataGrid로 표시 (제목, 상태, 날짜)
  - 행 클릭 시 상세 페이지로 이동
- 티켓 상세 페이지 (`/tickets/:id`)
  - 메일 스레드 타임라인 표시
  - "RCA 생성" 버튼

**완료 기준:**
- 5개 티켓이 목록에 표시됨
- 티켓 클릭 → 메일 스레드 표시 + RCA 생성 버튼 노출

---

### V0-7. 프론트엔드 — RCA 생성 & 스트리밍 UI

**작업:**
- "RCA 생성" 클릭 → 백엔드 API 호출 (SSE 스트리밍)
- 생성 중 로딩 + 점진적 텍스트 표시 (타이핑 효과)
- 완료 후 RCA 검토 화면으로 전환
- RCA 검토 화면: 6개 섹션 카드, 각 섹션 인라인 편집 가능
- 수정 후 "저장" 버튼 (메모리 저장)

**완료 기준:**
- RCA 생성 시 스트리밍 텍스트가 실시간 표시
- 6개 섹션 모두 수정 가능
- 수정 내용이 화면에 즉시 반영

---

### V0-8. 통합 테스트 & 문서화

**작업:**
- 프론트엔드 ↔ 백엔드 통합 동작 검증
- README.md 작성 (설치, 환경변수, 실행 방법)
- 스크린샷/GIF 캡처 (데모용)

**완료 기준:**
- `npm run dev` 한 명령어로 프론트+백엔드 동시 기동
- 엔드투엔드 데모 시나리오 1회 통과

---

## Phase V1: Microsoft Graph API 연동

### V1-1. Microsoft Entra ID 앱 등록

**작업:**
- Azure Portal에서 앱 등록 (SPA + Web redirect URI)
- API 권한 추가: `Mail.Read`, `User.Read`
- Client ID, Tenant ID를 `.env`에 추가

**완료 기준:**
- 앱 등록 완료, 권한 승인됨
- `.env`에 ENTRA_CLIENT_ID, ENTRA_TENANT_ID 설정

---

### V1-2. 프론트엔드 MSAL 인증

**작업:**
- `@azure/msal-react` 설치
- MSAL Provider 설정
- 로그인/로그아웃 버튼
- Access Token 획득 → API 호출 시 Bearer 헤더 첨부

**완료 기준:**
- Microsoft 계정으로 로그인 성공
- 로그인 후 사용자 이름 표시
- API 호출에 Bearer Token 포함

---

### V1-3. 백엔드 Graph API 연동

**작업:**
- `@microsoft/microsoft-graph-client` 설치
- On-behalf-of flow로 사용자 토큰 → Graph API 호출
- `GET /api/tickets` → Graph API로 실제 메일 폴더/검색 결과 반환
- `GET /api/tickets/:id` → 메일 스레드 전체 내용 반환
- 샘플 데이터 fallback 유지 (인증 없으면 샘플 모드)

**완료 기준:**
- 로그인한 사용자의 실제 Outlook 메일에서 서포트 티켓 검색
- 메일 스레드 내용이 RCA 생성 입력으로 전달됨

---

### V1-4. 메일 파싱 Agent 고도화

**작업:**
- 실제 메일 HTML → 텍스트 변환
- 서명/면책조항 제거 로직
- 인용 메일(> 부분) 정리
- 첨부파일 목록 추출 (내용은 V1에서 미포함)

**완료 기준:**
- 실제 벤더 서포트 메일 5건으로 RCA 생성 테스트 통과
- 불필요한 서명/면책조항이 제거된 상태로 AI에 전달

---

## Phase V2: Word Export & Slack 공유

### V2-1. Word 문서 생성

**작업:**
- `docx` npm 패키지로 RCA Word 템플릿 구현
- 섹션별 스타일 (제목, 본문, 표, 불릿)
- 회사 로고/헤더 삽입 옵션
- `POST /api/export/word` → .docx 파일 다운로드

**완료 기준:**
- RCA 검토 화면에서 "Word 내보내기" 클릭 → .docx 다운로드
- 문서에 6개 섹션 + 타임라인 표 포함
- 한글 폰트 정상 표시

---

### V2-2. Slack 공유 기능

**작업:**
- Slack Incoming Webhook URL을 `.env`에 설정
- `POST /api/share/slack` → Slack 메시지 전송
- 메시지 형식: RCA 요약 + 주요 정보 + 문서 링크(향후)
- Block Kit 메시지 포맷 (보기 좋은 형태)

**완료 기준:**
- "Slack 공유" 클릭 → 지정 채널에 메시지 전송됨
- 메시지에 티켓 제목, 요약, Root Cause 포함

---

### V2-3. RCA 데이터 영구 저장

**작업:**
- Azure Table Storage 연동
- RCA 생성/수정 시 저장
- RCA 이력 목록 조회

**완료 기준:**
- 새로고침 후에도 이전 RCA 유지
- RCA 목록에서 과거 RCA 열람 가능

---

## Phase V3: Azure 배포 & 운영

### V3-1. Azure 리소스 프로비저닝 (IaC)

**작업:**
- Bicep 또는 Azure CLI 스크립트로 리소스 생성
  - Resource Group
  - App Service Plan + App Service (Frontend)
  - Function App + Storage Account (Backend)
  - Azure OpenAI 리소스 (or 기존 연결)
  - Key Vault
- 환경변수를 Key Vault에서 참조하도록 설정

**완료 기준:**
- 스크립트 1회 실행으로 전체 인프라 생성
- Key Vault에 모든 시크릿 저장됨

---

### V3-2. CI/CD 파이프라인 (GitHub Actions)

**작업:**
- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-backend.yml`
- `main` 브랜치 push 시 자동 배포
- 환경별 변수 (GitHub Secrets)

**완료 기준:**
- PR merge → 자동 빌드 + 배포
- 배포 후 health check 통과

---

### V3-3. 모니터링 & 로깅

**작업:**
- Application Insights 연동 (Frontend + Backend)
- 사용자 정의 메트릭: RCA 생성 횟수, 응답 시간, 오류율
- Alert Rule: 오류율 > 5% 시 알림

**완료 기준:**
- Application Insights에서 요청/오류 추적 가능
- 대시보드에 핵심 메트릭 표시

---

### V3-4. 보안 강화

**작업:**
- Managed Identity로 Azure OpenAI / Storage 접근
- Key Vault 참조로 Function App 환경변수 설정
- HTTPS 강제, 커스텀 도메인 (선택)
- Rate limiting (API Management 또는 코드 레벨)

**완료 기준:**
- 하드코딩된 시크릿 없음
- 모든 외부 통신 HTTPS
- API 호출 rate limit 적용

---

## GitHub Issue 작업 목록

아래 Issue를 순서대로 생성하여 Copilot에게 할당합니다.

### V0 Issues

| # | Issue 제목 | 의존성 |
|---|-----------|--------|
| 1 | `[V0] 프로젝트 초기 설정 (monorepo, tsconfig, eslint)` | 없음 |
| 2 | `[V0] Azure Functions 백엔드 프로젝트 생성` | #1 |
| 3 | `[V0] 샘플 메일 데이터 5개 시나리오 생성` | #2 |
| 4 | `[V0] Copilot SDK Agent — RCA Generator 구현` | #2 |
| 5 | `[V0] React 프론트엔드 초기화 (Vite + Fluent UI)` | #1 |
| 6 | `[V0] 프론트엔드 — 티켓 목록 & 상세 화면` | #3, #5 |
| 7 | `[V0] 프론트엔드 — RCA 생성 스트리밍 & 검토 UI` | #4, #6 |
| 8 | `[V0] 통합 테스트 & README 문서화` | #7 |

### V1 Issues

| # | Issue 제목 | 의존성 |
|---|-----------|--------|
| 9 | `[V1] Microsoft Entra ID 앱 등록 & MSAL 설정` | #8 |
| 10 | `[V1] 프론트엔드 MSAL 인증 흐름` | #9 |
| 11 | `[V1] 백엔드 Graph API 메일 연동` | #9, #10 |
| 12 | `[V1] 메일 파싱 Agent 고도화` | #11 |

### V2 Issues

| # | Issue 제목 | 의존성 |
|---|-----------|--------|
| 13 | `[V2] Word 문서 Export 기능` | #8 |
| 14 | `[V2] Slack 공유 기능` | #8 |
| 15 | `[V2] Azure Table Storage RCA 영구 저장` | #8 |

### V3 Issues

| # | Issue 제목 | 의존성 |
|---|-----------|--------|
| 16 | `[V3] Azure 리소스 프로비저닝 (Bicep/CLI)` | #8 |
| 17 | `[V3] GitHub Actions CI/CD 파이프라인` | #16 |
| 18 | `[V3] Application Insights 모니터링` | #17 |
| 19 | `[V3] 보안 강화 (Managed Identity, Key Vault)` | #17 |
