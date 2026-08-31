import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { useAppStore } from '@/data/store';
import {
  Draft,
  draftFromSubscription,
  emptyDraft,
  toNewSubscription,
} from '@/features/subscription-form/draft';
import { SubscriptionFormScreen } from '@/features/subscription-form/SubscriptionFormScreen';

export default function EditSubscription() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subscription = useAppStore((state) => state.subscriptions.find((s) => s.id === id));
  const homeCurrency = useAppStore((state) => state.settings.homeCurrency);
  const updateSubscription = useAppStore((state) => state.updateSubscription);

  const [draft, setDraft] = useState<Draft>(() =>
    subscription ? draftFromSubscription(subscription) : emptyDraft(homeCurrency),
  );

  if (!subscription) {
    router.back();
    return null;
  }

  return (
    <SubscriptionFormScreen
      mode="edit"
      draft={draft}
      setDraft={setDraft}
      onCancel={() => router.back()}
      onSave={() => {
        const next = toNewSubscription(draft);
        updateSubscription(subscription.id, {
          ...next,
          // updateSubscription records a price-history entry when this differs.
          price: next.price,
        });
        router.back();
      }}
    />
  );
}
