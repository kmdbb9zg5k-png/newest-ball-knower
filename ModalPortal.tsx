import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let lockCount = 0;
let lockedScrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const lockPageScroll = () => {
  lockCount += 1;
  if (lockCount > 1) return;
  lockedScrollY = window.scrollY;
  previousBodyStyles = {
    overflow: document.body.style.overflow,
    position: document.body.style.position,
    top: document.body.style.top,
    width: document.body.style.width,
  };
  Object.assign(document.body.style, {
    overflow: 'hidden',
    position: 'fixed',
    top: `-${lockedScrollY}px`,
    width: '100%',
  });
};

const unlockPageScroll = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  Object.assign(document.body.style, previousBodyStyles);
  window.scrollTo(0, lockedScrollY);
};

export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockPageScroll();
    const container = containerRef.current;
    const focusable = () => container
      ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(element => element.tabIndex >= 0)
      : [];
    (focusable()[0] || container)?.focus({ preventScroll: true });

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);

    return () => {
      document.removeEventListener('keydown', trapFocus);
      unlockPageScroll();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<div ref={containerRef} tabIndex={-1} className="fixed inset-0 z-[9998] outline-none">{children}</div>, document.body);
};
