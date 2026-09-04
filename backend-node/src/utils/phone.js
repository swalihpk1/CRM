/**
 * Normalize phone number by removing spaces, special characters, and country
 * code. Returns the last 10 digits for comparison.
 * Examples:
 * - +91 1234567890 -> 1234567890
 * - 123 4567 890 -> 1234567890
 * - +911234567890 -> 1234567890
 */
function normalizePhone(phone) {
  if (!phone) return '';
  const digitsOnly = String(phone).replace(/\D/g, '');
  if (digitsOnly.length > 10) {
    return digitsOnly.slice(-10);
  }
  return digitsOnly;
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

module.exports = { normalizePhone, digitsOnly };
