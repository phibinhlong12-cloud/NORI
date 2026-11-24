interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  );
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches
  );
}

export async function toggleFullscreen(): Promise<{
  supported: boolean;
  active: boolean;
}> {
  if (typeof document === 'undefined') {
    return { supported: false, active: false };
  }

  const doc = document as FullscreenDocument;
  const root = document.documentElement as FullscreenElement;

  if (isFullscreenActive()) {
    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
      return { supported: true, active: isFullscreenActive() };
    } catch {
      return { supported: false, active: isFullscreenActive() };
    }
  }

  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
      return { supported: true, active: true };
    }
    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen();
      return { supported: true, active: isFullscreenActive() || true };
    }
    if (root.mozRequestFullScreen) {
      await root.mozRequestFullScreen();
      return { supported: true, active: isFullscreenActive() || true };
    }
    if (root.msRequestFullscreen) {
      await root.msRequestFullscreen();
      return { supported: true, active: isFullscreenActive() || true };
    }
    return { supported: false, active: false };
  } catch {
    return { supported: false, active: isFullscreenActive() };
  }
}

export function subscribeFullscreenChange(listener: (active: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => listener(isFullscreenActive());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
