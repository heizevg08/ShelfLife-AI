import { useEffect, useRef, type PointerEvent } from 'react';

/**
 * Delay pointer-only hover actions while keeping click and keyboard behavior intact.
 * @param onEnter - Called after a precise pointer rests on the target.
 * @param onLeave - Called after the pointer leaves unless focus remains inside.
 * @returns Pointer handlers and a timer cancellation function.
 */
export function useHoverIntent(onEnter: () => void, onLeave: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callbacks = useRef({ onEnter, onLeave });
  callbacks.current = { onEnter, onLeave };
  const cancel = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    cancel,
    onPointerEnter(event: PointerEvent<HTMLElement>) {
      cancel();
      if (event.pointerType !== 'mouse' || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      timer.current = setTimeout(() => callbacks.current.onEnter(), 100);
    },
    onPointerLeave(event: PointerEvent<HTMLElement>) {
      cancel();
      const region = event.currentTarget;
      timer.current = setTimeout(() => {
        if (!region.querySelector(':focus-visible')) callbacks.current.onLeave();
      }, 120);
    },
  };
}
