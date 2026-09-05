import React, { useState } from 'react';

export function RoleChangeModal({ user, onClose, onSave, isPending }) {
  const [selectedRole, setSelectedRole] = useState(user.role);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(selectedRole);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-xl font-bold text-gray-800">Change User Role</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            User: <span className="font-medium text-gray-800">{user.email}</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Current Role:{' '}
            <span
              className={`font-medium ${user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'}`}
            >
              {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Role</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 min-h-11">
                <input
                  type="radio"
                  value="staff"
                  checked={selectedRole === 'staff'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">👤 Staff</div>
                  <div className="text-xs text-gray-500">Can manage contacts, follow-ups, and meetings</div>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 min-h-11">
                <input
                  type="radio"
                  value="admin"
                  checked={selectedRole === 'admin'}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">👑 Admin</div>
                  <div className="text-xs text-gray-500">Full access including user management</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition min-h-11"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold min-h-11 disabled:opacity-60"
              disabled={selectedRole === user.role || isPending}
            >
              {isPending ? 'Updating…' : 'Update Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
