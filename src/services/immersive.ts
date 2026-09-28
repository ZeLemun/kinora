import { registerPlugin } from '@capacitor/core';

/**
 * Native immersive mode. Hides the status bar *and* the gesture/nav bar while
 * the video player is open.
 */
interface ImmersivePlugin {
  enter(): Promise<void>;
  exit(): Promise<void>;
  reapply(): Promise<void>;
}

const Immersive = registerPlugin<ImmersivePlugin>('Immersive');

export const immersive = {
  async enter() {
    try {
      await Immersive.enter();
    } catch {
      // Not available on web; StatusBar.hide() still covers the status bar.
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
};
