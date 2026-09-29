/**
 * Class-name joiner.
 *
 * Accepts strings, falsy values and a `{ className: boolean }` map, dropping
 * anything falsy — so a conditional reads as `{ 'is-active': on }` rather than
 * as string concatenation.
 */
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
