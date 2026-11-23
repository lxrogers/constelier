// Dates as the admin panel shows them, in New York time (where the bench is).
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const DAY_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
});

export const shortDate = (d: Date) => DAY.format(d);
export const dateTime = (d: Date) => DAY_TIME.format(d);
