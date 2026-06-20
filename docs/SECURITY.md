# Security Configuration

## Managed Identity

Azure Functions uses **System-Assigned Managed Identity** to access Key Vault.
No credentials are stored in code or environment variables.

### Key Vault References (App Settings)

| App Setting | Key Vault Secret |
|-------------|-----------------|
| `AZURE_OPENAI_ENDPOINT` | `azure-openai-endpoint` |
| `AZURE_OPENAI_API_KEY` | `azure-openai-key` |
| `SLACK_WEBHOOK_URL` | `slack-webhook-url` |

### Access Pattern
```
Azure Functions → Managed Identity → Key Vault → Secret Value
```

## CORS Policy

- **Production**: Only `https://app-rca-copilot-prod.azurewebsites.net`
- **Development**: Also allows `http://localhost:5173`

## Authentication Flow

```
Browser → MSAL (Entra ID) → Access Token → Backend API → Graph API
```

- Frontend acquires token via popup/redirect
- Backend validates Bearer token for Graph API calls
- No token stored server-side

## Secrets Management Checklist

- [ ] No secrets in source code
- [ ] All secrets in Key Vault
- [ ] Managed Identity for Key Vault access
- [ ] .env files in .gitignore
- [ ] CORS restricted to frontend domain
- [ ] HTTPS only (enforced in Bicep)
- [ ] Gitleaks in CI pipeline
