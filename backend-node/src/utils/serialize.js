/**
 * response_model-equivalent field whitelisting.
 *
 * FastAPI's `response_model=Contact` (etc.) strips any field not declared on
 * the Pydantic model, and serializes a missing Optional[...] = None field as
 * an explicit JSON null (not an omitted key). These pickers reproduce that.
 *
 * IMPORTANT: only apply these on routes that declared a response_model in
 * the Python source. Routes that returned plain dicts (/followups/upcoming,
 * /by-date, /paginated, /completed, /productivity/*, /contacts/debug-data)
 * must pass raw Mongo docs through UNPICKED (minus _id) — applying a picker
 * there would silently change their response shape.
 */

function pickContact(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    phone: doc.phone,
    customer_name: doc.customer_name ?? null,
    status: doc.status ?? 'None',
    assigned_staff: doc.assigned_staff ?? null,
    assigned_staff_id: doc.assigned_staff_id ?? null,
    data: doc.data ?? {},
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    last_call_at: doc.last_call_at ?? null,
  };
}

function pickNote(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    contact_id: doc.contact_id,
    user_id: doc.user_id,
    content: doc.content,
    created_at: doc.created_at,
  };
}

function pickFollowUp(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    contact_id: doc.contact_id,
    user_id: doc.user_id,
    user_email: doc.user_email,
    follow_up_date: doc.follow_up_date,
    notes: doc.notes ?? null,
    status: doc.status ?? 'pending',
    created_at: doc.created_at,
    notified: doc.notified ?? false,
  };
}

function pickMeeting(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    user_id: doc.user_id,
    user_email: doc.user_email,
    title: doc.title,
    date: doc.date,
    time: doc.time ?? null,
    location: doc.location ?? null,
    notes: doc.notes ?? null,
    attendees: doc.attendees ?? [],
    status: doc.status ?? 'scheduled',
    created_at: doc.created_at,
  };
}

function pickActivityLog(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    user_id: doc.user_id,
    user_email: doc.user_email,
    action: doc.action,
    target: doc.target ?? null,
    details: doc.details ?? null,
    timestamp: doc.timestamp,
  };
}

function pickDemo(doc) {
  if (!doc) return doc;
  return {
    id: doc.id,
    contact_id: doc.contact_id,
    user_id: doc.user_id,
    user_email: doc.user_email,
    given_at: doc.given_at,
    watched: doc.watched ?? false,
    watched_at: doc.watched_at ?? null,
    notes: doc.notes ?? null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

module.exports = {
  pickContact,
  pickNote,
  pickFollowUp,
  pickMeeting,
  pickActivityLog,
  pickDemo,
};
