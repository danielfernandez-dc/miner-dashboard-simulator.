/** Mounts only the Atlas side panel. App coordinates transient analysis and the
 * rules cache; no miner dashboard is embedded in the extension. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
