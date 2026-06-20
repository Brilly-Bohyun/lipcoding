import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Title2,
  Title3,
  Text,
  Spinner,
  Button,
  Card,
  Textarea,
  makeStyles,
  tokens,
  Badge,
} from '@fluentui/react-components';
import { Edit24Regular, Checkmark24Regular } from '@fluentui/react-icons';
import { streamRCAGeneration, RCADocument } from '../services/api.js';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  streamingBox: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '8px',
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontSize: '13px',
    maxHeight: '300px',
    overflow: 'auto',
  },
  sectionCard: {
    padding: '16px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  timelineTable: {
    width: '100%',
    borderCollapse: 'collapse',
    '& th, & td': {
      padding: '8px 12px',
      borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
      textAlign: 'left',
    },
  },
});

interface EditableSection {
  key: keyof Omit<RCADocument, 'timeline' | 'openQuestions'>;
  label: string;
}

const SECTIONS: EditableSection[] = [
  { key: 'summary', label: '📋 장애 요약' },
  { key: 'rootCause', label: '🔍 근본 원인' },
  { key: 'resolution', label: '✅ 조치 내역' },
  { key: 'preventiveAction', label: '🛡️ 재발 방지 대책' },
];

export function RCAViewPage(): JSX.Element {
  const styles = useStyles();
  const { ticketId } = useParams<{ ticketId: string }>();
  const [rca, setRca] = useState<RCADocument | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!ticketId) return;
    setIsGenerating(true);
    setStreamingText('');
    setRca(null);
    setError(null);

    try {
      for await (const event of streamRCAGeneration(ticketId)) {
        if (event.type === 'chunk' && event.content) {
          setStreamingText((prev) => prev + event.content);
        } else if (event.type === 'done' && event.rca) {
          setRca(event.rca);
        } else if (event.type === 'error') {
          setError(event.error || 'RCA 생성 중 오류가 발생했습니다.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RCA 생성 실패');
    } finally {
      setIsGenerating(false);
    }
  }, [ticketId]);

  const startEdit = (key: string, value: string): void => {
    setEditingSection(key);
    setEditValue(value);
  };

  const saveEdit = (key: string): void => {
    if (rca) {
      setRca({ ...rca, [key]: editValue });
    }
    setEditingSection(null);
  };

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title2>RCA 보고서</Title2>
        {!rca && !isGenerating && (
          <Button appearance="primary" onClick={handleGenerate}>
            🚀 RCA 생성 시작
          </Button>
        )}
      </div>

      <Badge appearance="outline">Ticket: {ticketId}</Badge>
      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
        ⚠️ AI가 생성한 초안입니다. 반드시 검토 후 사용하세요.
      </Text>

      {isGenerating && (
        <div>
          <Spinner label="RCA를 생성하고 있습니다..." size="small" />
          <div className={styles.streamingBox}>{streamingText || '...'}</div>
        </div>
      )}

      {error && <Text style={{ color: 'red' }}>오류: {error}</Text>}

      {rca && (
        <>
          {SECTIONS.map(({ key, label }) => (
            <Card key={key} className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <Title3>{label}</Title3>
                {editingSection === key ? (
                  <Button
                    icon={<Checkmark24Regular />}
                    onClick={() => saveEdit(key)}
                    size="small"
                  >
                    저장
                  </Button>
                ) : (
                  <Button
                    icon={<Edit24Regular />}
                    onClick={() => startEdit(key, rca[key])}
                    size="small"
                    appearance="subtle"
                  >
                    수정
                  </Button>
                )}
              </div>
              {editingSection === key ? (
                <Textarea
                  value={editValue}
                  onChange={(_e, data) => setEditValue(data.value)}
                  resize="vertical"
                  style={{ width: '100%', minHeight: '100px' }}
                />
              ) : (
                <Text style={{ whiteSpace: 'pre-wrap' }}>{rca[key]}</Text>
              )}
            </Card>
          ))}

          {/* Timeline */}
          <Card className={styles.sectionCard}>
            <Title3>📅 타임라인</Title3>
            <table className={styles.timelineTable}>
              <thead>
                <tr>
                  <th>일시</th>
                  <th>이벤트</th>
                  <th>출처</th>
                </tr>
              </thead>
              <tbody>
                {rca.timeline.map((entry, i) => (
                  <tr key={i}>
                    <td><Text size={200}>{entry.datetime}</Text></td>
                    <td>{entry.event}</td>
                    <td><Badge appearance="outline" size="small">{entry.source}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Open Questions */}
          <Card className={styles.sectionCard}>
            <Title3>❓ 미해결 사항</Title3>
            <ul>
              {rca.openQuestions.map((q, i) => (
                <li key={i}><Text>{q}</Text></li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
