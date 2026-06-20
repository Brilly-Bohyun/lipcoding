import { useAzureMonitor, shutdownAzureMonitor, TelemetryClient } from 'applicationinsights';

let client: TelemetryClient | null = null;

/**
 * Initialize Application Insights for backend telemetry.
 * Call once at application startup.
 */
export function initTelemetry(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    console.log('[Telemetry] No connection string found, skipping initialization');
    return;
  }

  useAzureMonitor({
    azureMonitorExporterOptions: { connectionString },
  });

  client = new TelemetryClient();
  console.log('[Telemetry] Application Insights initialized');
}

/**
 * Graceful shutdown.
 */
export async function stopTelemetry(): Promise<void> {
  await shutdownAzureMonitor();
}

/**
 * Track custom event (e.g., RCA generation).
 */
export function trackEvent(name: string, properties?: Record<string, string>, measurements?: Record<string, number>): void {
  if (!client) return;
  client.trackEvent({ name, properties, measurements });
}

/**
 * Track RCA generation metrics.
 */
export function trackRCAGeneration(ticketId: string, durationMs: number, success: boolean, tokenCount?: number): void {
  trackEvent('RCAGeneration', {
    ticketId,
    success: String(success),
  }, {
    durationMs,
    ...(tokenCount !== undefined ? { tokenCount } : {}),
  });
}

/**
 * Track export/share actions.
 */
export function trackExport(type: 'word' | 'slack', success: boolean): void {
  trackEvent('RCAExport', { type, success: String(success) });
}
