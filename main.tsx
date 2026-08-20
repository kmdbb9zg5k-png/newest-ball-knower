import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {PublicEntryRouter} from './PublicEntryRouter';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicEntryRouter />
  </StrictMode>,
);
