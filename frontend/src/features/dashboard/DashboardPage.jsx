import React from 'react';
import * as contactsApi from '../../api/contacts';
import { useQuery } from '../../hooks/useQuery';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { StatsGrid } from '../../components/StatsGrid';

const STATUS_COLORS = {
  None: 'text-gray-700',
  'Not Attending': 'text-orange-700',
  'Follow-up': 'text-yellow-700',
  Interested: 'text-green-700',
  'Not Interested': 'text-red-700',
  Irrelevant: 'text-purple-700',
  'Logged In': 'text-teal-700',
};

const STATUSES = Object.keys(STATUS_COLORS);

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

  const s = stats ?? { total: 0, by_status: {} };
  // "Total Contacts" is pulled out as its own standalone card rather than
  // mixed into the status grid — 8 statuses then divides evenly into
  // 2-per-row on mobile with no leftover/empty cell in the last row.
  const statusItems = STATUSES.map((status) => ({
    key: status,
    label: status,
    value: s.by_status[status] || 0,
    colorClass: STATUS_COLORS[status],
  }));

  return (
    <div>
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">Dashboard</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 sm:px-5 sm:py-4 mb-4">
        <p className="text-xs text-gray-500 font-medium">Total Contacts</p>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-indigo-700 mt-0.5">{s.total}</p>
      </div>
      <div className="mb-6 lg:mb-8">
        <StatsGrid items={statusItems} columnsSm={4} columnsLg={4} />
      </div>
    </div>
  );
}
