import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

// Makes the old inline `user?.role === 'admin' && <View />` guards
// un-bypassable by direct URL entry, not just hidden from the sidebar.
export function AdminRoute() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
