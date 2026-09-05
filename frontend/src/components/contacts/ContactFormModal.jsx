import React, { useState } from 'react';
import { toast } from '../ui/sonner';
import * as contactsApi from '../../api/contacts';
import { useMutation } from '../../hooks/useMutation';

export function ContactFormModal({ onClose, onCreated }) {
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');

  const { mutate: createContact, isPending } = useMutation(contactsApi.createContact, {
    invalidates: ['contacts', 'contacts.count', 'activityLogs'],
    silent: true, // custom success handling below (closes the modal too)
    onSuccess: () => {
      toast.success('Contact created successfully');
      onCreated?.();
      onClose();
    },
    onError: (err, data) => {
      // Preserve the specific duplicate-phone message the old code showed —
      // status 400 with "already exists" in `detail` (apiClient's response
      // interceptor keeps `detail` as the raw backend string for exactly
      // this kind of check).
      if (err.status === 400 && err.detail?.includes('already exists')) {
        toast.error(`A contact with phone number ${data.phone} already exists in the system.`);
      } else {
        toast.error('Failed to create contact: ' + (err.detail || 'Unknown error'));
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createContact({
      phone,
      customer_name: customerName || undefined,
      data: {
        phone2: phone2 || undefined,
        shop_name: shopName || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        category: category || undefined,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">Add New Contact</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl min-w-11 min-h-11 flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
                placeholder="+1234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone 2</label>
              <input
                type="text"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
                placeholder="Alternate phone"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
              placeholder="Customer Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
              placeholder="Shop Name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
              placeholder="Street Address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
                placeholder="City"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
                placeholder="State"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
              placeholder="Business Category"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold min-h-11 disabled:opacity-60"
          >
            {isPending ? 'Adding…' : 'Add Contact'}
          </button>
        </form>
      </div>
    </div>
  );
}
