import React, { useEffect, useRef } from 'react';

/**
 * The animated page backdrop: drifting colour orbs, plus a light that trails
 * the cursor on desktop. Mounted once at the top of App — it is fixed to the
 * viewport and sits behind every route.
 *
 * The orbs are pure CSS (styles/backdrop.css), including the scroll-driven
 * parallax on mobile. JS only drives the two things a timeline cannot: the
 * cursor light, and pausing while the page is hidden.
 *
 * Touch devices deliberately get NO pointer-driven light. A cursor works as
 * ambient light because it is always on screen; a finger is not, so the same
 * effect becomes an artifact that flares under a thumb and lingers as it
 * fades. Phones get the orbs and the scroll parallax, which are continuous.
 */
const AnimatedBackdrop = () => {
  const rootRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    if (!root || !glow) return undefined;

    const query = (q) => {
      try {
        return window.matchMedia(q).matches;
      } catch {
        return false;
      }
    };

    // A fixed, promoted, infinitely animating layer will happily keep the
    // compositor awake behind another tab. Park it while hidden. This applies
    // on every device, so it is wired up before the pointer check bails out.
    const onVisibility = () => {
      root.classList.toggle('is-idle', document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', onVisibility);

    const teardownVisibility = () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };

    // Ambient motion that chases the user is exactly what "reduce motion" is
    // asking us to drop, and a coarse primary pointer means there is no cursor
    // to trail in the first place. Either way, no listeners get attached.
    if (query('(prefers-reduced-motion: reduce)') || query('(pointer: coarse)')) {
      return teardownVisibility;
    }

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

      // Stop scheduling once it has caught up; the next move restarts the
      // loop. An idle page costs nothing.
      if (Math.abs(targetX - x) > 0.4 || Math.abs(targetY - y) > 0.4) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const onPointerMove = (event) => {
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

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      teardownVisibility();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="bg-fx" aria-hidden="true" ref={rootRef}>
      <span className="bg-fx-orb bg-fx-orb-1" />
      <span className="bg-fx-orb bg-fx-orb-2" />
      <span className="bg-fx-orb bg-fx-orb-3" />
      <span className="bg-fx-glow" ref={glowRef} />
    </div>
  );
};

export default AnimatedBackdrop;
