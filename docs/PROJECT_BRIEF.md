# Vendor Support RCA Copilot — Project Brief

## 프로젝트 개요

**Vendor Support RCA Copilot**은 MSP 엔지니어가 해외 벤더 서포트팀과 주고받는 Outlook 이메일 스레드를 AI가 분석하여, 한국어 RCA(Root Cause Analysis) 보고서 초안을 자동 생성하는 생산성 앱입니다.

## 문제 정의

| 문제 | 영향 |
|------|------|
| 벤더 서포트 메일 스레드가 10~50통으로 길어짐 | 맥락 파악에 30분~1시간 소요 |
| 영어 기술 메일을 한국어 RCA로 변환해야 함 | 번역+정리에 추가 1~2시간 |
| 장애 Timeline, Root Cause, Resolution 추출이 수동 | 누락 위험, 품질 편차 |
| 고객 공유용 보고서를 별도로 작성해야 함 | Word 포맷팅에 30분 추가 |

**총 Pain Point:** 1건의 RCA 보고서 작성에 2~4시간 → **목표: 15분 이내로 단축**

## 대상 사용자

- **Primary:** MSP 엔지니어 (Azure/AWS 인프라 운영, 벤더 서포트 커뮤니케이션 담당)
- **Secondary:** 기술 리드, 고객 대응 매니저

## 핵심 가치 제안

1. **시간 절약:** 메일 스레드 → RCA 초안 생성을 AI로 자동화 (2~4시간 → 15분)
2. **품질 일관성:** 표준화된 RCA 템플릿에 맞춘 일관된 출력
3. **언어 장벽 해소:** 영어 기술 메일을 한국어 보고서로 자동 변환
4. **원클릭 공유:** Word 내보내기 + Slack 알림으로 공유 프로세스 간소화

## 기술 스택 요약

| 계층 | 기술 | 이유 |
|------|------|------|
| AI/LLM | Azure OpenAI (GPT-4o) via Microsoft Foundry | 심사 기준 3번 충족, 한국어 품질 우수 |
| Backend | Azure Functions (Node.js/TypeScript) | 이벤트 기반 서버리스, 비용 효율 |
| Frontend | React + Vite, Azure App Service | 24시간 가용, SPA |
| Auth | Microsoft Entra ID (MSAL) | SSO, Graph API 권한 통합 |
| Mail | Microsoft Graph API | Outlook 메일 접근 |
| Export | docx (npm) | Word 문서 생성 |
| Notification | Slack Incoming Webhook | 채널 공유 |
| SDK | GitHub Copilot SDK | 에이전트 오케스트레이션, 도구 호출 |

## 버전 로드맵

| 버전 | 범위 | 완료 기준 |
|------|------|-----------|
| V0 (MVP) | 샘플 데이터 + AI RCA 생성 + 웹 UI 검토 | 데모 가능한 엔드투엔드 흐름 |
| V1 | Microsoft Graph API 연동 (실제 메일) | 실제 Outlook 메일로 RCA 생성 |
| V2 | Word Export + Slack 공유 | 보고서 내보내기 및 공유 완료 |
| V3 | Azure 배포 + 운영 구성 | Production 환경 운영 가능 |

## 성공 지표

- RCA 보고서 작성 시간 75% 단축
- AI 생성 초안의 사용자 수정률 30% 이하
- 월간 처리 티켓 수 2배 증가
