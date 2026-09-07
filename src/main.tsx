import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { BrandProvider } from './context/BrandContext';
import { ApiKeyProvider } from './context/ApiKeyContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiKeyProvider>
      <BrandProvider>
        <App />
      </BrandProvider>
    </ApiKeyProvider>
  </StrictMode>,
);

