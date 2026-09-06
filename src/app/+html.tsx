import { ScrollViewStyleReset } from 'expo-router/html';
import Head from 'expo-router/head';
import type { PropsWithChildren } from 'react';

// Runs in the browser, not during Expo's static rendering.
const registerServiceWorker = `
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(function (error) {
        console.warn('ShelfLifeAI offline support is unavailable:', error);
      });
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <Head><title>ShelfLifeAI</title></Head>
        <meta name="application-name" content="ShelfLifeAI" />
        <meta name="theme-color" content="#12231A" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
