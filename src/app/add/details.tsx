import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { getBrand } from '@/data/brands';
import { useAppStore } from '@/data/store';
import { todayIso } from '@/domain/date';
import {
  Draft,
  draftFromBrand,
  emptyDraft,
  toNewSubscription,
} from '@/features/subscription-form/draft';
import { SubscriptionFormScreen } from '@/features/subscription-form/SubscriptionFormScreen';

export default function AddDetailsStep() {
  const params = useLocalSearchParams<{ brandId?: string; name?: string }>();
  const homeCurrency = useAppStore((state) => state.settings.homeCurrency);
  const addSubscription = useAppStore((state) => state.addSubscription);

  const [draft, setDraft] = useState<Draft>(() => {
    const today = todayIso();
    const brand = getBrand(params.brandId);
    if (brand) {
      return draftFromBrand(brand, homeCurrency, today);
    }
    return { ...emptyDraft(homeCurrency, today), name: params.name ?? '' };
  });

  return (
    <SubscriptionFormScreen
      mode="add"
      draft={draft}
      setDraft={setDraft}
      onCancel={() => router.back()}
      onSave={() => {
        addSubscription(toNewSubscription(draft));
        // Dismiss the whole modal stack, not just this step.
        router.dismissAll();
      }}
    />
  );
}
