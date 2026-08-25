import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import {PublicEntryRouter} from './PublicEntryRouter';
import {redactAnalyticsUrl} from './analytics';
import {recordApproximateVisitorLocation} from './visitorLocation';
import './index.css';

void recordApproximateVisitorLocation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicEntryRouter />
    <Analytics beforeSend={redactAnalyticsUrl} />
  </StrictMode>,
);
