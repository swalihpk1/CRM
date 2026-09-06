import React, { useState } from 'react';
import { X, Crown, User as UserIcon, Check } from 'lucide-react';

function SectionHeading({ children }) {
  return (
    <div className="mb-3 pb-2 border-b border-gray-100">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>
    </div>
  );
}

export function EditUserModal({ user, onClose, onSave, isPending }) {
  const [email, setEmail] = useState(user.email);
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [error, setError] = useState('');

  const hasChanges = email !== user.email || selectedRole !== user.role;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasChanges) return;
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return;
    }
    setError('');
    onSave({ email, role: selectedRole });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b px-4 sm:px-6 py-4 flex justify-between items-center">
          <h3 className="text-base sm:text-xl font-bold text-gray-800">Edit User</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <SectionHeading>Email</SectionHeading>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              placeholder="user@example.com"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <SectionHeading>Role</SectionHeading>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition min-h-11 ${
                  selectedRole === 'staff' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  value="staff"
                  checked={selectedRole === 'staff'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="text-indigo-600"
                />
                <UserIcon size={16} className="text-blue-600 shrink-0" />
                <div>
                  <div className="font-medium text-sm text-gray-800">Staff</div>
                  <div className="text-xs text-gray-500">Can manage contacts, follow-ups, and meetings</div>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition min-h-11 ${
                  selectedRole === 'admin' ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  value="admin"
                  checked={selectedRole === 'admin'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="text-indigo-600"
                />
                <Crown size={16} className="text-purple-600 shrink-0" />
                <div>
                  <div className="font-medium text-sm text-gray-800">Admin</div>
                  <div className="text-xs text-gray-500">Full access including user management</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm min-h-9"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!hasChanges || isPending}
              className="ml-auto px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition font-medium text-sm min-h-9 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={14} /> {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
