import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbDivider,
  BreadcrumbButton,
  Tooltip,
  Badge,
} from '@fluentui/react-components';
import {
  DocumentBulletList24Regular,
  Home24Regular,
  Info24Regular,
} from '@fluentui/react-icons';
import { AuthButton } from './AuthButton.js';
import { isMsalConfigured } from '../services/authConfig.js';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 24px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: tokens.shadow4,
    '@media (max-width: 768px)': {
      padding: '10px 16px',
      gap: '8px',
    },
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    '@media (max-width: 768px)': {
      '& span': {
        fontSize: '14px',
      },
    },
  },
  headerRight: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  breadcrumbBar: {
    padding: '8px 24px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    '@media (max-width: 768px)': {
      padding: '6px 16px',
      overflowX: 'auto',
    },
  },
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
    '@media (max-width: 768px)': {
      padding: '16px',
    },
  },
  footer: {
    padding: '8px 24px',
    textAlign: 'center' as const,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    '@media (max-width: 768px)': {
      padding: '8px 16px',
    },
  },
});

interface LayoutProps {
  children: ReactNode;
}

function getBreadcrumbs(pathname: string): { label: string; path?: string }[] {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; path?: string }[] = [
    { label: '홈', path: '/tickets' },
  ];

  if (parts[0] === 'tickets' && parts.length === 1) {
    crumbs.push({ label: '티켓 목록' });
  } else if (parts[0] === 'tickets' && parts[1]) {
    crumbs.push({ label: '티켓 목록', path: '/tickets' });
    crumbs.push({ label: `티켓 상세 (${parts[1]})` });
  } else if (parts[0] === 'rca' && parts[1]) {
    crumbs.push({ label: '티켓 목록', path: '/tickets' });
    crumbs.push({ label: '티켓 상세', path: `/tickets/${parts[1]}` });
    crumbs.push({ label: 'RCA 보고서' });
  }

  return crumbs;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  return (
    <div className={styles.root}>
      <header className={styles.header} role="banner">
        <div className={styles.headerTitle}>
          <DocumentBulletList24Regular />
          <Text weight="semibold" size={500} style={{ color: 'inherit' }}>
            Vendor Support RCA Copilot
          </Text>
          <Badge appearance="filled" color="subtle" size="small">
            Beta
          </Badge>
        </div>
        <div className={styles.headerRight}>
          <Tooltip content="AI 기반 RCA 보고서 자동 생성 도구" relationship="description">
            <Info24Regular style={{ cursor: 'pointer', opacity: 0.8 }} />
          </Tooltip>
          {isMsalConfigured() && <AuthButton />}
        </div>
      </header>

      <nav className={styles.breadcrumbBar} aria-label="현재 위치">
        <Breadcrumb size="small">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <BreadcrumbDivider />}
              <BreadcrumbItem>
                {crumb.path ? (
                  <BreadcrumbButton
                    icon={i === 0 ? <Home24Regular /> : undefined}
                    onClick={() => navigate(crumb.path!)}
                  >
                    {crumb.label}
                  </BreadcrumbButton>
                ) : (
                  <BreadcrumbButton current icon={i === 0 ? <Home24Regular /> : undefined}>
                    {crumb.label}
                  </BreadcrumbButton>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </Breadcrumb>
      </nav>

      <main className={styles.content} role="main">
        {children}
      </main>

      <footer className={styles.footer} role="contentinfo">
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
          ⚠️ AI 생성 콘텐츠는 참고 용도이며, 반드시 전문가 검토 후 사용하세요.
        </Text>
      </footer>
    </div>
  );
}
