// Shared shop-name resolution — a backend-node-only addition (see
// backend-node/CLAUDE.md exception). Originally lived only in
// routes/contacts.js; extracted here so every route that logs an
// activity involving a contact (contacts, follow-ups, meetings, notes,
// demos) can embed the real shop name in the log at write time instead of
// leaving the frontend to guess it later from a capped, partial contacts
// list.
function shopNameFromData(data) {
  if (!data) return 'Unknown Shop';
  return (
    data.shop_name ||
    data.Shop_Name ||
    data['Shop Name'] ||
    data.shop ||
    data.Shop ||
    'Unknown Shop'
  );
}

module.exports = { shopNameFromData };
