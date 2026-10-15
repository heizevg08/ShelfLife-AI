import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routing/router';
import { PwaUpdate } from './pwa';
import './styles/application.css';
import './styles/browser.css';

createRoot(document.getElementById('root')!).render(<><RouterProvider router={router} /><PwaUpdate /></>);
