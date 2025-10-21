import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Popover({ anchorRef, open, onClose = () => {}, minWidth = 220, children, offset = 6, zIndex = 30050, maxHeight = 320 }) {
  const [pos, setPos] = useState({ left: 0, top: 0, width: minWidth });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef?.current;
    if (!anchor) return;

    const update = () => {
      // Use viewport coordinates (fixed positioning) so the popover does not
      // expand the document and trigger page scrollbars.
      const r = anchor.getBoundingClientRect();
      const width = Math.max(minWidth, r.width);

      // Center popover horizontally over the anchor when possible
      let left = r.left + (r.width - width) / 2;
      left = Math.max(8, Math.min(window.innerWidth - width - 8, left));

      // Decide whether to place above or below.
      const spaceBelow = window.innerHeight - r.bottom - offset;
      const spaceAbove = r.top - offset;

      // Try to read actual rendered popover height; fall back to maxHeight.
      const renderedH = rootRef.current ? Math.min(maxHeight, rootRef.current.offsetHeight) : Math.min(maxHeight, 200);

      let top;
      // Prefer above placement (anchor above the button) when there is enough space above
      // or when below space is insufficient.
      if (spaceAbove >= renderedH || spaceAbove > spaceBelow) {
        // place above: popover bottom is anchored to anchor.top - offset
        top = Math.max(8, r.top - offset - renderedH);
      } else {
        // place below
        top = Math.min(window.innerHeight - renderedH - 8, r.bottom + offset);
      }

      setPos({ left, top, width });
    };

    update();
  const ro = new ResizeObserver(update);
  ro.observe(anchor);
  window.addEventListener('resize', update, { passive: true });
  // still listen to scroll so the popover repositions if the viewport moves
  window.addEventListener('scroll', update, { passive: true });

    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (anchor.contains(e.target)) return;
      if (rootRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, anchorRef, minWidth, offset, onClose]);

  if (!open) return null;

  const el = (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex,
        minWidth: pos.width,
        maxHeight,
        overflowY: 'auto',
        background: 'rgba(20,40,80,0.98)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 8,
        padding: 8,
        boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
      }}
      role="dialog"
      aria-modal="false"
    >
      {children}
    </div>
  );

  return createPortal(el, document.body);
}
