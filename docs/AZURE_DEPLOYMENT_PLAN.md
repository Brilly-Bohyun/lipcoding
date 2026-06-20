# Azure Deployment Plan — Vendor Support RCA Copilot

## 배포 아키텍처 Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Azure Resource Group                        │
│                   rg-rca-copilot-{env}                       │
│                                                              │
│  ┌────────────────┐    ┌────────────────────────────────┐   │
│  │ App Service    │    │ Function App                    │   │
│  │ (Frontend)     │    │ (Backend API)                   │   │
│  │                │    │                                 │   │
│  │ Plan: B1       │    │ Plan: Consumption (V0~V2)      │   │
│  │ Always On: Yes │    │       Premium (V3)              │   │
│  │ React SPA      │    │ Node.js 20 LTS                 │   │
│  └───────┬────────┘    └────────┬───────────────────────┘   │
│          │                      │                            │
│          │              ┌───────▼───────────────────┐       │
│          │              │ Azure OpenAI Service       │       │
│          │              │ (Microsoft Foundry)        │       │
│          │              │ Model: GPT-4o              │       │
│          │              └───────────────────────────┘       │
│          │                                                   │
│  ┌───────▼────────────────────────────────────────────┐     │
│  │ Shared Services                                     │     │
│  │ - Key Vault (secrets)                               │     │
│  │ - Storage Account (Function App + RCA data)         │     │
│  │ - Application Insights (monitoring)                 │     │
│  │ - Log Analytics Workspace                           │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 리소스 명명 규칙

| 리소스 | 명명 패턴 | 예시 (prod) |
|--------|-----------|-------------|
| Resource Group | `rg-rca-copilot-{env}` | `rg-rca-copilot-prod` |
| App Service Plan | `asp-rca-copilot-{env}` | `asp-rca-copilot-prod` |
| App Service | `app-rca-copilot-{env}` | `app-rca-copilot-prod` |
| Function App | `func-rca-copilot-{env}` | `func-rca-copilot-prod` |
| Storage Account | `strca{env}` | `strcaprod` |
| Key Vault | `kv-rca-copilot-{env}` | `kv-rca-copilot-prod` |
| App Insights | `appi-rca-copilot-{env}` | `appi-rca-copilot-prod` |
| Azure OpenAI | `aoai-rca-copilot-{env}` | `aoai-rca-copilot-prod` |

---

## 환경 구성

| 환경 | 용도 | 배포 방법 | 비용 예상 |
|------|------|-----------|-----------|
| dev | 개발/테스트 | 수동 또는 PR trigger | ~$30/월 |
| prod | 운영 | main 브랜치 push | ~$60/월 |

### 환경별 주요 차이

| 항목 | dev | prod |
|------|-----|------|
| App Service Plan | F1 (Free) | B1 |
| Function App Plan | Consumption | Consumption (→ Premium 전환 가능) |
| Always On | No | Yes |
| Custom Domain | 없음 | 선택 |
| Azure OpenAI Deployment | gpt-4o (dev) | gpt-4o (prod) |
| Key Vault Soft Delete | 7일 | 90일 |

---

## Azure 리소스 프로비저닝

### Bicep 구조

```
infra/
├── main.bicep              # 진입점 (모듈 오케스트레이션)
├── modules/
│   ├── appService.bicep    # Frontend App Service
│   ├── functionApp.bicep   # Backend Function App
│   ├── storage.bicep       # Storage Account
│   ├── keyVault.bicep      # Key Vault
│   ├── monitoring.bicep    # App Insights + Log Analytics
│   └── openai.bicep        # Azure OpenAI (선택)
└── parameters/
    ├── dev.bicepparam
    └── prod.bicepparam
```

### 배포 명령어

```bash
# 리소스 그룹 생성
az group create --name rg-rca-copilot-dev --location koreacentral

# Bicep 배포
az deployment group create \
  --resource-group rg-rca-copilot-dev \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam
```

---

## Frontend 배포 (App Service)

### 배포 방식: GitHub Actions → Zip Deploy

```yaml
# .github/workflows/deploy-frontend.yml 핵심 단계
- name: Build
  run: cd frontend && npm ci && npm run build

- name: Deploy to Azure App Service
  uses: azure/webapps-deploy@v3
  with:
    app-name: app-rca-copilot-${{ env.ENVIRONMENT }}
    package: frontend/dist
```

### App Service 설정

| 설정 | 값 |
|------|-----|
| Runtime | Node 20 LTS |
| Startup Command | (정적 파일이므로 불필요) |
| Always On | Yes (prod) |
| HTTPS Only | Yes |
| Minimum TLS | 1.2 |
| SCM Auth | Disabled (GitHub Actions 사용) |

---

## Backend 배포 (Azure Functions)

### 배포 방식: GitHub Actions → Zip Deploy

```yaml
# .github/workflows/deploy-backend.yml 핵심 단계
- name: Build
  run: cd backend && npm ci && npm run build

- name: Deploy to Azure Functions
  uses: azure/functions-action@v1
  with:
    app-name: func-rca-copilot-${{ env.ENVIRONMENT }}
    package: backend
```

### Function App 설정

| 설정 | 값 |
|------|-----|
| Runtime | Node.js 20 |
| OS | Linux |
| Plan | Consumption (V0~V2) |
| CORS | `https://app-rca-copilot-{env}.azurewebsites.net` |
| App Settings | Key Vault Reference |

### 환경변수 (Key Vault Reference)

```
AZURE_OPENAI_ENDPOINT=@Microsoft.KeyVault(VaultName=kv-rca-copilot-prod;SecretName=azure-openai-endpoint)
AZURE_OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=kv-rca-copilot-prod;SecretName=azure-openai-key)
GRAPH_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=kv-rca-copilot-prod;SecretName=graph-client-secret)
SLACK_WEBHOOK_URL=@Microsoft.KeyVault(VaultName=kv-rca-copilot-prod;SecretName=slack-webhook-url)
```

---

## 보안 구성

### Managed Identity

| 리소스 | Identity | 대상 | 역할 |
|--------|----------|------|------|
| Function App | System-assigned | Key Vault | Key Vault Secrets User |
| Function App | System-assigned | Azure OpenAI | Cognitive Services OpenAI User |
| Function App | System-assigned | Storage Account | Storage Blob Data Contributor |
| App Service | System-assigned | (향후 필요 시) | - |

### 네트워크 보안

- App Service: 공개 (HTTPS only)
- Function App: 공개 (CORS 제한 + Bearer Token 인증)
- Key Vault: Azure Services 접근 허용, 공개 네트워크 제한
- Storage: Function App에서만 접근 (향후 Private Endpoint 고려)

---

## 모니터링 & 운영

### Application Insights

- Frontend: `@microsoft/applicationinsights-web` SDK
- Backend: Azure Functions 자동 통합
- 커스텀 이벤트:
  - `rca_generated` (티켓 ID, 생성 시간, 토큰 수)
  - `rca_exported` (형식: word/slack)
  - `rca_edited` (수정 섹션, 수정 비율)

### Alert Rules

| 조건 | 심각도 | 액션 |
|------|--------|------|
| Function App 오류율 > 5% (5분) | Sev 2 | 이메일 알림 |
| 응답 시간 > 30초 (평균, 5분) | Sev 3 | 이메일 알림 |
| Azure OpenAI 429 (Rate Limit) | Sev 2 | 이메일 알림 |

### 로그 보존

| 로그 종류 | 보존 기간 |
|-----------|-----------|
| Application Logs | 30일 |
| Platform Logs | 90일 |
| Audit Logs | 365일 |

---

## 비용 예산 (월간)

| 리소스 | dev 환경 | prod 환경 | 비고 |
|--------|----------|-----------|------|
| App Service (B1) | $0 (F1) | $13 | Linux |
| Function App (Consumption) | ~$0 | ~$1 | 예상 호출 < 100회/월 |
| Storage Account | ~$1 | ~$2 | Table + Blob |
| Azure OpenAI | ~$10 | ~$20 | GPT-4o, ~50 RCA/월 |
| Key Vault | ~$0 | ~$1 | 시크릿 10개 미만 |
| Application Insights | ~$0 | ~$5 | 기본 사용량 |
| **합계** | **~$11** | **~$42** | |

---

## 배포 체크리스트

### 최초 배포

- [ ] Azure 구독 확인 및 리소스 프로바이더 등록
- [ ] Bicep으로 인프라 프로비저닝
- [ ] Key Vault에 시크릿 등록
- [ ] Entra ID 앱 등록 (redirect URI 업데이트)
- [ ] GitHub Secrets 설정 (AZURE_CREDENTIALS 등)
- [ ] GitHub Actions 워크플로우 실행
- [ ] Health check 통과 확인
- [ ] CORS 동작 확인
- [ ] E2E 테스트 통과

### 롤백 전략

- App Service: 이전 배포 슬롯으로 swap
- Function App: 이전 zip 배포로 복원
- DB/Storage: 데이터 변경이 적으므로 수동 복구

---

## 리전 선택

| 리전 | 이유 |
|------|------|
| Korea Central | 사용자 위치(한국)에 가장 가까움, 대부분 서비스 가용 |
| East US | Azure OpenAI 모델 가용성 (GPT-4o), 대체 리전 |

> **참고:** Azure OpenAI GPT-4o가 Korea Central에서 사용 불가한 경우, East US의 Azure OpenAI 엔드포인트를 사용하고 나머지 리소스는 Korea Central에 배치합니다.
