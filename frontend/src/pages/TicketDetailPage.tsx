import { Title2, Text } from '@fluentui/react-components';
import { useParams } from 'react-router-dom';

export function TicketDetailPage(): JSX.Element {
  const { ticketId } = useParams<{ ticketId: string }>();

  return (
    <div>
      <Title2>Ticket: {ticketId}</Title2>
      <Text>메일 스레드가 여기에 표시됩니다.</Text>
    </div>
  );
}
