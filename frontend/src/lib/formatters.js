// Shared display formatters. Consolidates logic that was previously
// duplicated across ~15+ call sites in the old App.js.

export function format12Hour(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Contact `data` is a free-form bag populated from user-driven Excel column
// mappings (backend/server.py's import route), so the same logical field
// can land under several different literal keys depending on how a given
// spreadsheet's columns were named/mapped at import time. This reader
// tries the field's known aliases in order and returns the first present,
// non-empty value.
const FIELD_ALIASES = {
  shop_name: ['shop_name', 'Shop_Name', 'Shop Name', 'shop', 'Shop'],
  customer_name: ['customer_name', 'Customer_Name', 'Customer Name', 'name', 'Name'],
};

export function readContactField(contact, field) {
  const data = contact?.data;
  if (!data) return undefined;
  const aliases = FIELD_ALIASES[field] || [field];
  for (const key of aliases) {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

export function getShopName(contact, fallback = '') {
  return readContactField(contact, 'shop_name') ?? fallback;
}

export function getContactName(followup) {
  if (followup.contact) {
    const name = followup.contact.customer_name || followup.contact.data?.name || followup.contact.data?.Name;
    const shopName = getShopName(followup.contact);
    // Only parenthesize a real name — never fall back to repeating the
    // phone number in brackets next to the shop name (the phone is shown
    // on its own line already).
    if (shopName && name) return `${shopName} (${name})`;
    return shopName || name || followup.contact.phone;
  }
  return followup.contact_id;
}

export function getContactPhone(followup) {
  return followup.contact?.phone || 'N/A';
}

// The staff member who scheduled/created this follow-up — distinct from
// the contact's assigned_staff (who owns the contact overall). Falls back
// to the email's local part, matching the same convention used when
// assigned_staff is auto-derived from an email server-side.
export function getFollowupCreatedBy(followup) {
  if (!followup.user_email) return null;
  return followup.user_email.split('@')[0];
}
