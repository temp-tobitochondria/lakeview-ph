import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * Sidebar component that can render inline (default) or as a fixed, page-level sidebar via portal.
 *
 * Props:
 * - isOpen: boolean – controls visibility
 * - width: number – sidebar width in pixels
 * - className: string – extra class names
 * - usePortal: boolean – when true, renders as fixed sidebar attached to document.body (outside modal)
 * - side: 'left' | 'right' – which side of the viewport to stick to in portal mode
 * - top: number – offset from top (in pixels) in portal mode
 * - zIndex: number – layer order in portal mode
 */
export default function Sidebar({
  isOpen = true,
  width = 320,
  children,
  className = '',
  usePortal = false,
  side = 'left',
  top = 0,
  zIndex = 3000,
}) {
  const containerStyle = useMemo(() => {
    const base = {
      overflow: 'hidden',
      transition: 'width 260ms ease, opacity 200ms ease, transform 260ms ease, padding 200ms ease, border 200ms ease',
      opacity: isOpen ? 1 : 0,
      background: 'rgba(255,255,255,0.03)',
      border: isOpen ? '1px solid rgba(255,255,255,0.06)' : 'none',
      borderRadius: 8,
      padding: isOpen ? 12 : 0,
      pointerEvents: isOpen ? 'auto' : 'none',
      width: isOpen ? width : 0,
    };
    if (!usePortal) {
      return {
        ...base,
        flex: isOpen ? '0 0 auto' : '0 0 0px',
        transform: isOpen ? 'translateX(0)' : 'translateX(-8px)',
      };
    }
    // Portal mode: fixed sidebar on page
    const isLeft = side !== 'right';
    return {
      ...base,
      position: 'fixed',
      top,
      [isLeft ? 'left' : 'right']: 0,
      height: `calc(100vh - ${top}px)`,
      transform: isOpen
        ? 'translateX(0)'
        : `translateX(${isLeft ? '-8px' : '8px'})`,
      zIndex,
      boxSizing: 'border-box',
      // Ensure the sidebar content scrolls if taller than viewport
      display: 'flex',
      flexDirection: 'column',
    };
  }, [isOpen, width, usePortal, side, top, zIndex]);

  const content = (
    <aside className={className} style={containerStyle} aria-hidden={!isOpen}>
      <div style={{ display: 'grid', gap: 8, width: '100%', overflow: 'auto' }}>{children}</div>
    </aside>
  );

  if (usePortal && typeof document !== 'undefined' && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
