import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title2,
  Text,
  Spinner,
  Card,
  CardHeader,
  Badge,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { fetchTickets, TicketSummary } from '../services/api.js';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  cardMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '8px',
  },
});

export function TicketListPage(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets()
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="티켓 목록을 불러오는 중..." />;
  if (error) return <Text style={{ color: 'red' }}>오류: {error}</Text>;

  return (
    <div className={styles.container}>
      <Title2>Support Tickets</Title2>
      {tickets.map((ticket) => (
        <Card
          key={ticket.id}
          className={styles.card}
          onClick={() => navigate(`/tickets/${ticket.id}`)}
        >
          <CardHeader
            header={<Text weight="semibold">{ticket.subject}</Text>}
            description={
              <div className={styles.cardMeta}>
                <Badge appearance="outline" color="informative">
                  {ticket.vendor}
                </Badge>
                <Badge
                  appearance="filled"
                  color={ticket.status === 'resolved' ? 'success' : 'warning'}
                >
                  {ticket.status}
                </Badge>
                <Text size={200}>메일 {ticket.messageCount}통</Text>
                <Text size={200}>
                  {new Date(ticket.createdAt).toLocaleDateString('ko-KR')}
                </Text>
              </div>
            }
          />
        </Card>
      ))}
    </div>
  );
}
