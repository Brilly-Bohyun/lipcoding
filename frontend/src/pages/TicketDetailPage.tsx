import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title2,
  Text,
  Spinner,
  Button,
  Card,
  Badge,
  makeStyles,
  tokens,
  Subtitle1,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
} from '@fluentui/react-components';
import {
  Play24Regular,
  ArrowLeft24Regular,
  ArrowClockwise24Regular,
  Mail24Regular,
} from '@fluentui/react-icons';
import { fetchTicketDetail, TicketDetail } from '../services/api.js';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    gap: '16px',
    flexWrap: 'wrap',
    '@media (max-width: 768px)': {
      flexDirection: 'column',
    },
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  metaRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  messageCard: {
    borderLeft: `4px solid ${tokens.colorBrandBackground}`,
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow4,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  vendorCard: {
    borderLeft: `4px solid ${tokens.colorPaletteGreenBackground3}`,
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow4,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  messageBody: {
    whiteSpace: 'pre-wrap',
    fontSize: '13px',
    lineHeight: '1.6',
    padding: '12px 16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '4px',
    maxHeight: '300px',
    overflow: 'auto',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '48px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '32px',
    textAlign: 'center' as const,
  },
});

export function TicketDetailPage(): JSX.Element {
  const styles = useStyles();
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTicket = (): void => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    fetchTicketDetail(ticketId)
      .then(setTicket)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
        <Spinner label="티켓 정보를 불러오는 중..." size="medium" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <Text size={400} style={{ color: tokens.colorPaletteRedForeground1 }}>
          ⚠️ 티켓을 불러오지 못했습니다
        </Text>
        <Text size={200}>{error}</Text>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          네트워크 연결을 확인하거나, 잠시 후 다시 시도해 주세요.
        </Text>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button icon={<ArrowLeft24Regular />} onClick={() => navigate('/tickets')}>
            목록으로
          </Button>
          <Button icon={<ArrowClockwise24Regular />} appearance="primary" onClick={loadTicket}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={styles.emptyState}>
        <Mail24Regular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
        <Subtitle1>티켓을 찾을 수 없습니다</Subtitle1>
        <Button icon={<ArrowLeft24Regular />} onClick={() => navigate('/tickets')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title2>{ticket.subject}</Title2>
          <div className={styles.metaRow}>
            <Badge appearance="outline" color="informative">{ticket.vendor || 'Unknown'}</Badge>
            <Badge appearance="filled" color={ticket.status === 'resolved' ? 'success' : 'warning'}>
              {ticket.status === 'resolved' ? '해결됨' : '진행중'}
            </Badge>
            <Text size={200}>📧 {ticket.messages.length}통의 메일</Text>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button
            icon={<ArrowLeft24Regular />}
            appearance="subtle"
            onClick={() => navigate('/tickets')}
          >
            목록
          </Button>
          <Button
            appearance="primary"
            icon={<Play24Regular />}
            onClick={() => navigate(`/rca/${ticketId}`)}
          >
            🚀 RCA 생성
          </Button>
        </div>
      </div>

      <Subtitle1 style={{ marginBottom: '12px' }}>
        💬 메일 스레드
      </Subtitle1>

      <Accordion multiple defaultOpenItems={[0, 1, 2]}>
        {ticket.messages.map((msg) => (
          <AccordionItem key={msg.index} value={msg.index}>
            <AccordionHeader>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                <Badge
                  appearance="filled"
                  color={msg.isVendor ? 'success' : 'brand'}
                  size="small"
                >
                  {msg.isVendor ? '벤더' : 'MSP'}
                </Badge>
                <Text weight="semibold" size={300}>
                  #{msg.index} {msg.from}
                </Text>
                <Text size={200} style={{ marginLeft: 'auto', color: tokens.colorNeutralForeground3 }}>
                  {new Date(msg.date).toLocaleString('ko-KR')}
                </Text>
              </div>
            </AccordionHeader>
            <AccordionPanel>
              <Card className={msg.isVendor ? styles.vendorCard : styles.messageCard}>
                <div className={styles.messageBody}>{msg.bodyText}</div>
              </Card>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
