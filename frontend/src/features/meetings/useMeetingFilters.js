// Pure filtering logic extracted from the old MeetingsView, unchanged in
// behavior — just no longer entangled with component state.

export function filterMeetingsByDate(meetings, filter, customDateFilter) {
  if (filter === 'all') return meetings;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

  return meetings.filter((meeting) => {
    const meetingDate = new Date(meeting.date);
    meetingDate.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'today':
        return meetingDate.getTime() === today.getTime();
      case 'tomorrow':
        return meetingDate.getTime() === tomorrow.getTime();
      case 'this-week':
        return meetingDate >= today && meetingDate < nextWeekEnd;
      case 'custom': {
        if (!customDateFilter) return false;
        const customDate = new Date(customDateFilter);
        customDate.setHours(0, 0, 0, 0);
        return meetingDate.getTime() === customDate.getTime();
      }
      default:
        return true;
    }
  });
}

export function filterMeetingsBySearch(meetings, query) {
  if (!query) return meetings;
  const q = query.toLowerCase();
  return meetings.filter(
    (meeting) =>
      meeting.title.toLowerCase().includes(q) ||
      meeting.location?.toLowerCase().includes(q) ||
      meeting.notes?.toLowerCase().includes(q) ||
      meeting.attendees?.some(
        (attendee) => attendee.name.toLowerCase().includes(q) || attendee.phone.includes(q)
      )
  );
}
