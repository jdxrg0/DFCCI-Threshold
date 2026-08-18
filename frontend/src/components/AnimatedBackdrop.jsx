import React, { useEffect, useRef } from 'react';

/**
 * The animated page backdrop: drifting colour orbs plus a light that trails
 * the cursor. Mounted once, at the top of App — it is fixed to the viewport
 * and sits behind every route.
 *
 * The orbs are pure CSS (styles/backdrop.css). Only the cursor light needs JS,
 * and it does the minimum: no state, no re-renders, one transform written per
 * animation frame straight onto the node.
 */
const AnimatedBackdrop = () => {
  const glowRef = useRef(null);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow) return undefined;

    // A trailing light makes no sense without a pointer, and it is exactly the
    // kind of ambient motion "reduce motion" is asking us to drop.
    let wanted = true;
    try {
      wanted = window.matchMedia('(pointer: fine)').matches
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      wanted = false; // No matchMedia — assume the cheaper path
    }
    if (!wanted) return undefined;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    let live = false;

    const tick = () => {
      // Ease toward the cursor rather than tracking it exactly, so the light
      // lags a little and reads as something floating behind the glass.
      x += (targetX - x) * 0.08;
      y += (targetY - y) * 0.08;
      glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

      // Stop scheduling once it has effectively caught up; the next pointer
      // move restarts the loop. Idle tabs cost nothing.
      if (Math.abs(targetX - x) > 0.4 || Math.abs(targetY - y) > 0.4) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const onMove = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;

      if (!live) {
        // Jump to the first sample so the light fades in under the cursor
        // instead of flying in from the corner.
        live = true;
        x = targetX;
        y = targetY;
        glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        glow.classList.add('is-live');
      }

      if (!frame) frame = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="bg-fx" aria-hidden="true">
      <span className="bg-fx-orb bg-fx-orb-1" />
      <span className="bg-fx-orb bg-fx-orb-2" />
      <span className="bg-fx-orb bg-fx-orb-3" />
      <span className="bg-fx-glow" ref={glowRef} />
    </div>
  );
};

export default AnimatedBackdrop;
