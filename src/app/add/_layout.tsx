import { Stack } from 'expo-router';

export default function AddLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0D12' } }}
    />
  );
}
