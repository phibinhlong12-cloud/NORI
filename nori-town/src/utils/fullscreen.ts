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
  if (isFullscreenActive()) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches)
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
        await Promise.resolve(doc.webkitExitFullscreen());
      } else if (doc.mozCancelFullScreen) {
        await Promise.resolve(doc.mozCancelFullScreen());
      } else if (doc.msExitFullscreen) {
        await Promise.resolve(doc.msExitFullscreen());
      }
      return { supported: true, active: isFullscreenActive() };
    } catch {
      return { supported: false, active: isFullscreenActive() };
    }
  }

  try {
    if (root.requestFullscreen) {
      try {
        await root.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        await root.requestFullscreen();
      }
      return { supported: true, active: isFullscreenActive() || true };
    }
    if (root.webkitRequestFullscreen) {
      await Promise.resolve(root.webkitRequestFullscreen());
      return { supported: true, active: isFullscreenActive() || true };
    }
    if (root.mozRequestFullScreen) {
      await Promise.resolve(root.mozRequestFullScreen());
      return { supported: true, active: isFullscreenActive() || true };
    }
    if (root.msRequestFullscreen) {
      await Promise.resolve(root.msRequestFullscreen());
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
