import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title2,
  Text,
  Spinner,
  Card,
  CardHeader,
  Badge,
  Input,
  makeStyles,
  tokens,
  Button,
  Subtitle1,
} from '@fluentui/react-components';
import {
  Search24Regular,
  ArrowClockwise24Regular,
  MailInbox24Regular,
} from '@fluentui/react-icons';
import { fetchTickets, TicketSummary } from '../services/api.js';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  searchBar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '16px',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      boxShadow: tokens.shadow8,
      transform: 'translateY(-1px)',
    },
    '&:focus-visible': {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: '2px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': {
        transform: 'none',
      },
    },
  },
  cardMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    textAlign: 'center' as const,
    gap: '16px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '32px',
    textAlign: 'center' as const,
  },
  ticketCount: {
    color: tokens.colorNeutralForeground3,
  },
});

export function TicketListPage(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTickets = (): void => {
    setLoading(true);
    setError(null);
    fetchTickets()
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const filteredTickets = tickets.filter(
    (t) =>
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
        <Spinner label="티켓 목록을 불러오는 중..." size="medium" />
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
          네트워크 연결을 확인하거나, 백엔드 서버가 실행 중인지 확인하세요.
        </Text>
        <Button
          icon={<ArrowClockwise24Regular />}
          appearance="primary"
          onClick={loadTickets}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <div>
          <Title2>Support Tickets</Title2>
          <Text className={styles.ticketCount} size={200}>
            총 {tickets.length}건
          </Text>
        </div>
        <Button
          icon={<ArrowClockwise24Regular />}
          appearance="subtle"
          onClick={loadTickets}
          aria-label="새로고침"
        />
      </div>

      <div className={styles.searchBar}>
        <Input
          contentBefore={<Search24Regular />}
          placeholder="제목 또는 벤더로 검색..."
          value={searchQuery}
          onChange={(_e, data) => setSearchQuery(data.value)}
          style={{ flex: 1, maxWidth: '400px' }}
          aria-label="티켓 검색"
        />
        {searchQuery && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {filteredTickets.length}건 검색됨
          </Text>
        )}
      </div>

      {filteredTickets.length === 0 ? (
        <div className={styles.emptyState}>
          <MailInbox24Regular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
          <Subtitle1>
            {searchQuery ? '검색 결과가 없습니다' : '등록된 티켓이 없습니다'}
          </Subtitle1>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {searchQuery
              ? '다른 검색어로 시도해 보세요.'
              : 'Outlook에서 Support 메일을 연동하면 여기에 표시됩니다.'}
          </Text>
        </div>
      ) : (
        <div className={styles.container}>
          {filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className={styles.card}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/tickets/${ticket.id}`); } }}
              role="button"
              tabIndex={0}
              aria-label={`티켓: ${ticket.subject}, 벤더: ${ticket.vendor}, 상태: ${ticket.status === 'resolved' ? '해결됨' : '진행중'}`}
            >
              <CardHeader
                header={<Text weight="semibold" size={400}>{ticket.subject}</Text>}
                description={
                  <div className={styles.cardMeta}>
                    <Badge appearance="outline" color="informative">
                      {ticket.vendor}
                    </Badge>
                    <Badge
                      appearance="filled"
                      color={ticket.status === 'resolved' ? 'success' : 'warning'}
                    >
                      {ticket.status === 'resolved' ? '해결됨' : '진행중'}
                    </Badge>
                    <Text size={200}>📧 {ticket.messageCount}통</Text>
                    <Text size={200}>
                      📅 {new Date(ticket.createdAt).toLocaleDateString('ko-KR')}
                    </Text>
                  </div>
                }
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
