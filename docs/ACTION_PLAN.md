# Action Plan — Vendor Support RCA Copilot

## 현재 상태

- [x] 설계 문서 9개 완성
- [x] .env.example / .gitignore 설정
- [ ] GitHub Issues 생성
- [ ] V0 구현 시작

---

## Phase V0: MVP (샘플 데이터 + AI RCA 생성)

### Step 1: 프로젝트 초기 설정
- monorepo 구조 생성 (frontend/, backend/, shared/)
- npm workspaces 설정
- tsconfig, eslint, prettier 설정
- **완료 기준:** `npm install` 성공

### Step 2: 백엔드 Azure Functions 프로젝트
- Azure Functions v4 (Node.js 20, TypeScript) 초기화
- Health check API (`GET /api/health`)
- CORS 설정 (localhost:5173)
- **완료 기준:** `func start` → health API 200 OK

### Step 3: 샘플 메일 데이터 생성
- 5개 시나리오 JSON 파일 (실제 벤더 서포트 패턴)
- `GET /api/tickets` 엔드포인트
- **완료 기준:** API에서 5개 티켓 목록 반환

### Step 4: Copilot SDK Agent — RCA Generator
- GitHub Copilot SDK 설치
- MailParserAgent + RCAGeneratorAgent 구현
- Azure OpenAI GPT-4o 연결
- SSE 스트리밍 응답
- **완료 기준:** `POST /api/rca/generate` → 한국어 RCA 6섹션 스트리밍

### Step 5: 프론트엔드 초기화
- Vite + React + TypeScript + Fluent UI
- 라우팅 (/tickets, /tickets/:id, /rca/:id)
- **완료 기준:** `npm run dev` → localhost:5173 앱 표시

### Step 6: 프론트엔드 — 티켓 & RCA UI
- 티켓 목록 (DataGrid)
- 메일 스레드 표시
- RCA 생성 버튼 → 스트리밍 표시
- RCA 6섹션 인라인 수정
- **완료 기준:** E2E 데모 1회 통과

### Step 7: 통합 & 문서화
- 프론트↔백엔드 통합 검증
- README.md 작성
- `npm run dev` 한 명령어로 전체 기동
- **완료 기준:** 클론 → 설치 → 실행 → 데모 가능

---

## Phase V1: Outlook 연동

### Step 8: Microsoft Entra ID 설정
- Azure Portal 앱 등록
- MSAL 프론트엔드 인증
- **완료 기준:** Microsoft 계정 로그인 성공

### Step 9: Graph API 메일 연동
- On-behalf-of flow로 메일 가져오기
- 실제 Outlook 메일로 RCA 테스트
- **완료 기준:** 실제 메일 5건 RCA 생성 성공

---

## Phase V2: Export & Share

### Step 10: Word Export
- docx 패키지로 RCA → .docx 변환
- **완료 기준:** Word 파일 다운로드, 한글 정상 표시

### Step 11: Slack 공유
- Slack Webhook + Block Kit 메시지
- 전송 전 미리보기 → 확인 후 전송
- **완료 기준:** 지정 채널에 RCA 요약 도착

### Step 12: RCA 영구 저장
- Azure Table Storage 연동
- **완료 기준:** 새로고침 후에도 RCA 유지

---

## Phase V3: 배포 & 운영

### Step 13: Azure 인프라 (Bicep)
- 리소스 프로비저닝 스크립트
- Key Vault 시크릿 설정
- **완료 기준:** 스크립트 1회로 전체 인프라 생성

### Step 14: GitHub Actions CI/CD
- quality-guard.yml (lint, test, secret scan, build)
- deploy-frontend.yml / deploy-backend.yml
- Branch protection rule
- **완료 기준:** PR merge → 자동 배포

### Step 15: 모니터링 & 보안
- Application Insights 연동
- Managed Identity 설정
- **완료 기준:** 대시보드에서 메트릭 확인 가능

---

## 실행 방식

각 Step을 GitHub Issue로 생성하고, Copilot에게 하나씩 할당합니다.
Issue 본문에는 해당 Step의 상세 요구사항 + 완료 기준을 포함합니다.
의존성이 있는 Step은 이전 Step 완료 후 시작합니다.
