"use client";

import { useEffect, useState } from "react";

export interface Viewport {
  width: number;
  height: number;
  isMobile: boolean; // < 768
  isTablet: boolean; // 768..1023
  isDesktop: boolean; // >= 1024
  isLandscape: boolean;
  isPortrait: boolean;
  devicePixelRatio: number;
  hasTouch: boolean;
}

const SSR_VIEWPORT: Viewport = {
  width: 1280,
  height: 720,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isLandscape: true,
  isPortrait: false,
  devicePixelRatio: 1,
  hasTouch: false,
};

/** Reactive viewport descriptor with breakpoint flags. */
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(SSR_VIEWPORT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = (): Viewport => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      return {
        width: w,
        height: h,
        isMobile: w < 768,
        isTablet: w >= 768 && w < 1024,
        isDesktop: w >= 1024,
        isLandscape: w >= h,
        isPortrait: w < h,
        devicePixelRatio: window.devicePixelRatio || 1,
        hasTouch:
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.matchMedia("(pointer: coarse)").matches,
      };
    };
    // Schedule the initial computation in a microtask so we don't trigger
    // a cascading render synchronously inside the effect body.
    let raf = 0;
    const schedule = (fn: () => Viewport) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setVp(fn()));
    };
    schedule(compute);
    const onResize = () => schedule(compute);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return vp;
}

/**
 * Pick a sensible default bytes-per-row based on viewport width.
 * Keeps the hex view readable without horizontal scroll on small screens.
 */
export function autoBytesPerRow(width: number, fontScale: "xs" | "sm" | "md" | "lg"): number {
  // Approximate character width per layout scale (in CSS pixels).
  const charWidth = fontScale === "xs" ? 6 : fontScale === "sm" ? 7 : fontScale === "lg" ? 10 : 8;
  // Layout overhead: offset column ~10 chars + 2 spaces, ascii column = bytesPerRow, hex column = bytesPerRow * 3 - 1
  // Solve: 10*charW + 4 + bytesPerRow*3*charW + 8 + bytesPerRow*charW < width * 0.95
  // => bytesPerRow * 4 * charW < width * 0.95 - 10*charW - 12
  const usable = width * 0.92 - 10 * charWidth - 16;
  const perByte = 4 * charWidth;
  let bpr = Math.floor(usable / perByte);
  // Round down to nearest of [4, 8, 12, 16, 24, 32, 48, 64]
  const steps = [4, 8, 12, 16, 24, 32, 48, 64];
  let chosen = 4;
  for (const s of steps) {
    if (bpr >= s) chosen = s;
  }
  return Math.max(4, Math.min(64, chosen));
}
