import { useMemo, useState } from 'react';
import * as contactsApi from '../../api/contacts';
import { useQuery } from '../../hooks/useQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * Server-side contact search, shared by the meeting attendee picker
 * (NewMeetingModal) and any other "find a contact by name/shop/phone"
 * affordance.
 *
 * Replaces the old client-side filter-over-`contacts`-prop pattern
 * (duplicated near-verbatim between MeetingsView and GlobalMeetingModal),
 * which only ever searched the first paginated page of 20 contacts —
 * silently incomplete. This searches the full contacts table via the
 * existing GET /contacts?search= route.
 */
export function useContactSearch({ minLength = 2, limit = 20 } = {}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const enabled = debouncedQuery.trim().length >= minLength;

  const { data, isLoading } = useQuery(
    (signal) => contactsApi.getContacts({ search: debouncedQuery, limit }, { signal }),
    [debouncedQuery, limit],
    { enabled }
  );

  const results = useMemo(() => data ?? [], [data]);

  return { query, setQuery, results, isSearching: enabled && isLoading, enabled };
}
