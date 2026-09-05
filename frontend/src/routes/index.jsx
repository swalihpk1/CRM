import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthPage } from '../features/auth/AuthPage';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminRoute } from './AdminRoute';

// Code-split the admin/occasional-use pages — they aren't needed in the
// initial bundle for the common case of a staff user who never visits
// Import/Productivity/Users. DashboardPage stays eagerly imported since
// it's the landing route for every login.
const ContactsPage = lazy(() =>
  import('../features/contacts/ContactsPage').then((m) => ({ default: m.ContactsPage }))
);
const FollowUpsPage = lazy(() =>
  import('../features/followups/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage }))
);
const MeetingsPage = lazy(() =>
  import('../features/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage }))
);
const ImportPage = lazy(() =>
  import('../features/import/ImportPage').then((m) => ({ default: m.ImportPage }))
);
const DemoReportsPage = lazy(() =>
  import('../features/demos/DemoReportsPage').then((m) => ({ default: m.DemoReportsPage }))
);
const ActivityLogPage = lazy(() =>
  import('../features/activity/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage }))
);
const ProductivityPage = lazy(() =>
  import('../features/productivity/ProductivityPage').then((m) => ({ default: m.ProductivityPage }))
);
const UsersPage = lazy(() =>
  import('../features/users/UsersPage').then((m) => ({ default: m.UsersPage }))
);

function PageFallback() {
  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );
}

function withSuspense(Component) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <AuthPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'contacts', element: withSuspense(ContactsPage) },
          { path: 'followups', element: withSuspense(FollowUpsPage) },
          { path: 'meetings', element: withSuspense(MeetingsPage) },
          { path: 'demos', element: withSuspense(DemoReportsPage) },
          { path: 'activity', element: withSuspense(ActivityLogPage) },
          {
            element: <AdminRoute />,
            children: [
              { path: 'import', element: withSuspense(ImportPage) },
              { path: 'productivity', element: withSuspense(ProductivityPage) },
              { path: 'users', element: withSuspense(UsersPage) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
