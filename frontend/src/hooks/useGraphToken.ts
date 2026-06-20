import { useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest, isMsalConfigured } from '../services/authConfig.js';
import { setAccessToken } from '../services/api.js';

/**
 * Acquires access token silently and sets it in the API service.
 * Falls back to sample mode when MSAL is not configured.
 */
export function useGraphToken(): { isAuthenticated: boolean; isConfigured: boolean } {
  const isConfigured = isMsalConfigured();

  if (!isConfigured) {
    return { isAuthenticated: false, isConfigured: false };
  }

  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (!isAuthenticated || accounts.length === 0) {
      setAccessToken(null);
      return;
    }

    const acquireToken = async (): Promise<void> => {
      try {
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
        setAccessToken(response.accessToken);
      } catch {
        setAccessToken(null);
      }
    };

    acquireToken();
  }, [isAuthenticated, accounts, instance]);

  return { isAuthenticated, isConfigured };
}
