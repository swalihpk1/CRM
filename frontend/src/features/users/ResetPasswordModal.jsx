import React, { useState } from 'react';
import { X, Eye, EyeOff, Check } from 'lucide-react';

export function ResetPasswordModal({ user, onClose, onSave, isPending }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    onSave(password);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full">
        <div className="border-b px-4 sm:px-6 py-4 flex justify-between items-center">
          <h3 className="text-base sm:text-xl font-bold text-gray-800">Reset Password</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-800">{user.email}</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">New Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-base"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 min-w-9 min-h-9 flex items-center justify-center"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Confirm Password *</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

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
              disabled={isPending}
              className="ml-auto px-4 py-2 border border-orange-200 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition font-medium text-sm min-h-9 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={14} /> {isPending ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
