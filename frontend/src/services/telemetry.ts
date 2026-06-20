import { ApplicationInsights } from '@microsoft/applicationinsights-web';

let appInsights: ApplicationInsights | null = null;

export function initFrontendTelemetry(): void {
  const connectionString = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;
  if (!connectionString) return;

  appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
      disableFetchTracking: false,
    },
  });

  appInsights.loadAppInsights();
}

export function trackPageView(name: string): void {
  appInsights?.trackPageView({ name });
}

export function trackUserEvent(name: string, properties?: Record<string, string>): void {
  appInsights?.trackEvent({ name, properties });
}
