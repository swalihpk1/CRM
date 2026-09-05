import React, { useState } from 'react';
import * as usersApi from '../../api/users';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useConfirm } from '../../hooks/useConfirm';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { format12Hour } from '../../lib/formatters';
import { UserFormModal } from './UserFormModal';
import { RoleChangeModal } from './RoleChangeModal';

function roleBadgeColor(role) {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'staff':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function UsersPage() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const confirm = useConfirm();

  const { data: users = [], isLoading, refetch } = useQuery(
    (signal) => usersApi.getUsers({ signal }),
    []
  );
  useInvalidationSubscription('users', refetch);

  const { mutate: createUser, isPending: creating } = useMutation(usersApi.createUser, {
    invalidates: 'users',
    successMessage: 'User created successfully',
    errorMessage: (err) => err.detail || 'Failed to create user',
    onSuccess: () => setShowUserModal(false),
  });

  const { mutate: deleteUser } = useMutation(usersApi.deleteUser, {
    invalidates: 'users',
    successMessage: 'User deleted successfully',
    errorMessage: (err) => err.detail || 'Failed to delete user',
  });

  const { mutate: updateRole, isPending: updatingRole } = useMutation(
    ({ userId, role }) => usersApi.updateUserRole(userId, role),
    {
      invalidates: 'users',
      successMessage: 'User role updated successfully',
      errorMessage: (err) => err.detail || 'Failed to update role',
      onSuccess: () => setSelectedUser(null),
    }
  );

  const handleDelete = async (userId) => {
    const ok = await confirm({
      title: 'Delete this user?',
      description: 'This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (ok) deleteUser(userId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">User Management</h2>
        <button
          onClick={() => setShowUserModal(true)}
          className="px-6 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold min-h-11"
        >
          + Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
          No users found. Add users to get started.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="lg:hidden space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-white rounded-xl shadow-md p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">{format12Hour(user.created_at)}</p>
                  </div>
                  <span
                    className={`px-3 py-1 shrink-0 inline-flex text-xs font-semibold rounded-full border ${roleBadgeColor(
                      user.role
                    )}`}
                  >
                    {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                  </span>
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium min-h-9"
                  >
                    Change Role
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium min-h-9"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet: table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${roleBadgeColor(
                            user.role
                          )}`}
                        >
                          {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format12Hour(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showUserModal && (
        <UserFormModal
          onClose={() => setShowUserModal(false)}
          onSave={createUser}
          isPending={creating}
        />
      )}

      {selectedUser && (
        <RoleChangeModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={(newRole) => updateRole({ userId: selectedUser.id, role: newRole })}
          isPending={updatingRole}
        />
      )}
    </div>
  );
}
