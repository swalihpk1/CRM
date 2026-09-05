import React from 'react';
import { FollowupCard } from './FollowupCard';

export function FollowupList({ followups, loading, emptyLabel, onOpenContact, onComplete }) {
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-600">
        <div className="inline-flex items-center">
          <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="ml-3 text-lg">Loading follow-ups...</span>
        </div>
      </div>
    );
  }

  if (followups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {followups.map((followup) => (
        <FollowupCard
          key={followup.id}
          followup={followup}
          onOpenContact={onOpenContact}
          onComplete={onComplete}
        />
      ))}
    </div>
  );
}
