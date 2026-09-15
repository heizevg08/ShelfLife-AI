import { Redirect } from 'expo-router';
// Retain bookmarked URLs without rendering the inherited prototype screen.
export default function LegacyRoute() { return <Redirect href="/Reports" />; }
