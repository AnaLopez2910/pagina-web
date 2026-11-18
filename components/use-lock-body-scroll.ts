"use client";

import { useEffect } from "react";

const lockCountKey = "scrollLockCount";
const scrollYKey = "scrollLockY";
const previousOverflowKey = "scrollLockPreviousOverflow";
const previousPositionKey = "scrollLockPreviousPosition";
const previousTopKey = "scrollLockPreviousTop";
const previousWidthKey = "scrollLockPreviousWidth";

function emitLockChange(isLocked: boolean) {
  window.dispatchEvent(new CustomEvent("body-scroll-lock-change", { detail: { isLocked } }));
}

export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const body = document.body;
    const currentCount = Number(body.dataset[lockCountKey] ?? "0");

    if (currentCount === 0) {
      // Read before fixing the body: once it is fixed, window.scrollY drops to 0.
      const scrollY = window.scrollY;
      body.dataset[scrollYKey] = String(scrollY);
      body.dataset[previousOverflowKey] = body.style.overflow;
      body.dataset[previousPositionKey] = body.style.position;
      body.dataset[previousTopKey] = body.style.top;
      body.dataset[previousWidthKey] = body.style.width;

      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      emitLockChange(true);
    }

    body.dataset[lockCountKey] = String(currentCount + 1);

    return () => {
      const latestCount = Number(body.dataset[lockCountKey] ?? "1");
      const nextCount = Math.max(0, latestCount - 1);

      if (nextCount > 0) {
        body.dataset[lockCountKey] = String(nextCount);
        return;
      }

      const scrollY = Number(body.dataset[scrollYKey] ?? "0");

      body.style.overflow = body.dataset[previousOverflowKey] ?? "";
      body.style.position = body.dataset[previousPositionKey] ?? "";
      body.style.top = body.dataset[previousTopKey] ?? "";
      body.style.width = body.dataset[previousWidthKey] ?? "";

      delete body.dataset[lockCountKey];
      delete body.dataset[scrollYKey];
      delete body.dataset[previousOverflowKey];
      delete body.dataset[previousPositionKey];
      delete body.dataset[previousTopKey];
      delete body.dataset[previousWidthKey];

      window.scrollTo(0, scrollY);
      emitLockChange(false);
    };
  }, [active]);
}
