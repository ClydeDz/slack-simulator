// Copyright (C) 2026 CLYDE D'SOUZA
// This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useStore } from './store';
import './themes/slack-light.css';
import './themes/slack-dark.css';

const queryClient = new QueryClient();

function ThemeLoader() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const body = document.body;
    body.setAttribute('data-theme', theme === 'Slack Dark' ? 'dark' : 'light');
  }, [theme]);

  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeLoader />
    <App />
  </QueryClientProvider>
);
