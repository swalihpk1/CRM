import React, { useState } from 'react';
import { Crown, User as UserIcon, Pencil, KeyRound, Trash2 } from 'lucide-react';
import * as usersApi from '../../api/users';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useConfirm } from '../../hooks/useConfirm';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { format12Hour } from '../../lib/formatters';
import { UserFormModal } from './UserFormModal';
import { EditUserModal } from './EditUserModal';
import { ResetPasswordModal } from './ResetPasswordModal';

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  const Icon = isAdmin ? Crown : UserIcon;
  return (
    <span
      className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full border shrink-0 ${
        isAdmin ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
      }`}
    >
      <Icon size={11} /> {isAdmin ? 'Admin' : 'Staff'}
    </span>
  );
}

export function UsersPage() {
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
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

  const { mutate: editUser, isPending: savingUser } = useMutation(
    ({ userId, patch }) => usersApi.updateUser(userId, patch),
    {
      invalidates: 'users',
      successMessage: 'User updated successfully',
      errorMessage: (err) => err.detail || 'Failed to update user',
      onSuccess: () => setEditingUser(null),
    }
  );

  const { mutate: resetPassword, isPending: resettingPassword } = useMutation(
    ({ userId, password }) => usersApi.resetUserPassword(userId, password),
    {
      invalidates: 'users',
      successMessage: 'Password reset successfully',
      errorMessage: (err) => err.detail || 'Failed to reset password',
      onSuccess: () => setResettingUser(null),
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-row justify-between items-center gap-3 mt-2 mb-4 lg:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">User Management</h2>
        <button
          onClick={() => setShowUserModal(true)}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-xs sm:text-sm shrink-0 touch-manipulation"
        >
          + Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500 text-sm">
          No users found. Add users to get started.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="lg:hidden space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{format12Hour(user.created_at)}</p>
                  </div>
                  <RoleBadge role={user.role} />
                </div>
                <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100 flex-wrap">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs font-medium flex items-center gap-1 min-h-8"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => setResettingUser(user)}
                    className="px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg hover:bg-orange-100 text-xs font-medium flex items-center gap-1 min-h-8"
                  >
                    <KeyRound size={12} /> Reset Password
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 text-xs font-medium flex items-center gap-1 min-h-8"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet: table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format12Hour(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingUser(user)}
                            title="Edit"
                            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setResettingUser(user)}
                            title="Reset Password"
                            className="w-7 h-7 flex items-center justify-center bg-orange-50 border border-orange-200 text-orange-700 rounded hover:bg-orange-100"
                          >
                            <KeyRound size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center bg-white border border-red-200 text-red-600 rounded hover:bg-red-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(patch) => editUser({ userId: editingUser.id, patch })}
          isPending={savingUser}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSave={(password) => resetPassword({ userId: resettingUser.id, password })}
          isPending={resettingPassword}
        />
      )}
    </div>
  );
}
