import { registerPlugin } from '@capacitor/core';

/**
 * Native immersive mode. Hides the status bar *and* the gesture/nav bar while
 * the video player is open.
 */
interface ImmersivePlugin {
  enter(): Promise<void>;
  exit(): Promise<void>;
  reapply(): Promise<void>;
  setLandscape(options: { locked: boolean }): Promise<void>;
}

const Immersive = registerPlugin<ImmersivePlugin>('Immersive');

export const immersive = {
  async enter() {
    try {
      await Immersive.enter();
    } catch {
      // Not available on web; the status bar is covered by the dark theme.
    }
  },
  async exit() {
    try {
      await Immersive.exit();
    } catch {
      /* no-op */
    }
  },
  async reapply() {
    try {
      await Immersive.reapply();
    } catch {
      /* no-op */
    }
  },
  /** Forces landscape while `locked`, otherwise hands control back to the sensor. */
  async setLandscape(locked: boolean) {
    try {
      await Immersive.setLandscape({ locked });
    } catch {
      /* no-op on web */
    }
  },
};
