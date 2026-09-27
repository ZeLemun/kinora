export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  return classes
    .flatMap((c) =>
      typeof c === 'string'
        ? c
        : c && typeof c === 'object'
        ? Object.entries(c).filter(([, v]) => v).map(([k]) => k)
        : []
    )
    .join(' ');
}

export function formatRuntime(minutes: number | undefined | null): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function formatYear(dateString: string | undefined | null): string {
  if (!dateString) return '';
  return new Date(dateString).getFullYear().toString();
}

export function formatRating(rating: number | undefined | null): string {
  if (!rating) return 'N/A';
  return rating.toFixed(1);
}

export function getYearFromId(id: string): string {
  const match = id.match(/(\d{4})/);
  return match ? match[1] : '';
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}