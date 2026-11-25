const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}

export function formatCompactCount(count: number): string {
  if (!count || count <= 0) return '';
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
