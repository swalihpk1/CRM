import React from 'react';
import { NavLink } from 'react-router-dom';

// Config-driven nav — replaces 9 near-identical hand-written buttons that
// each duplicated the active-state className logic and setView() call.
// adminOnly entries are hidden here (UX convenience) AND enforced by
// AdminRoute (routes/AdminRoute.jsx) so hiding the link is not the only
// thing standing between a non-admin and the page.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/contacts', label: 'Contacts', icon: '👥' },
  { to: '/followups', label: 'Follow-ups', icon: '🔔' },
  { to: '/meetings', label: 'Meetings', icon: '📅' },
  { to: '/import', label: 'Import', icon: '📤', adminOnly: true },
  { to: '/demos', label: 'Demo Reports', icon: '🎬' },
  { to: '/activity', label: 'Activity Log', icon: '📝' },
  { to: '/productivity', label: 'Productivity', icon: '📊', adminOnly: true },
  { to: '/users', label: 'Users', icon: '👤', adminOnly: true },
];

const linkClass = ({ isActive }) =>
  `w-full text-left px-4 py-3 rounded-lg transition text-sm lg:text-base flex items-center gap-2 min-h-11 ${
    isActive ? 'bg-indigo-600' : 'hover:bg-indigo-600'
  }`;

export function Sidebar({ user, onLogout, onNavigate }) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'admin');

  return (
    <>
      <div className="p-6 border-b border-indigo-600">
        <h1 className="text-lg font-bold">SmartCRM</h1>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={linkClass}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-indigo-600">
        <button
          onClick={onLogout}
          className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 rounded-lg transition text-sm lg:text-base min-h-11"
        >
          Logout
        </button>
      </div>
    </>
  );
}
