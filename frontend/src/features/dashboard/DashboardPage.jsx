import React from 'react';
import * as contactsApi from '../../api/contacts';
import { useQuery } from '../../hooks/useQuery';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { StatsGrid } from './StatsGrid';

/**
 * Dashboard shows only the contacts stats grid — no follow-up panels
 * (per explicit request, the overdue/upcoming follow-up lists were
 * removed from this page; that data lives on the Follow-ups page instead).
 */
export function DashboardPage() {
  const { data: stats, isLoading, refetch } = useQuery(
    (signal) => contactsApi.getContactsCount({ signal }),
    []
  );
  useInvalidationSubscription('contacts.count', refetch);

  if (isLoading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">Dashboard</h2>
      <StatsGrid stats={stats ?? { total: 0, by_status: {} }} />
    </div>
  );
}
