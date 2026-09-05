import React, { useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useMeetingScheduler } from '../context/MeetingSchedulerContext';
import { Sidebar } from './Sidebar';
import { ContactDetailModal } from '../components/contacts/ContactDetailModal';
import { NewMeetingModal } from '../features/meetings/NewMeetingModal';
import * as contactsApi from '../api/contacts';

/**
 * Chrome shell: sidebar/mobile nav + <Outlet/> for the active route +
 * the two modals that are opened from many different places
 * (ContactDetailModal via ?contact=<id>, NewMeetingModal via
 * MeetingSchedulerContext) so they're mounted once instead of duplicated
 * inline in 3-4 different view components as the old App.js did.
 */
export function AppLayout() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { open: meetingModalOpen, preselectedContacts, closeMeetingScheduler } =
    useMeetingScheduler();

  const contactId = searchParams.get('contact');
  const [selectedContact, setSelectedContact] = useState(null);

  // Close mobile menu on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Resolve the contact for the ?contact=<id> deep link. If it isn't
  // already known (e.g. a cold deep link, or opened from a list that only
  // has a summary row), fetch it directly — previously unused by the
  // frontend despite GET /contacts/:id existing on the backend.
  useEffect(() => {
    if (!contactId) {
      setSelectedContact(null);
      return;
    }
    let cancelled = false;
    contactsApi
      .getContact(contactId)
      .then((contact) => !cancelled && setSelectedContact(contact))
      .catch(() => !cancelled && setSelectedContact(null));
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const closeContactModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('contact');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-indigo-700 text-white p-4 flex justify-between items-center z-50">
        <h1 className="text-lg font-bold">SmartCRM</h1>
        <button
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="p-2 rounded-lg hover:bg-indigo-600 transition min-w-11 min-h-11 flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-indigo-700 text-white flex flex-col transition-transform duration-300 ease-in-out`}
      >
        <Sidebar user={user} onLogout={logout} onNavigate={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto lg:ml-0 pt-16 lg:pt-0 min-h-0">
        <div className="p-4 lg:p-8 min-h-full">
          <Outlet />
        </div>
      </div>

      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={closeContactModal}
          onUpdated={setSelectedContact}
          onDeleted={closeContactModal}
        />
      )}

      <NewMeetingModal
        open={meetingModalOpen}
        preselectedContacts={preselectedContacts}
        onClose={closeMeetingScheduler}
      />
    </div>
  );
}
