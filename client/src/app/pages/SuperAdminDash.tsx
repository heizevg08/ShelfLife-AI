import { Redirect } from 'expo-router';

// Preserve existing bookmarks while keeping a single canonical dashboard URL.
export default function SuperAdminDash() {
  return <Redirect href="/SuperAdminDashboard" />;
}
