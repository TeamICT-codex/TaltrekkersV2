
// DEBUG LOGGING START
console.log('🚀 App starting...');
console.log('📦 Node Environment:', process.env.NODE_ENV);
console.log('🔑 Supabase URL present:', !!import.meta.env.VITE_SUPABASE_URL);
if (!import.meta.env.VITE_SUPABASE_URL) console.error('❌ VITE_SUPABASE_URL is MISSING!');
console.log('🔑 Gemini API Key present:', !!import.meta.env.VITE_GEMINI_API_KEY);
if (!import.meta.env.VITE_GEMINI_API_KEY) console.error('❌ VITE_GEMINI_API_KEY is MISSING!');
// DEBUG LOGGING END

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("❌ FATAL: Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

console.log('✅ Root element found, mounting React app...');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </ErrorBoundary>
);

console.log('▶️ React render called');
