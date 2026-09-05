import React from 'react';
import { RouterProvider } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import { CacheProvider } from './context/CacheContext';
import { ConfirmProvider } from './context/ConfirmProvider';
import { MeetingSchedulerProvider } from './context/MeetingSchedulerContext';
import { Toaster } from './components/ui/sonner';
import { router } from './routes';

/**
 * The entire app, reduced from a single 5,696-line file to this ~20-line
 * provider shell + RouterProvider. See src/routes, src/layouts,
 * src/features, src/api, src/hooks, src/context for everything that used
 * to live inline here.
 */
function App() {
  return (
    <AuthProvider>
      <CacheProvider>
        <ConfirmProvider>
          <MeetingSchedulerProvider>
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors />
          </MeetingSchedulerProvider>
        </ConfirmProvider>
      </CacheProvider>
    </AuthProvider>
  );
}

export default App;
