import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  ProgressBar,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Subtitle1,
  Tooltip,
} from '@fluentui/react-components';
import {
  Edit24Regular,
  Checkmark24Regular,
  DocumentArrowDown24Regular,
  Share24Regular,
  ArrowLeft24Regular,
  Dismiss24Regular,
  SparkleRegular,
} from '@fluentui/react-icons';
import { streamRCAGeneration, RCADocument, exportToWord, shareToSlack } from '../services/api.js';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  streamingBox: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '8px',
    whiteSpace: 'pre-wrap',
    fontFamily: '"Cascadia Code", "Fira Code", monospace',
    fontSize: '12px',
    lineHeight: '1.6',
    maxHeight: '250px',
    overflow: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: '8px',
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },
  sectionCard: {
    padding: '20px',
    transition: 'box-shadow 0.2s ease',
    '&:hover': {
      boxShadow: tokens.shadow4,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    '@media (max-width: 768px)': {
      padding: '16px',
    },
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  sectionContent: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.7',
    fontSize: '14px',
  },
  timelineTable: {
    width: '100%',
    borderCollapse: 'collapse',
    '& th': {
      padding: '10px 12px',
      borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
      textAlign: 'left',
      backgroundColor: tokens.colorNeutralBackground3,
      fontWeight: '600',
      fontSize: '13px',
    },
    '& td': {
      padding: '10px 12px',
      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
      fontSize: '13px',
      lineHeight: '1.5',
    },
    '& tr:hover td': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  exportBar: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    padding: '12px 0',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexWrap: 'wrap',
    '@media (max-width: 768px)': {
      justifyContent: 'stretch',
      '& button': {
        flex: 1,
      },
    },
  },
  aiDisclaimer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderRadius: '4px',
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '64px 24px',
    textAlign: 'center' as const,
  },
});

interface EditableSection {
  key: keyof Omit<RCADocument, 'timeline' | 'openQuestions'>;
  label: string;
  icon: string;
}

const SECTIONS: EditableSection[] = [
  { key: 'summary', label: '장애 요약', icon: '📋' },
  { key: 'rootCause', label: '근본 원인', icon: '🔍' },
  { key: 'resolution', label: '조치 내역', icon: '✅' },
  { key: 'preventiveAction', label: '재발 방지 대책', icon: '🛡️' },
];

type ToastType = 'success' | 'error' | null;
interface Toast {
  type: ToastType;
  title: string;
  message: string;
}

export function RCAViewPage(): JSX.Element {
  const styles = useStyles();
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [rca, setRca] = useState<RCADocument | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackSending, setSlackSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (type: ToastType, title: string, message: string): void => {
    setToast({ type, title, message });
    setTimeout(() => setToast(null), 5000);
  };

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
          showToast('success', 'RCA 생성 완료', '보고서가 성공적으로 생성되었습니다. 내용을 검토해 주세요.');
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
      showToast('success', '수정 완료', '섹션이 업데이트되었습니다.');
    }
    setEditingSection(null);
  };

  const cancelEdit = (): void => {
    setEditingSection(null);
    setEditValue('');
  };

  const handleExportWord = useCallback(async () => {
    if (!rca) return;
    setIsExporting(true);
    try {
      const blob = await exportToWord(rca, `Ticket: ${ticketId}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RCA_${ticketId}_${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Word 내보내기 완료', '파일이 다운로드되었습니다.');
    } catch (e) {
      showToast('error', 'Word 내보내기 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setIsExporting(false);
    }
  }, [rca, ticketId]);

  const handleShareSlack = useCallback(async () => {
    if (!rca) return;
    setSlackSending(true);
    try {
      await shareToSlack(rca, `Ticket: ${ticketId}`);
      showToast('success', 'Slack 전송 완료', 'RCA 요약이 Slack 채널에 공유되었습니다.');
      setSlackDialogOpen(false);
    } catch (e) {
      showToast('error', 'Slack 전송 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setSlackSending(false);
    }
  }, [rca, ticketId]);

  return (
    <div className={styles.container}>
      {/* Toast notification */}
      {toast && (
        <MessageBar
          intent={toast.type === 'success' ? 'success' : 'error'}
          style={{ position: 'sticky', top: 0, zIndex: 100 }}
        >
          <MessageBarBody>
            <MessageBarTitle>{toast.title}</MessageBarTitle>
            {toast.message}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Header */}
      <div className={styles.headerRow}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button
            icon={<ArrowLeft24Regular />}
            appearance="subtle"
            onClick={() => navigate(`/tickets/${ticketId}`)}
            aria-label="티켓 상세로 돌아가기"
          />
          <Title2>RCA 보고서</Title2>
        </div>
        <Badge appearance="outline" size="medium">Ticket: {ticketId}</Badge>
      </div>

      {/* AI Disclaimer */}
      <div className={styles.aiDisclaimer} role="alert">
        <SparkleRegular />
        <Text size={200}>
          AI가 생성한 초안입니다. <strong>반드시 검토 후 사용하세요.</strong> 메일에 명시된 사실만 기반으로 작성됩니다.
        </Text>
      </div>

      {/* Empty state - before generation */}
      {!rca && !isGenerating && !error && (
        <div className={styles.emptyState}>
          <SparkleRegular style={{ fontSize: '48px', color: tokens.colorBrandForeground1 }} />
          <Subtitle1>RCA 보고서를 생성하시겠습니까?</Subtitle1>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, maxWidth: '400px' }}>
            메일 스레드를 분석하여 한국어 RCA 보고서(요약, 타임라인, 근본 원인, 조치 내역, 재발 방지 대책)를 자동 생성합니다.
          </Text>
          <Button appearance="primary" size="large" onClick={handleGenerate}>
            🚀 RCA 생성 시작
          </Button>
        </div>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className={styles.progressSection}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size="tiny" />
            <Text weight="semibold">AI가 RCA를 생성하고 있습니다...</Text>
          </div>
          <ProgressBar />
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            메일 분석 → 타임라인 구성 → 원인 식별 → 보고서 작성
          </Text>
          <div className={styles.streamingBox} aria-live="polite" aria-label="AI 생성 진행 상황">
            {streamingText || '분석 준비 중...'}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>RCA 생성 실패</MessageBarTitle>
            {error}
          </MessageBarBody>
        </MessageBar>
      )}
      {error && (
        <Button appearance="primary" onClick={handleGenerate}>
          🔄 다시 시도
        </Button>
      )}

      {/* RCA Result */}
      {rca && (
        <>
          {/* Export & Share bar */}
          <div className={styles.exportBar}>
            <Tooltip content="RCA 보고서를 Word 문서로 다운로드합니다" relationship="description">
              <Button
                icon={<DocumentArrowDown24Regular />}
                appearance="primary"
                onClick={handleExportWord}
                disabled={isExporting}
                aria-label="Word 문서로 내보내기"
              >
                {isExporting ? 'Export 중...' : 'Word 내보내기'}
              </Button>
            </Tooltip>
            <Tooltip content="RCA 요약을 Slack 채널에 공유합니다" relationship="description">
              <Button
                icon={<Share24Regular />}
                appearance="secondary"
                onClick={() => setSlackDialogOpen(true)}
                aria-label="Slack으로 공유"
              >
                Slack 공유
              </Button>
            </Tooltip>
          </div>

          {/* Editable sections */}
          {SECTIONS.map(({ key, label, icon }) => (
            <Card key={key} className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <Title3>{icon} {label}</Title3>
                {editingSection === key ? (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <Button
                      icon={<Checkmark24Regular />}
                      onClick={() => saveEdit(key)}
                      size="small"
                      appearance="primary"
                    >
                      저장
                    </Button>
                    <Button
                      icon={<Dismiss24Regular />}
                      onClick={cancelEdit}
                      size="small"
                      appearance="subtle"
                    >
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    icon={<Edit24Regular />}
                    onClick={() => startEdit(key, rca[key])}
                    size="small"
                    appearance="subtle"
                    aria-label={`${label} 수정`}
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
                  style={{ width: '100%', minHeight: '120px' }}
                  aria-label={`${label} 편집`}
                />
              ) : (
                <Text className={styles.sectionContent}>{rca[key]}</Text>
              )}
            </Card>
          ))}

          {/* Timeline */}
          <Card className={styles.sectionCard}>
            <Title3 style={{ marginBottom: '12px' }}>📅 타임라인</Title3>
            {rca.timeline.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.timelineTable} aria-label="장애 타임라인">
                  <thead>
                    <tr>
                      <th scope="col">일시</th>
                      <th scope="col">이벤트</th>
                      <th scope="col">출처</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rca.timeline.map((entry, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <Text size={200}>{entry.datetime}</Text>
                        </td>
                        <td>{entry.event}</td>
                        <td>
                          <Badge appearance="outline" size="small">{entry.source}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                타임라인 정보가 없습니다.
              </Text>
            )}
          </Card>

          {/* Open Questions */}
          <Card className={styles.sectionCard}>
            <Title3 style={{ marginBottom: '12px' }}>❓ 미해결 사항</Title3>
            {rca.openQuestions.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {rca.openQuestions.map((q, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>
                    <Text>{q}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                ✅ 모든 사항이 해결되었습니다.
              </Text>
            )}
          </Card>
        </>
      )}

      {/* Slack confirmation dialog */}
      <Dialog open={slackDialogOpen} onOpenChange={(_e, data) => setSlackDialogOpen(data.open)}>
        <DialogSurface>
          <DialogTitle>Slack 공유 확인</DialogTitle>
          <DialogBody>
            <DialogContent>
              <Text>RCA 요약을 Slack 채널에 공유하시겠습니까?</Text>
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: tokens.colorNeutralBackground3, borderRadius: '4px' }}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  공유 내용: 장애 요약 + 근본 원인 + 조치 내역
                </Text>
              </div>
            </DialogContent>
          </DialogBody>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => setSlackDialogOpen(false)}
              disabled={slackSending}
            >
              취소
            </Button>
            <Button
              appearance="primary"
              onClick={handleShareSlack}
              disabled={slackSending}
              icon={slackSending ? undefined : <Share24Regular />}
            >
              {slackSending ? '전송 중...' : '전송'}
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
