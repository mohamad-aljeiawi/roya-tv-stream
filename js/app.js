/* ══════════════════════════════════════
   app.js — Entry point & global events
   ══════════════════════════════════════ */

/* ── Retry button ── */
DOM.btnRetry.addEventListener('click', () => Player.load(false, 0));

/* ── Page visibility: resume when user comes back ── */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;

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

/* ── Boot ── */
Player.load();
