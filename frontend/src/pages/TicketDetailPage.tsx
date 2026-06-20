import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title2,
  Text,
  Spinner,
  Button,
  Card,
  CardHeader,
  Badge,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Play24Regular } from '@fluentui/react-icons';
import { fetchTicketDetail, TicketDetail } from '../services/api.js';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageCard: {
    borderLeft: `3px solid ${tokens.colorBrandBackground}`,
  },
  vendorCard: {
    borderLeft: `3px solid ${tokens.colorPaletteGreenBackground3}`,
  },
  messageBody: {
    whiteSpace: 'pre-wrap',
    fontSize: '13px',
    lineHeight: '1.5',
    marginTop: '8px',
  },
});

export function TicketDetailPage(): JSX.Element {
  const styles = useStyles();
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    fetchTicketDetail(ticketId)
      .then(setTicket)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticketId]);

  if (loading) return <Spinner label="티켓 정보를 불러오는 중..." />;
  if (error) return <Text style={{ color: 'red' }}>오류: {error}</Text>;
  if (!ticket) return <Text>티켓을 찾을 수 없습니다.</Text>;

  return (
    <div>
      <div className={styles.header}>
        <Title2>{ticket.subject}</Title2>
        <Button
          appearance="primary"
          icon={<Play24Regular />}
          onClick={() => navigate(`/rca/${ticketId}`)}
        >
          RCA 생성
        </Button>
      </div>

      <div className={styles.timeline}>
        {ticket.messages.map((msg) => (
          <Card
            key={msg.index}
            className={msg.isVendor ? styles.vendorCard : styles.messageCard}
          >
            <CardHeader
              header={
                <Text weight="semibold">
                  #{msg.index} {msg.from}
                </Text>
              }
              description={
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Badge appearance="outline" color={msg.isVendor ? 'success' : 'informative'}>
                    {msg.isVendor ? '벤더' : 'MSP'}
                  </Badge>
                  <Text size={200}>
                    {new Date(msg.date).toLocaleString('ko-KR')}
                  </Text>
                </div>
              }
            />
            <div className={styles.messageBody}>{msg.bodyText}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
