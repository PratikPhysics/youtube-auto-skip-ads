// YouTube Auto Skip Ads - background service worker
// Created by Pratik Ramteke - https://pratikphysics.netlify.app/
//
// YouTube ignores clicks made by page scripts, so this sends a real ("trusted")
// mouse click through Chrome's debugger API, which the browser treats exactly
// like a click from your mouse.

const TAG = "[Auto Skip Ads]";

// Runs inside the page (via the debugger) to find the Skip button's centre
// AFTER the debugger is attached, so any layout shift from Chrome's
// "started debugging" bar is already accounted for.
const LOCATE_SKIP_BUTTON = `(() => {
  const sels = [
    ".ytp-skip-ad-button", ".ytp-ad-skip-button", ".ytp-ad-skip-button-modern",
    ".ytp-ad-skip-button-container button", "button[id^='skip-button']",
    "[class*='skip-ad-button']", "[class*='ad-skip-button']", ".videoAdUiSkipButton"
  ];
  const visible = (el) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0" && r.width > 0 && r.height > 0;
  };
  let btn = null;
  for (const sel of sels) {
    for (const el of document.querySelectorAll(sel)) { if (visible(el)) { btn = el; break; } }
    if (btn) break;
  }
  if (!btn) {
    for (const el of document.querySelectorAll(".video-ads button, .ytp-ad-module button, .video-ads [role='button']")) {
      if (/^skip/i.test((el.innerText || "").trim()) && visible(el)) { btn = el; break; }
    }
  }
  if (!btn) return null;
  btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  const r = btn.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(target, method, params) {
  return chrome.debugger.sendCommand(target, method, params);
}

let busy = false;

async function trustedSkip(tabId, fallbackX, fallbackY) {
  const target = { tabId };
  let attachedHere = false;

  try {
    await chrome.debugger.attach(target, "1.3");
    attachedHere = true;
  } catch (e) {
    // "Already attached" is fine; anything else is a real failure.
    if (!/already attached/i.test(String(e))) throw e;
  }

  try {
    // Give the "started debugging" bar a moment to appear and the page to re-layout.
    await sleep(250);

    let x = fallbackX, y = fallbackY;
    const res = await send(target, "Runtime.evaluate", { expression: LOCATE_SKIP_BUTTON, returnByValue: true });
    const pos = res?.result?.value;
    if (pos) { x = pos.x; y = pos.y; }
    else return { ok: false, error: "skip button gone before click" };

    const base = { x, y, button: "left", clickCount: 1, pointerType: "mouse" };
    await send(target, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y, pointerType: "mouse" });
    await sleep(30);
    await send(target, "Input.dispatchMouseEvent", { ...base, type: "mousePressed" });
    await sleep(30);
    await send(target, "Input.dispatchMouseEvent", { ...base, type: "mouseReleased" });
    await sleep(300);
    return { ok: true, x, y };
  } finally {
    if (attachedHere) {
      try { await chrome.debugger.detach(target); } catch (_) { /* ignore */ }
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "trustedClick" || !sender.tab?.id) return;

  if (busy) { sendResponse({ ok: false, error: "busy" }); return; }
  busy = true;

  trustedSkip(sender.tab.id, msg.x, msg.y)
    .then((res) => {
      console.log(TAG, "click result:", res);
      sendResponse(res);
    })
    .catch((e) => {
      console.warn(TAG, "click failed:", e);
      sendResponse({ ok: false, error: String(e) });
    })
    .finally(() => { busy = false; });

  return true; // keep the message channel open for the async response
});
