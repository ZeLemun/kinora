import { useEffect, useState } from 'react';

/** True while the on-screen keyboard is covering part of the viewport. */
export function useKeyboardOpen(threshold = 120): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const check = () => {
      // The keyboard shrinks the visual viewport but not window.innerHeight.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setOpen(covered > threshold);
    };

    check();
    vv.addEventListener('resize', check);
    vv.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);

    return () => {
      vv.removeEventListener('resize', check);
      vv.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [threshold]);

  return open;
}

/** True while the device is in landscape orientation. */
export function useIsLandscape(): boolean {
  const [landscape, setLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const update = () => setLandscape(mq.matches);
    update();
    mq.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return landscape;
}
