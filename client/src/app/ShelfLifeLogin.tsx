import { Redirect } from 'expo-router';

// Preserve existing bookmarks while all application links use the canonical route.
export default function LegacyLoginRedirect() {
  return <Redirect href="/ShelfLifeAILogin" />;
}
