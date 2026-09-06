import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Pencil, Trash2 } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { useConfirm } from '../../hooks/useConfirm';
import { readContactField } from '../../lib/formatters';
import { STATUSES } from './ContactsToolbar';

function readPhone2(contact) {
  const data = contact.data || {};
  return data.phone2 || data.Phone2 || data['Phone 2'] || data.alternate_phone || data.secondary_phone || '';
}

const STATUS_BADGE = {
  None: 'bg-gray-100 text-gray-700',
  'Not Attending': 'bg-orange-100 text-orange-800',
  'Follow-up': 'bg-yellow-100 text-yellow-800',
  Interested: 'bg-green-100 text-green-800',
  'Not Interested': 'bg-red-100 text-red-800',
  Irrelevant: 'bg-purple-100 text-purple-800',
  'Logged In': 'bg-teal-100 text-teal-800',
};

/**
 * The desktop/tablet (>=sm) table view. Renders one <td> per visible
 * column, matching the old column-config-driven rendering exactly.
 */
function DesktopTable({
  contacts,
  visibleColumns,
  draggedColumn,
  onDragStart,
  onDragOver,
  onDrop,
  selectedContacts,
  isAllSelected,
  isIndeterminate,
  onSelectAll,
  onSelectContact,
  onLogCall,
  onUpdate,
  onUpdateStatus,
  onDelete,
  onOpenContact,
}) {
  const confirm = useConfirm();

  const renderCell = (column, contact) => {
    switch (column.id) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={selectedContacts.has(contact.id)}
            onChange={(e) => {
              e.stopPropagation();
              onSelectContact(contact.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
        );
      case 'phone':
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-900">{contact.phone}</span>
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => {
                e.stopPropagation();
                onLogCall(contact.id, contact.phone);
              }}
              className="text-indigo-600 hover:text-indigo-800"
              title="Call"
            >
              <Phone size={14} />
            </a>
            <a
              href={`https://wa.me/${String(contact.phone).replace(/[^\d]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="WhatsApp"
            >
              <FaWhatsapp size={14} color="#25D366" />
            </a>
          </div>
        );
      case 'phone2': {
        const phone2 = readPhone2(contact);
        return (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-between w-full">
              <span className="text-gray-900">{phone2 || '-'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newPhone2 = window.prompt('Enter phone 2:', phone2);
                  if (newPhone2 !== null && newPhone2 !== phone2) {
                    onUpdate({ ...contact, data: { ...contact.data, phone2: newPhone2 } });
                  }
                }}
                className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
                title="Edit Phone 2"
              >
                <Pencil size={13} />
              </button>
            </div>
            {phone2 && (
              <>
                <a
                  href={`tel:${phone2}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogCall(contact.id);
                  }}
                  className="text-indigo-600 hover:text-indigo-800"
                  title="Call Phone 2"
                >
                  <Phone size={14} />
                </a>
                <a
                  href={`https://wa.me/${String(phone2).replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="WhatsApp"
                >
                  <FaWhatsapp size={14} color="#25D366" />
                </a>
              </>
            )}
          </div>
        );
      }
      case 'customerName':
        return (
          <div className="flex items-center justify-between">
            <span>{contact.customer_name || '-'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newName = window.prompt('Enter customer name:', contact.customer_name || '');
                if (newName !== null && newName !== (contact.customer_name || '')) {
                  onUpdate({ ...contact, customer_name: newName });
                }
              }}
              className="text-indigo-600 hover:text-indigo-800 text-sm ml-2"
              title="Edit Customer Name"
            >
              <Pencil size={13} />
            </button>
          </div>
        );
      case 'shopName': {
        const shopName = readContactField(contact, 'shop_name') || '';
        return <span>{shopName || '-'}</span>;
      }
      case 'address':
        return (
          <span className="text-gray-700">
            {contact.data.address || contact.data.Address || contact.data['Street Address'] || '-'}
          </span>
        );
      case 'city':
        return <span className="text-gray-700">{contact.data.city || contact.data.City || '-'}</span>;
      case 'state':
        return <span className="text-gray-700">{contact.data.state || contact.data.State || '-'}</span>;
      case 'assignedStaff':
        return (
          <span className={`text-sm ${contact.assigned_staff ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
            {contact.assigned_staff || 'Unassigned'}
          </span>
        );
      case 'status':
        return (
          <select
            value={contact.status}
            onChange={(e) => {
              e.stopPropagation();
              onUpdateStatus(contact.id, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className={`px-3 py-1 rounded-full text-sm border-0 font-medium focus:ring-2 focus:ring-indigo-500 ${
              STATUS_BADGE[contact.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );
      case 'category':
        return (
          <span className="text-gray-700">
            {contact.data.category || contact.data.Category || contact.data['Business Category'] || '-'}
          </span>
        );
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const ok = await confirm({
                  title: `Delete ${readContactField(contact, 'shop_name') || contact.phone}?`,
                  description: 'This cannot be undone.',
                  destructive: true,
                  confirmLabel: 'Delete',
                });
                if (ok) onDelete(contact.id);
              }}
              className="text-red-600 hover:text-red-800"
              title="Delete Contact"
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="hidden lg:block overflow-x-auto">
      <table className="w-full min-w-max">
        <thead className="bg-gray-50 border-b">
          <tr className="text-xs lg:text-sm">
            {visibleColumns.map((column) =>
              column.id === 'checkbox' ? (
                <th key={column.id} className={`px-6 py-3 text-left whitespace-nowrap ${column.width}`}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isIndeterminate;
                    }}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </th>
              ) : (
                <th
                  key={column.id}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap ${column.width} ${
                    column.draggable ? 'cursor-move hover:bg-gray-100' : ''
                  } ${draggedColumn === column.id ? 'opacity-50' : ''}`}
                  draggable={column.draggable}
                  onDragStart={(e) => column.draggable && onDragStart(e, column.id)}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, column.id)}
                  title={column.draggable ? 'Drag to reorder columns' : ''}
                >
                  <div className="flex items-center gap-1">
                    {column.draggable && <span className="text-gray-400">⋮⋮</span>}
                    {column.label}
                  </div>
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {contacts.map((contact) => (
            <tr
              key={contact.id}
              className={`hover:bg-gray-50 cursor-pointer ${selectedContacts.has(contact.id) ? 'bg-indigo-50' : ''}`}
              onClick={() => onOpenContact(contact)}
            >
              {visibleColumns.map((column) => (
                <td key={column.id} className={`px-6 py-4 whitespace-nowrap ${column.width}`}>
                  {renderCell(column, contact)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mobile (<lg) card list — the responsive alternative to the table. */
function MobileCardList({
  contacts,
  selectedContacts,
  onSelectContact,
  onLogCall,
  onUpdateStatus,
  onOpenContact,
}) {
  return (
    <div className="lg:hidden divide-y">
      {contacts.map((contact) => {
        const shopName = readContactField(contact, 'shop_name');
        const phone2 = readPhone2(contact);
        const city = contact.data?.city || contact.data?.City || '';
        const waHref = (phone) => `https://wa.me/${String(phone).replace(/[^\d]/g, '')}`;

        return (
          <div
            key={contact.id}
            className={`p-4 ${selectedContacts.has(contact.id) ? 'bg-indigo-50' : ''}`}
            onClick={() => onOpenContact(contact)}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedContacts.has(contact.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelectContact(contact.id, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 mt-1 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{shopName || contact.customer_name || contact.phone}</p>
                  <select
                    value={contact.status}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateStatus(contact.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`px-2 py-1 rounded-full text-xs border-0 font-medium shrink-0 ${
                      STATUS_BADGE[contact.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                {shopName && contact.customer_name && (
                  <p className="text-xs text-gray-500 truncate">{contact.customer_name}</p>
                )}

                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span>{contact.phone}</span>
                    <a
                      href={`tel:${contact.phone}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLogCall(contact.id, contact.phone);
                      }}
                      className="text-indigo-600 min-w-6 min-h-6 shadow border rounded flex items-center justify-center"
                      title="Call"
                    >
                      <Phone size={14} />
                    </a>
                    <a
                      href={waHref(contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-6 min-h-6 shadow border rounded flex items-center justify-center"
                      title="WhatsApp"
                    >
                      <FaWhatsapp size={14} color="#25D366" />
                    </a>
                  </div>

                  {phone2 && (
                    <div className="flex items-center gap-1">
                      <span>{phone2}</span>
                      <a
                        href={`tel:${phone2}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onLogCall(contact.id, phone2);
                        }}
                        className="text-indigo-600 min-w-6 min-h-6 shadow border rounded flex items-center justify-center"
                        title="Call"
                      >
                        <Phone size={14} />
                      </a>
                      <a
                        href={waHref(phone2)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-6 min-h-6 shadow border rounded flex items-center justify-center"
                        title="WhatsApp"
                      >
                        <FaWhatsapp size={14} color="#25D366" />
                      </a>
                    </div>
                  )}
                </div>

                {city && <p className="text-xs text-gray-500 mt-1">{city}</p>}

                <p className="text-xs text-gray-400 mt-1">
                  {contact.assigned_staff || 'Unassigned'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ContactsTable(props) {
  const navigate = useNavigate();
  const onOpenContact = (contact) => {
    if (props.onOpenContact) return props.onOpenContact(contact);
    navigate(`?contact=${contact.id}`, { replace: false });
  };

  if (props.contacts.length === 0 && !props.loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        No contacts found. Import or add contacts to get started.
      </div>
    );
  }

  return (
    <>
      <MobileCardList {...props} onOpenContact={onOpenContact} />
      <DesktopTable {...props} onOpenContact={onOpenContact} />
    </>
  );
}
