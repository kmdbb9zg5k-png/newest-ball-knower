import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import {PublicEntryRouter} from './PublicEntryRouter';
import {redactAnalyticsUrl} from './analytics';
import {recordApproximateVisitorLocation} from './visitorLocation';
import {startModeProgressionBridge} from './modeProgressionBridge';
import './index.css';
import './fantasyMatchupMobileFix.css';

void recordApproximateVisitorLocation();
startModeProgressionBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicEntryRouter />
    <Analytics beforeSend={redactAnalyticsUrl} />
  </StrictMode>,
);
