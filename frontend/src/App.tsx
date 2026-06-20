import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { TicketListPage } from './pages/TicketListPage.js';
import { TicketDetailPage } from './pages/TicketDetailPage.js';
import { RCAViewPage } from './pages/RCAViewPage.js';

export function App(): JSX.Element {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/tickets" replace />} />
        <Route path="/tickets" element={<TicketListPage />} />
        <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
        <Route path="/rca/:ticketId" element={<RCAViewPage />} />
      </Routes>
    </Layout>
  );
}
