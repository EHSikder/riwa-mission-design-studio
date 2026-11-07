import { createRoot } from 'react-dom/client';
import { StudioApp } from './studio/ui/StudioApp';
import './base.css';

createRoot(document.getElementById('root')!).render(
  <div className="app">
    <StudioApp />
  </div>,
);
