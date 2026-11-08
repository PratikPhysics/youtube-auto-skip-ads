// YouTube Auto Skip Ads
// Created by Pratik Ramteke - https://pratikphysics.netlify.app/
//
// Watches the YouTube page for the "Skip" ad button and clicks it as soon as it appears.

(() => {
  "use strict";

  const TAG = "[Auto Skip Ads]";

  // Known class names YouTube has used for the skip button.
  // YouTube renames these from time to time, so we check several.
  const SKIP_SELECTORS = [
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-container button",
    "button[id^='skip-button']",
    "[class*='skip-ad-button']",
    "[class*='ad-skip-button']",
    ".videoAdUiSkipButton"
  ];

  // Containers where ad UI lives. Used for the text-based fallback search.
  const AD_CONTAINERS = ".video-ads, .ytp-ad-module, .ytp-ad-player-overlay, .ytp-ad-player-overlay-layout";

  let lastClick = 0;
  let skipCount = 0;
  let adWasShowing = false;
  let lastDiagnostic = 0;

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isAdShowing() {
    const player = document.querySelector("#movie_player, .html5-video-player");
    return !!(player && player.classList.contains("ad-showing"));
  }

  function findSkipButton() {
    // 1) Try known selectors.
    for (const sel of SKIP_SELECTORS) {
      for (const el of document.querySelectorAll(sel)) {
        if (isVisible(el)) return el;
      }
    }

    // 2) Fallback: any visible button inside the ad area whose text starts with "Skip".
    for (const c of document.querySelectorAll(AD_CONTAINERS)) {
      for (const btn of c.querySelectorAll("button, [role='button']")) {
        const text = (btn.innerText || btn.textContent || "").trim();
        if (/^skip/i.test(text) && isVisible(btn)) return btn;
      }
    }
    return null;
  }

  // Plain script click: used only if the trusted click is unavailable.
  function scriptClick(btn) {
    const rect = btn.getBoundingClientRect();
    const opts = {
      bubbles: true, cancelable: true, view: window,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2
    };
    try {
      btn.dispatchEvent(new PointerEvent("pointerdown", opts));
      btn.dispatchEvent(new MouseEvent("mousedown", opts));
      btn.dispatchEvent(new PointerEvent("pointerup", opts));
      btn.dispatchEvent(new MouseEvent("mouseup", opts));
    } catch (_) { /* ignore */ }
    btn.click();
  }

  // Ask the background worker for a real (trusted) mouse click at the button's centre.
  function trustedClick(btn) {
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "trustedClick", x, y }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { ok: false, error: "no response" });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });
  }

  // Lists buttons in the ad area so we can see what YouTube is calling them today.
  function logDiagnostics() {
    const found = [];
    for (const c of document.querySelectorAll(AD_CONTAINERS)) {
      for (const b of c.querySelectorAll("button, [role='button']")) {
        found.push({
          text: (b.innerText || "").trim().slice(0, 40),
          class: b.className,
          id: b.id,
          visible: isVisible(b)
        });
      }
    }
    console.log(`${TAG} Ad is playing but no Skip button found yet. Buttons in ad area:`, found);
  }

  async function trySkip() {
    const adShowing = isAdShowing();
    if (adShowing && !adWasShowing) console.log(`${TAG} Ad detected.`);
    if (!adShowing && adWasShowing) console.log(`${TAG} Ad finished.`);
    adWasShowing = adShowing;

    const now = Date.now();
    if (now - lastClick < 1500) return; // cooldown so we don't click repeatedly

    const btn = findSkipButton();
    if (!btn) {
      if (adShowing && now - lastDiagnostic > 3000) {
        lastDiagnostic = now;
        logDiagnostics();
      }
      return;
    }

    lastClick = now;
    console.log(`${TAG} Skip button found:`, btn.className || btn.id || btn.tagName);

    const res = await trustedClick(btn);
    if (res.ok) {
      skipCount++;
      console.log(`${TAG} Clicked skip button with a real click (total this tab: ${skipCount})`);
    } else if (res.error === "busy" || /gone before click/.test(res.error || "")) {
      // A click is already in progress, or the ad ended on its own. Nothing to do.
    } else {
      console.warn(`${TAG} Real click failed (${res.error}). Falling back to a script click.`);
      scriptClick(btn);
    }
  }

  // React instantly whenever the page changes (e.g. the skip button is added or un-hidden).
  const observer = new MutationObserver(() => { trySkip(); });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"]
  });

  // Backup check once a second, in case a change slips past the observer.
  setInterval(trySkip, 1000);

  console.log(`${TAG} Active on this page (v1.2).`);
})();
