import { useEffect } from 'react';

export function useHotkeys({ toggleLakePanel, closeLakePanel }) {
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input','textarea','select'].includes(tag)) return;
      const k = e.key?.toLowerCase?.();
      if (k === 'l') toggleLakePanel();
      if (k === 'escape') closeLakePanel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [toggleLakePanel, closeLakePanel]);
}
