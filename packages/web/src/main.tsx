import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      future flags opt in to React Router v7 behaviour early.
      v7_startTransition  — wraps state updates in React.startTransition
      v7_relativeSplatPath — fixes relative route resolution inside splat routes
      Both are safe no-ops for this app's routing structure.
    */}
    <BrowserRouter>
    <App />
    </BrowserRouter>
  </React.StrictMode>
);
