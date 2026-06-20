import { ReactNode } from 'react';
import {
  makeStyles,
  tokens,
  Title3,
  Divider,
} from '@fluentui/react-components';
import { DocumentBulletList24Regular } from '@fluentui/react-icons';
import { AuthButton } from './AuthButton.js';
import { isMsalConfigured } from '../services/authConfig.js';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 24px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  headerRight: {
    marginLeft: 'auto',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
  },
});

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <DocumentBulletList24Regular />
        <Title3 style={{ color: 'inherit' }}>Vendor Support RCA Copilot</Title3>
        {isMsalConfigured() && (
          <div className={styles.headerRight}>
            <AuthButton />
          </div>
        )}
      </header>
      <Divider />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
