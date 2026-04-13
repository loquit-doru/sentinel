import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SolanaProvider } from './components/SolanaProvider';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaProvider>
      <App />
    </SolanaProvider>
  </StrictMode>,
);
