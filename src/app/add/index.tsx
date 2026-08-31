import { router } from 'expo-router';

import { BrandPickerScreen } from '@/features/subscription-form/BrandPickerScreen';

export default function AddBrandStep() {
  return (
    <BrandPickerScreen
      onPick={(brand) => router.push({ pathname: '/add/details', params: { brandId: brand.id } })}
      onCustom={(name) => router.push({ pathname: '/add/details', params: { name } })}
      onCancel={() => router.back()}
    />
  );
}
