// Pure formatting/lookup logic extracted from the old ActivityLogView,
// unchanged in behavior. Note: `contacts` here is whatever list the caller
// has loaded (typically just the current page of the contacts list, or
// none at all) — these lookups are a best-effort display enhancement, not
// a guaranteed match; when a contact can't be found the various N/A /
// target-as-fallback paths below already handle that gracefully.

export function formatIndianDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatAction(log) {
  switch (log.action) {
    case 'Updated contact': {
      const statusMatch = log.details && log.details.match(/Status changed to:\s*([^,]+)/i);
      if (statusMatch) return `Status Updated to ${statusMatch[1].trim()}`;
      if (log.details && log.details.includes('status')) return 'Status Updated';
      return 'Contact Updated';
    }
    case 'Created contact':
      return 'Contact Created';
    case 'Assigned contact':
      return 'Contact Assigned';
    case 'Deleted contact':
      return 'Contact Deleted';
    case 'Created follow-up':
      return 'Follow-up Scheduled';
    case 'Completed follow-up':
      return 'Follow-up Completed';
    case 'Called contact':
      return 'Call Logged';
    case 'Added note':
      return 'Note Added';
    case 'Updated note':
      return 'Note Updated';
    case 'Deleted note':
      return 'Note Deleted';
    case 'Imported contacts':
      return 'Contacts Imported';
    case 'Created meeting':
      return 'Meeting Scheduled';
    case 'Rescheduled meeting':
      return 'Meeting Rescheduled';
    case 'Completed meeting':
      return 'Meeting Completed';
    case 'Cancelled meeting':
      return 'Meeting Cancelled';
    case 'Deleted meeting':
      return 'Meeting Deleted';
    case 'Updated meeting':
      return 'Meeting Updated';
    default:
      if (log.action.startsWith('Updated meeting status to')) {
        const status = log.action.replace('Updated meeting status to ', '');
        if (status === 'completed') return 'Meeting Completed';
        if (status === 'cancelled') return 'Meeting Cancelled';
        return 'Meeting Status Updated';
      }
      return log.action;
  }
}

export function getContactFromLog(log, contacts) {
  if (!contacts.length) return null;

  if (log.target && (log.target.startsWith('+91') || /^\+?\d+/.test(log.target))) {
    return contacts.find((c) => c.phone === log.target);
  }

  if (log.target && log.target.length === 36 && log.target.includes('-')) {
    return (
      contacts.find((c) => c.id === log.target) ||
      contacts.find((c) => c.contact_id === log.target) ||
      contacts.find((c) => c._id === log.target)
    );
  }

  if (log.action && (log.action.includes('Contact') || log.action.includes('contact'))) {
    if (log.target) {
      let foundContact = contacts.find((c) => c.phone === log.target || c.phone === `+91${log.target}`);
      if (foundContact) return foundContact;

      foundContact = contacts.find(
        (c) =>
          (c.data.shop_name && c.data.shop_name === log.target) ||
          (c.data.Shop_Name && c.data.Shop_Name === log.target) ||
          (c.data['Shop Name'] && c.data['Shop Name'] === log.target)
      );
      if (foundContact) return foundContact;
    }

    if (log.details) {
      const phoneMatch = log.details.match(/\+91\d{10}|\d{10}/);
      if (phoneMatch) {
        const phone = phoneMatch[0].startsWith('+91') ? phoneMatch[0] : `+91${phoneMatch[0]}`;
        const foundContact = contacts.find((c) => c.phone === phone);
        if (foundContact) return foundContact;
      }
    }
  }

  if (log.action && log.action.toLowerCase().includes('meeting') && log.details) {
    const phoneMatch = log.details.match(/\+91\d{10}|\d{10}/);
    if (phoneMatch) {
      const phone = phoneMatch[0].startsWith('+91') ? phoneMatch[0] : `+91${phoneMatch[0]}`;
      return contacts.find((c) => c.phone === phone);
    }
  }

  return null;
}

export function getShopNameFromLog(log, contacts) {
  // The backend now resolves and stores the shop name directly on the log
  // at write time (see backend-node/CLAUDE.md) — prefer it over the
  // best-effort client-side guesses below, which only ever had a capped,
  // partial contacts list to search and routinely missed (especially for
  // meeting-related logs, where the target is a phone number, not a shop
  // name). The fallback logic stays for logs written before this field
  // existed.
  if (log.shop_name && log.shop_name !== 'Unknown Shop') return log.shop_name;

  const contact = getContactFromLog(log, contacts);
  if (contact && contact.data) {
    const shopName = contact.data.shop_name || contact.data.Shop_Name || contact.data['Shop Name'];
    return shopName || 'No Shop Name';
  }

  if (log.action === 'Deleted contact' && log.details) {
    const shopMatch = log.details.match(/Shop: ([^,]+)/);
    if (shopMatch && shopMatch[1] && shopMatch[1] !== 'Unknown Shop') return shopMatch[1];
  }

  if (log.action && (log.action.includes('Contact') || log.action.includes('contact')) && log.details) {
    const shopMatch = log.details.match(/Shop: ([^,]+)/);
    if (shopMatch && shopMatch[1] && shopMatch[1] !== 'Unknown Shop') return shopMatch[1];
  }

  if (log.action && (log.action.includes('Contact') || log.action.includes('contact')) && log.target) {
    if (
      !log.target.startsWith('+91') &&
      !/^\+?\d+$/.test(log.target) &&
      !(log.target.length === 36 && log.target.includes('-'))
    ) {
      if (log.target.length > 2) return log.target;
    }

    const foundContact = contacts.find(
      (c) => c.phone && (c.phone === log.target || c.phone.includes(log.target) || log.target.includes(c.phone))
    );
    if (foundContact && foundContact.data) {
      const shopName =
        foundContact.data.shop_name || foundContact.data.Shop_Name || foundContact.data['Shop Name'];
      if (shopName) return shopName;
    }
  }

  if (log.action && log.action.toLowerCase().includes('meeting')) return 'Meeting Contact';

  if (log.action && (log.action.includes('Contact') || log.action.includes('contact')) && log.target) {
    if (!log.target.match(/^\+?\d+$/) && !(log.target.length === 36 && log.target.includes('-'))) {
      return log.target;
    }
  }

  return 'N/A';
}

export function formatTarget(log, contacts) {
  if (!log.target) return 'N/A';

  if (log.target.startsWith('+91') || /^\+?\d+/.test(log.target)) {
    return log.target;
  }

  if (log.target.length === 36 && log.target.includes('-')) {
    const contact = getContactFromLog(log, contacts);
    if (contact && contact.phone) return contact.phone;
    if (log.action === 'Completed follow-up') return 'Follow-up Task';
    return 'Follow-up';
  }

  if (log.action && log.action.toLowerCase().includes('meeting')) {
    const contact = getContactFromLog(log, contacts);
    if (contact && contact.phone) return contact.phone;
    if (log.details) {
      const phoneMatch = log.details.match(/\+91\d{10}|\d{10}/);
      if (phoneMatch) {
        const phone = phoneMatch[0].startsWith('+91') ? phoneMatch[0] : `+91${phoneMatch[0]}`;
        return phone;
      }
    }
    return log.target;
  }

  return log.target;
}

export function formatDetails(log) {
  if (!log.details || log.details === 'N/A') {
    if (log.action === 'Completed follow-up' && log.target) {
      return 'Follow-up task completed successfully';
    }
    return 'N/A';
  }

  if (log.action === 'Updated contact' && log.details.includes('status')) {
    const statusMatch = log.details.match(/Status changed to:\s*([^,]+)/i);
    if (statusMatch) return `Status changed to ${statusMatch[1].trim()}`;
    return 'Contact status changed';
  }

  if (log.action === 'Created follow-up' && log.details.includes('Scheduled for')) {
    const scheduledTime = log.details.match(/Scheduled for (.+)/)?.[1];
    if (scheduledTime) {
      return `Scheduled for ${formatIndianDate(new Date(scheduledTime))}`;
    }
  }

  return log.details;
}

const BLUE = 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-400';
const GREEN = 'bg-green-50 hover:bg-green-100 border-l-4 border-green-400';
const ORANGE = 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-400';
const RED = 'bg-red-50 hover:bg-red-100 border-l-4 border-red-400';

// Color scheme: Updates -> blue, Creation/Scheduled -> green,
// Demo-related -> orange, Delete/Cancel -> red.
export function getRowStyling(action) {
  switch (action) {
    // Creation / scheduled -> green
    case 'Created contact':
    case 'Created follow-up':
    case 'Created meeting':
    case 'Created user':
    case 'Completed follow-up':
    case 'Completed meeting':
    case 'Imported contacts':
    case 'Added note':
    case 'Called contact':
    case 'Assigned contact':
      return GREEN;

    // Updates -> blue
    case 'Updated contact':
    case 'Updated follow-up':
    case 'Updated meeting':
    case 'Rescheduled meeting':
    case 'Updated user role':
    case 'Updated note':
      return BLUE;

    // Demo-related -> orange
    case 'Demo given':
    case 'Demo watched':
      return ORANGE;

    // Delete / cancel -> red
    case 'Deleted contact':
    case 'Deleted follow-up':
    case 'Deleted meeting':
    case 'Deleted user':
    case 'Deleted note':
    case 'Cancelled meeting':
      return RED;

    default:
      if (action.startsWith('Updated meeting status to')) {
        const status = action.replace('Updated meeting status to ', '');
        if (status === 'completed') return GREEN;
        if (status === 'cancelled') return RED;
        return BLUE;
      }
      return 'hover:bg-gray-50';
  }
}
