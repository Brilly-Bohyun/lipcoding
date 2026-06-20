import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { PersonRegular, SignOut24Regular } from '@fluentui/react-icons';
import { loginRequest } from '../services/authConfig.js';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  userName: {
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: '13px',
  },
});

export function AuthButton(): JSX.Element {
  const styles = useStyles();
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const handleLogin = (): void => {
    instance.loginPopup(loginRequest).catch(console.error);
  };

  const handleLogout = (): void => {
    instance.logoutPopup().catch(console.error);
  };

  if (isAuthenticated && accounts[0]) {
    return (
      <div className={styles.container}>
        <PersonRegular />
        <Text className={styles.userName}>{accounts[0].name || accounts[0].username}</Text>
        <Button
          appearance="subtle"
          icon={<SignOut24Regular />}
          onClick={handleLogout}
          size="small"
          style={{ color: 'inherit' }}
        >
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <Button appearance="subtle" onClick={handleLogin} style={{ color: 'inherit' }}>
      Microsoft 로그인
    </Button>
  );
}
