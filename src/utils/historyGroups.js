// Compact relative label for a single card (e.g. Home's "Recent" row):
// "Today", "Yesterday", or a short date like "Sep 10".
export function formatShortDate(timestamp) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const entryDay = startOfDay(new Date(timestamp));

  if (entryDay.getTime() === today.getTime()) return 'Today';
  if (entryDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return entryDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Buckets history entries into date-relative sections (Today, Yesterday,
// Last Week, Last Month, Older) for a grouped list, similar to how most
// file/photo apps present recent items.
export function groupHistoryByDate(history) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);

  const buckets = {
    Today: [],
    Yesterday: [],
    'Last Week': [],
    'Last Month': [],
    Older: [],
  };

  history.forEach((entry) => {
    const entryDay = startOfDay(new Date(entry.createdAt));
    if (entryDay.getTime() === today.getTime()) {
      buckets.Today.push(entry);
    } else if (entryDay.getTime() === yesterday.getTime()) {
      buckets.Yesterday.push(entry);
    } else if (entryDay.getTime() > weekAgo.getTime()) {
      buckets['Last Week'].push(entry);
    } else if (entryDay.getTime() > monthAgo.getTime()) {
      buckets['Last Month'].push(entry);
    } else {
      buckets.Older.push(entry);
    }
  });

  return Object.entries(buckets)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}
