function getKeyboardInset() {
  const viewport = window.visualViewport;
  return viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
}

function syncKeyboardInset() {
  document.documentElement.style.setProperty("--keyboard-inset", `${getKeyboardInset()}px`);
}

function keepFocusedFieldVisible() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement)) return;
  const viewport = window.visualViewport;
  const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  const overlap = activeElement.getBoundingClientRect().bottom - (visibleBottom - 16);
  if (overlap > 0) window.scrollBy({ top: overlap, behavior: "auto" });
}

export function installMobileViewportHandling() {
  const scheduleSync = () => {
    syncKeyboardInset();
    requestAnimationFrame(keepFocusedFieldVisible);
  };
  window.visualViewport?.addEventListener("resize", scheduleSync);
  window.visualViewport?.addEventListener("scroll", scheduleSync);
  window.addEventListener("orientationchange", scheduleSync);
  document.addEventListener("focusin", () => {
    scheduleSync();
    window.setTimeout(scheduleSync, 250);
    window.setTimeout(scheduleSync, 600);
  });
  window.addEventListener("pageshow", scheduleSync);
  syncKeyboardInset();
}
