import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

// Without this, a notification that fires while the app is foregrounded is
// delivered silently.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0D12' } }}>
        <Stack.Screen name="index" />
        {/* Adding and editing are modals: they are a self-contained task, and
            the sheet gesture gives a natural "abandon this" affordance. */}
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
