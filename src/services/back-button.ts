import { useEffect, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';

/**
 * The Android hardware / gesture back button.
 *
 * The player takes the lock while it is open and releases it on the way out.
 * Without the lock, back on the player route finished the activity and sent the
 * viewer to the launcher — verified on device. The player became a place you
 * could only leave via a button the provider's own frame could cover.
 *
 * A native key event is the one signal a cross-origin frame cannot intercept,
 * which is what makes this the reliable exit.
 */
interface BackButtonPlugin {
  lock(options: { locked: boolean }): Promise<void>;
  addListener(
    event: 'backPressed',
    handler: () => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const Back = registerPlugin<BackButtonPlugin>('BackButton');

/**
 * Routes the hardware back button to `onBack` for as long as this is mounted.
 *
 * `onBack` returning `false` means "not handled here": the lock is released and
 * the key falls through to Android's default behaviour. That escape matters —
 * a handler that could never decline would make the app impossible to dismiss.
 */
export function useHardwareBack(onBack: () => boolean | void) {
  // Held in a ref so a caller passing an inline arrow does not re-subscribe on
  // every render, which would drop and re-take the lock mid-video.
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    let remove: (() => Promise<void>) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await Back.lock({ locked: true });
        const listener = await Back.addListener('backPressed', () => {
          if (handler.current() === false) {
            Back.lock({ locked: false }).catch(() => undefined);
          }
        });
        if (cancelled) {
          void listener.remove();
          return;
        }
        remove = listener.remove;
      } catch {
        // Web, or a build without the plugin. The on-screen buttons still work.
      }
    })();

    return () => {
      cancelled = true;
      Back.lock({ locked: false }).catch(() => undefined);
      void remove?.();
    };
  }, []);
}
