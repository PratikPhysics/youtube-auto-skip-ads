# YouTube Auto Skip Ads

A small Chrome / Edge extension that clicks YouTube's **Skip** ad button automatically as soon as it appears.

Created by [Pratik Ramteke](https://pratikphysics.netlify.app/).

## Files

- `manifest.json` – tells the browser what the extension is and that it runs only on YouTube (Manifest V3 format).
- `content.js` – watches the YouTube page for the Skip button and finds where it is.
- `background.js` – performs the actual click as a real mouse click (via Chrome's debugger feature), so YouTube can't ignore it.

When it clicks, Chrome briefly shows a bar saying the extension "started debugging this browser". That's expected: it's how the real click is sent, and the bar goes away right after.

## Install (one time)

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Turn on **Developer mode** (top-right in Chrome, left sidebar in Edge).
3. Click **Load unpacked** and select this folder: `D:\skip-ads-automation`.
4. Open or refresh any YouTube tab.

## Check it's working

- Press `F12` on a YouTube page, open the **Console** tab, and look for `[Auto Skip Ads] Active on this page (v1.2).`
- During an ad you'll see `Ad detected.`, then `Skip button found`, then `Clicked skip button with a real click`.
- If you see `Ad is playing but no Skip button found yet`, it prints the buttons it can see; that list shows what YouTube currently calls the button.

## Notes

- Ads that can't be skipped have no Skip button, so they play as normal.
- After editing `content.js`, click the reload icon on the extension card in `chrome://extensions`, then refresh YouTube.
- If it stops working one day, YouTube has probably renamed the button. Right-click the Skip button, choose **Inspect**, and add its class name to `SKIP_SELECTORS` at the top of `content.js`.
