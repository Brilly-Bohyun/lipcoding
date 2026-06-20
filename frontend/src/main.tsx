import React from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { BrowserRouter } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig, isMsalConfigured } from './services/authConfig.js';
import { App } from './App.js';

const msalInstance = isMsalConfigured() ? new PublicClientApplication(msalConfig) : null;

function Root(): JSX.Element {
  const app = (
    <FluentProvider theme={webLightTheme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FluentProvider>
  );

  if (msalInstance) {
    return <MsalProvider instance={msalInstance}>{app}</MsalProvider>;
  }

  return app;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
