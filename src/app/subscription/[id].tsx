import { useLocalSearchParams } from 'expo-router';

import { SubscriptionDetailScreen } from '@/features/subscriptions/SubscriptionDetailScreen';

export default function SubscriptionDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SubscriptionDetailScreen id={id} />;
}
