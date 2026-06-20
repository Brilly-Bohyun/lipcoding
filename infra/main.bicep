@description('Environment name (dev or prod)')
param environment string = 'prod'

@description('Azure region')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string = 'rca-copilot'

@description('Azure OpenAI endpoint URL')
@secure()
param azureOpenAIEndpoint string = ''

@description('Azure OpenAI API key')
@secure()
param azureOpenAIKey string = ''

@description('Azure OpenAI deployment name')
param azureOpenAIDeployment string = 'gpt-4o'

@description('Slack Webhook URL')
@secure()
param slackWebhookUrl string = ''

@description('Entra ID Client ID')
param entraClientId string = ''

@description('Entra ID Tenant ID')
param entraTenantId string = ''

@description('GitHub Models Token (alternative to Azure OpenAI)')
@secure()
param githubModelsToken string = ''

// ============================================================
// Variables
// ============================================================
var suffix = '${baseName}-${environment}'
var appInsightsName = 'appi-${suffix}'
var keyVaultName = 'kv-${replace(suffix, '-', '')}'
// Storage account name: 3-24 chars, lowercase alphanumeric only
var storageName = toLower('st${replace(replace(baseName, '-', ''), '_', '')}${environment}')
var functionAppName = 'func-${suffix}'
var appServicePlanName = 'asp-${suffix}'
var frontendAppName = 'app-${suffix}'
var logAnalyticsName = 'log-${suffix}'

// ============================================================
// Log Analytics Workspace
// ============================================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ============================================================
// Application Insights
// ============================================================
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ============================================================
// Key Vault
// ============================================================
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: false  // Use Access Policies instead of RBAC
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    accessPolicies: []  // Will be added after Function App is created
  }
}

resource secretOpenAIEndpoint 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-openai-endpoint'
  properties: { value: azureOpenAIEndpoint }
}

resource secretOpenAIKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'azure-openai-key'
  properties: { value: azureOpenAIKey }
}

resource secretSlackWebhook 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'slack-webhook-url'
  properties: { value: slackWebhookUrl }
}

resource secretGithubModelsToken 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'github-models-token'
  properties: { value: githubModelsToken }
}

// ============================================================
// Storage Account (for Azure Functions)
// ============================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// Blob 서비스 — RCA 스냅샷의 버전 관리(versioning) 활성화 + 7일 소프트 삭제
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// RCA 버전 스냅샷 컨테이너
resource rcaVersionsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'rca-versions'
  properties: {
    publicAccess: 'None'
  }
}

// Table 서비스 + 이메일/RCA 테이블
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource ticketsTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'Tickets'
}

resource rcaTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'RcaDocuments'
}

// ============================================================
// App Service Plan (Consumption for Functions + B1 for Frontend)
// ============================================================
resource functionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appServicePlanName}-func'
  location: location
  sku: { name: 'Y1', tier: 'Dynamic' }
  kind: 'functionapp'
  properties: { reserved: true }
}

resource frontendPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appServicePlanName}-web'
  location: location
  sku: { name: 'B1', tier: 'Basic' }
  kind: 'linux'
  properties: { reserved: true }
}

// ============================================================
// Azure Functions (Backend)
// ============================================================
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: functionPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=core.windows.net;AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: appInsights.properties.InstrumentationKey }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'AZURE_OPENAI_ENDPOINT', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-openai-endpoint)' }
        { name: 'AZURE_OPENAI_API_KEY', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=azure-openai-key)' }
        { name: 'AZURE_OPENAI_DEPLOYMENT', value: azureOpenAIDeployment }
        { name: 'SLACK_WEBHOOK_URL', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=slack-webhook-url)' }
        { name: 'GITHUB_MODELS_TOKEN', value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=github-models-token)' }
        { name: 'FRONTEND_URL', value: 'https://${frontendAppName}.azurewebsites.net' }
      ]
      cors: {
        allowedOrigins: [
          'https://${frontendAppName}.azurewebsites.net'
          'http://localhost:5173'
        ]
      }
    }
  }
}

// ============================================================
// Frontend Web App
// ============================================================
resource frontendApp 'Microsoft.Web/sites@2023-12-01' = {
  name: frontendAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: frontendPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      appCommandLine: 'pm2 serve /home/site/wwwroot --no-daemon --spa'
      appSettings: [
        { name: 'VITE_ENTRA_CLIENT_ID', value: entraClientId }
        { name: 'VITE_ENTRA_TENANT_ID', value: entraTenantId }
        { name: 'VITE_API_BASE_URL', value: 'https://${functionAppName}.azurewebsites.net/api' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '0' }
      ]
    }
  }
}

// ============================================================
// Key Vault Access Policy (Function App Managed Identity)
// ============================================================
resource kvAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: functionApp.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// ============================================================
// Outputs
// ============================================================
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output frontendAppUrl string = 'https://${frontendApp.properties.defaultHostName}'
output appInsightsKey string = appInsights.properties.InstrumentationKey
output keyVaultName string = keyVault.name
