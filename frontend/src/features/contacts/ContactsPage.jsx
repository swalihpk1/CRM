import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from '../../components/ui/sonner';
import * as contactsApi from '../../api/contacts';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useMutation } from '../../hooks/useMutation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useConfirm } from '../../hooks/useConfirm';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { useColumnConfig } from './useColumnConfig';
import { ColumnSettingsPanel } from './ColumnSettingsPanel';
import { ContactsToolbar, BulkActionsBar } from './ContactsToolbar';
import { ContactsTable } from './ContactsTable';
import { ContactFormModal } from '../../components/contacts/ContactFormModal';

export function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInput = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';

  // Debounce the URL-visible search so typing doesn't flood browser
  // history AND so it doesn't refire the contacts fetch on every keystroke
  // (the old code refetched on every keystroke via a raw useEffect dep).
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const setSearchInput = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('search', value);
    else next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const setStatusFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const {
    items: contacts,
    isLoading,
    isLoadingMore,
    hasMore,
    sentinelRef,
    reset,
  } = useInfiniteList(
    ({ skip, limit, params }, signal) => contactsApi.getContacts({ skip, limit, ...params }, { signal }),
    { pageSize: 20, params: { search: debouncedSearch, status: statusFilter } }
  );
  useInvalidationSubscription('contacts', reset);

  const columnConfig = useColumnConfig();
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const confirm = useConfirm();

  const isAllSelected = contacts.length > 0 && selectedContacts.size === contacts.length;
  const isIndeterminate = selectedContacts.size > 0 && selectedContacts.size < contacts.length;

  const handleSelectAll = (checked) => {
    setSelectedContacts(checked ? new Set(contacts.map((c) => c.id)) : new Set());
  };

  const handleSelectContact = (id, checked) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const { mutate: updateContact } = useMutation(
    ({ id, patch }) => contactsApi.updateContact(id, patch),
    {
      invalidates: ['contacts.count', 'activityLogs'],
      silent: true,
      onError: () => {
        toast.error('Failed to update contact');
        reset();
      },
    }
  );

  const { mutate: updateStatus } = useMutation(
    ({ id, status }) => contactsApi.updateContact(id, { status }),
    {
      invalidates: ['contacts.count', 'activityLogs'],
      silent: true,
      onError: () => toast.error('Failed to update status'),
    }
  );

  const { mutate: deleteContact } = useMutation(contactsApi.deleteContact, {
    invalidates: ['contacts', 'contacts.count', 'activityLogs'],
    errorMessage: 'Failed to delete contact',
  });

  const { mutate: logCall } = useMutation(contactsApi.logCall, {
    invalidates: 'activityLogs',
    silent: true,
    onError: () => toast.error('Failed to log call'),
  });

  const { mutate: bulkDelete } = useMutation(contactsApi.deleteContacts, {
    invalidates: ['contacts', 'contacts.count', 'activityLogs'],
    silent: true,
    onSuccess: ({ succeeded, failed }) => {
      if (failed.length === 0) {
        toast.success(`Deleted ${succeeded.length} contact${succeeded.length !== 1 ? 's' : ''}`);
      } else {
        toast.error(`Deleted ${succeeded.length} of ${succeeded.length + failed.length} contacts`);
      }
      setSelectedContacts(new Set());
    },
  });

  const handleBulkDelete = async () => {
    const count = selectedContacts.size;
    const ok = await confirm({
      title: `Delete ${count} selected contact${count !== 1 ? 's' : ''}?`,
      description: 'This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (ok) bulkDelete(Array.from(selectedContacts));
  };

  const handleBulkStatusUpdate = async (status) => {
    const ids = Array.from(selectedContacts);
    await Promise.all(ids.map((id) => contactsApi.updateContact(id, { status })));
    reset();
    setSelectedContacts(new Set());
    toast.success(`Updated status for ${ids.length} contact${ids.length !== 1 ? 's' : ''}`);
  };

  const handleLogCall = (contactId) => {
    setTimeout(async () => {
      const ok = await confirm({ title: 'Did you complete the call?' });
      if (ok) logCall(contactId);
    }, 1000);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 lg:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Contacts</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 lg:px-6 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-sm min-h-11 touch-manipulation"
        >
          + Add Contact
        </button>
      </div>

      <ContactsToolbar
        searchQuery={searchInput}
        onSearchChange={setSearchInput}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <BulkActionsBar
        count={selectedContacts.size}
        onUpdateStatus={handleBulkStatusUpdate}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedContacts(new Set())}
      />

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="flex justify-end p-4 border-b">
          <button
            onClick={() => setShowColumnSettings((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition min-h-11 touch-manipulation"
          >
            ⚙️ <span className="hidden sm:inline">Column Settings</span>
          </button>
        </div>

        {showColumnSettings && (
          <ColumnSettingsPanel
            columns={columnConfig.columns}
            onToggle={columnConfig.toggleVisibility}
            onReset={columnConfig.reset}
          />
        )}

        <ContactsTable
          contacts={contacts}
          visibleColumns={columnConfig.visibleColumns}
          draggedColumn={columnConfig.draggedColumn}
          onDragStart={columnConfig.handleDragStart}
          onDragOver={columnConfig.handleDragOver}
          onDrop={columnConfig.handleDrop}
          selectedContacts={selectedContacts}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onSelectAll={handleSelectAll}
          onSelectContact={handleSelectContact}
          onLogCall={handleLogCall}
          onUpdate={(contact) => updateContact({ id: contact.id, patch: { phone: contact.phone, customer_name: contact.customer_name, data: contact.data } })}
          onUpdateStatus={(id, status) => updateStatus({ id, status })}
          onDelete={deleteContact}
          loading={isLoading}
        />
      </div>

      <div ref={sentinelRef} />

      {isLoadingMore && (
        <div className="text-center py-4">
          <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-indigo-500">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading more contacts...
          </div>
        </div>
      )}

      {!hasMore && contacts.length > 0 && (
        <div className="text-center py-4 text-gray-500">No more contacts to load</div>
      )}

      {showAddModal && (
        <ContactFormModal onClose={() => setShowAddModal(false)} onCreated={reset} />
      )}
    </div>
  );
}
