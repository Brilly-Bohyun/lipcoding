# MVP Scope — V0 정의

## V0 목표

**"샘플 메일 데이터로 AI RCA 초안을 생성하고, 웹 UI에서 검토할 수 있는 데모 가능한 엔드투엔드 흐름"**

## In-Scope (V0에 포함)

| 기능 | 설명 | 완료 기준 |
|------|------|-----------|
| 샘플 데이터 | 3~5개의 실제 패턴 기반 샘플 메일 스레드 (JSON) | 파일에서 로드 가능 |
| 티켓 목록 UI | 샘플 티켓 목록 표시 및 선택 | 클릭하면 상세 화면 이동 |
| RCA 생성 | Copilot SDK Agent가 메일 분석 후 한국어 RCA 생성 | 6개 섹션 모두 생성됨 |
| RCA 검토 UI | 생성된 RCA를 섹션별로 표시 + 인라인 수정 | 수정 후 저장 가능 |
| 스트리밍 UX | RCA 생성 중 실시간 텍스트 스트리밍 | 사용자가 생성 과정을 볼 수 있음 |
| 로컬 실행 | `npm run dev`로 프론트+백엔드 동시 실행 | 한 명령어로 기동 |

## Out-of-Scope (V0에서 제외)

- Microsoft Graph API 연동 (실제 Outlook 메일)
- Microsoft Entra ID 인증
- Word 문서 내보내기
- Slack 공유
- Azure 배포
- 다중 사용자 지원
- RCA 이력 관리 (DB 저장)

## RCA 생성 출력 구조 (6개 섹션)

```json
{
  "summary": "장애 요약 (한국어, 3~5문장)",
  "timeline": [
    { "datetime": "2024-01-15 09:00 KST", "event": "이벤트 설명" }
  ],
  "rootCause": "근본 원인 분석 (한국어)",
  "resolution": "조치 내역 및 해결 방법 (한국어)",
  "preventiveAction": "재발 방지 대책 (한국어)",
  "openQuestions": ["미해결 사항 1", "미해결 사항 2"]
}
```

## 샘플 데이터 시나리오

1. **Azure VM 네트워크 연결 장애** - NSG 규칙 충돌로 인한 연결 실패
2. **Azure SQL Database 성능 저하** - DTU 고갈로 인한 쿼리 타임아웃
3. **Azure App Service 502 오류** - 백엔드 풀 헬스체크 실패
4. **AWS EC2 인스턴스 비정상 종료** - EBS 볼륨 I/O 에러
5. **CDN 캐시 무효화 지연** - Purge 요청 전파 지연

## V0 기술 스택 (최소)

| 항목 | 선택 | 비고 |
|------|------|------|
| Frontend | React + Vite + Fluent UI | 로컬 dev server |
| Backend | Azure Functions (local) | `func start`로 로컬 실행 |
| AI | Azure OpenAI GPT-4o | .env에 API key |
| SDK | GitHub Copilot SDK | Agent 정의 + Tool calling |
| 데이터 | JSON 파일 (samples/) | 정적 샘플 |

## V0 완료 기준 체크리스트

- [ ] `npm install && npm run dev` 한 번에 프론트+백엔드 기동
- [ ] 티켓 목록에서 샘플 티켓 선택 가능
- [ ] "RCA 생성" 버튼 클릭 시 AI가 한국어 RCA 생성
- [ ] 생성 중 스트리밍으로 텍스트가 점진적으로 표시
- [ ] 생성된 RCA 6개 섹션이 모두 올바르게 표시
- [ ] 각 섹션을 인라인 수정 가능
- [ ] 수정된 내용이 메모리에 유지됨 (새로고침 시 초기화 OK)
- [ ] .env.example 파일에 필요한 환경변수 목록 정리
- [ ] README.md에 로컬 실행 방법 문서화
