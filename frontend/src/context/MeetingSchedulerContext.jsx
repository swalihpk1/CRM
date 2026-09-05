import React, { createContext, useCallback, useContext, useState } from 'react';

/**
 * Replaces `window.scheduleMeetingFromContact` (previously assigned/deleted
 * in Dashboard's mount effect, called from ContactsView and
 * ContactDetailModal). Also replaces `window.openNewMeetingModal` and
 * `window.pendingMeetingContact` — those existed only because MeetingsView
 * had a second, separate "new meeting" modal from GlobalMeetingModal; now
 * that there's a single NewMeetingModal mounted once at the layout level
 * (see layouts/AppLayout.jsx), opening it from any route/component is just
 * calling openMeetingScheduler(contacts) — no cross-route handoff needed.
 */
const MeetingSchedulerContext = createContext(null);

export function MeetingSchedulerProvider({ children }) {
  const [state, setState] = useState({ open: false, preselectedContacts: [] });

  const openMeetingScheduler = useCallback((contacts = []) => {
    setState({ open: true, preselectedContacts: contacts });
  }, []);

  const closeMeetingScheduler = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <MeetingSchedulerContext.Provider
      value={{ ...state, openMeetingScheduler, closeMeetingScheduler }}
    >
      {children}
    </MeetingSchedulerContext.Provider>
  );
}

export function useMeetingScheduler() {
  const ctx = useContext(MeetingSchedulerContext);
  if (!ctx) throw new Error('useMeetingScheduler must be used within a MeetingSchedulerProvider');
  return ctx;
}
