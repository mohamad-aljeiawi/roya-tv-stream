/* ══════════════════════════════════════
   app.js — Entry point & global events
   ══════════════════════════════════════ */

/* ── Retry button ── */
DOM.btnRetry.addEventListener("click", () => Player.load(false, 0));

/* ── Page visibility: resume when user comes back ── */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!_streamStarted) return; // stream not yet initiated by user

  const now = Math.floor(Date.now() / 1000);
  const exp = Timer.getExpiry();

  // Token about to expire → full reload
  if (exp && exp - now < 60) {
    Player.load(false, 0);
    return;
  }

  // Just paused → resume playback
  const hls = Player.getHls();
  if (hls && DOM.vid.paused) {
    DOM.vid.play().catch(() => {});
  }
});

/* ── Boot: show play overlay; defer stream until user taps ── */
let _streamStarted = false;

document.body.classList.add("pre-stream");

function _startStream() {
  if (_streamStarted) return;
  _streamStarted = true;
  document.body.classList.remove("pre-stream");
  document.getElementById("playOverlay").style.display = "none";
  Player.load();
}

document
  .getElementById("playOverlayBtn")
  .addEventListener("click", _startStream);
document.getElementById("playOverlay").addEventListener("click", _startStream);
