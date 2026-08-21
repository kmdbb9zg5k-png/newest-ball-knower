import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

let lockCount = 0;
let lockedScrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> = {};

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
  useEffect(() => {
    lockPageScroll();
    return unlockPageScroll;
  }, []);

  return createPortal(children, document.body);
};
