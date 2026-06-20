@description('Environment name (dev or prod)')
param environment string = 'prod'

@description('Azure region')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string = 'rca-copilot'

@description('Azure OpenAI endpoint URL')
@secure()
param azureOpenAIEndpoint string

@description('Azure OpenAI API key')
@secure()
param azureOpenAIKey string

@description('Azure OpenAI deployment name')
param azureOpenAIDeployment string = 'gpt-4o'

@description('Slack Webhook URL')
@secure()
param slackWebhookUrl string = ''

@description('Entra ID Client ID')
param entraClientId string = ''

@description('Entra ID Tenant ID')
param entraTenantId string = ''

// ============================================================
// Variables
// ============================================================
var suffix = '${baseName}-${environment}'
var appInsightsName = 'appi-${suffix}'
var keyVaultName = 'kv-${replace(suffix, '-', '')}'
var storageName = 'st${replace(replace(suffix, '-', ''), '_', '')}'
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
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
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

// ============================================================
// Storage Account (for Azure Functions)
// ============================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
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
      appSettings: [
        { name: 'VITE_ENTRA_CLIENT_ID', value: entraClientId }
        { name: 'VITE_ENTRA_TENANT_ID', value: entraTenantId }
        { name: 'VITE_API_BASE_URL', value: 'https://${functionAppName}.azurewebsites.net/api' }
      ]
    }
  }
}

// ============================================================
// Key Vault Access Policy (Function App Managed Identity)
// ============================================================
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============================================================
// Outputs
// ============================================================
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output frontendAppUrl string = 'https://${frontendApp.properties.defaultHostName}'
output appInsightsKey string = appInsights.properties.InstrumentationKey
output keyVaultName string = keyVault.name
