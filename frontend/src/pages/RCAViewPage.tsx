import { Title2, Text } from '@fluentui/react-components';
import { useParams } from 'react-router-dom';

export function RCAViewPage(): JSX.Element {
  const { ticketId } = useParams<{ ticketId: string }>();

  return (
    <div>
      <Title2>RCA: {ticketId}</Title2>
      <Text>RCA 생성 결과가 여기에 표시됩니다.</Text>
    </div>
  );
}
