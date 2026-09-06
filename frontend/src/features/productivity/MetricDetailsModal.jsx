import React from 'react';
import { X, Phone, Calendar, MapPin, Users, Store } from 'lucide-react';
import { format12Hour } from '../../lib/formatters';

const METRIC_LABELS = {
  followups: 'Follow-ups Created',
  followups_completed: 'Follow-ups Completed',
  demos: 'Demos',
  meetings: 'Meetings',
  calls: 'Fresh Calls',
};

function StatusBadge({ label, tone }) {
  const toneClass =
    {
      green: 'bg-green-50 text-green-700 border-green-200',
      red: 'bg-red-50 text-red-700 border-red-200',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      gray: 'bg-gray-100 text-gray-700 border-gray-200',
    }[tone] || 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${toneClass}`}>{label}</span>
  );
}

function FollowupItem({ item }) {
  const tone = item.status === 'completed' ? 'green' : item.status === 'overdue' ? 'red' : 'yellow';
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {item.contact?.customer_name || item.contact?.data?.shop_name || 'Unknown'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <Phone size={12} /> {item.contact?.phone || 'N/A'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Due: {format12Hour(item.follow_up_date)}</p>
          {item.notes && <p className="text-xs text-gray-500 mt-1 italic">"{item.notes}"</p>}
        </div>
        <StatusBadge label={item.status} tone={tone} />
      </div>
    </div>
  );
}

function DemoItem({ item }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {item.contact?.customer_name || item.contact?.data?.shop_name || 'Unknown'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <Phone size={12} /> {item.contact?.phone || 'N/A'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Given: {format12Hour(item.given_at)}</p>
          {item.notes && <p className="text-xs text-gray-500 mt-1 italic">"{item.notes}"</p>}
        </div>
        <StatusBadge label={item.watched ? 'Watched' : 'Not Watched'} tone={item.watched ? 'green' : 'gray'} />
      </div>
    </div>
  );
}

function MeetingItem({ item }) {
  const tone = item.status === 'completed' ? 'green' : item.status === 'cancelled' ? 'red' : 'blue';
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <Calendar size={12} /> {item.date} {item.time && `at ${item.time}`}
          </p>
          {item.location && (
            <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
              <MapPin size={12} /> {item.location}
            </p>
          )}
          {item.notes && <p className="text-xs text-gray-500 mt-1 italic">"{item.notes}"</p>}
          {item.attendees && item.attendees.length > 0 && (
            <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
              <Users size={12} /> {item.attendees.length} attendee(s)
            </p>
          )}
        </div>
        <StatusBadge label={item.status} tone={tone} />
      </div>
    </div>
  );
}

function CallItem({ item }) {
  const status = item.contact?.status;
  const tone =
    status === 'Follow Up'
      ? 'yellow'
      : status === 'Interested'
      ? 'green'
      : status === 'Not Interested'
      ? 'red'
      : status === 'Closed'
      ? 'purple'
      : 'gray';
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {item.contact?.customer_name ||
              item.contact?.data?.shop_name ||
              item.contact?.data?.Shop_Name ||
              'Unknown Customer'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
            <Phone size={12} /> {item.contact?.phone || item.target || 'N/A'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Time: {format12Hour(item.timestamp)}</p>
          {item.contact?.data?.shop_name && item.contact.customer_name && (
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Store size={12} /> {item.contact.data.shop_name}
            </p>
          )}
        </div>
        <StatusBadge label={status || 'Unknown'} tone={tone} />
      </div>
    </div>
  );
}

const ITEM_COMPONENTS = {
  followups: FollowupItem,
  followups_completed: FollowupItem,
  demos: DemoItem,
  meetings: MeetingItem,
  calls: CallItem,
};

export function MetricDetailsModal({ staffName, metric, data, loading, onClose }) {
  const ItemComponent = ITEM_COMPONENTS[metric];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden">
        <div className="border-b px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">
            {staffName} &middot; {METRIC_LABELS[metric] || metric}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center">
                <svg
                  className="animate-spin h-6 w-6 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="ml-3 text-sm text-gray-600">Loading details...</span>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No data available</div>
          ) : (
            <div className="space-y-2.5">
              {data.map((item, index) => (
                <ItemComponent key={index} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
