/* ══════════════════════════════════════
   ui.js — DOM references & UI helpers
   ══════════════════════════════════════ */

/* ── DOM Elements ── */
const DOM = {
  vid:        document.getElementById('vid'),
  overlay:    document.getElementById('overlay'),
  spinner:    document.getElementById('spinner'),
  overlayMsg: document.getElementById('overlayMsg'),
  btnRetry:   document.getElementById('btnRetry'),
  statusEl:   document.getElementById('status'),
  statusTxt:  document.getElementById('statusTxt'),
  timerFill:  document.getElementById('timerFill'),
  timerLabel: document.getElementById('timerLabel'),
  qBtn:       document.getElementById('qBtn'),
  qMenu:      document.getElementById('qMenu'),
  qLabel:     document.getElementById('qLabel'),
  qWrap:      document.getElementById('qWrap'),
};

/* ── Status Badge ── */
function setStatus(cls, txt) {
  DOM.statusEl.className = 'status ' + cls;
  DOM.statusTxt.textContent = txt;
}

/* ── Overlay ── */
function showOverlay(html, retry = false) {
  DOM.overlay.classList.remove('gone');
  DOM.overlayMsg.innerHTML = html;
  DOM.spinner.style.display  = retry ? 'none'  : 'block';
  DOM.btnRetry.style.display = retry ? 'block' : 'none';
}

function hideOverlay() {
  DOM.overlay.classList.add('gone');
}

/* ── Token Timer ── */
const Timer = (() => {
  let expiry   = 0;
  let duration = CONFIG.DEFAULT_TOKEN_DURATION;
  let interval = null;

  function start(exp) {
    expiry   = exp;
    duration = exp - Math.floor(Date.now() / 1000);
    clearInterval(interval);

    interval = setInterval(() => {
      const left = expiry - Math.floor(Date.now() / 1000);

      if (left <= 0) {
        DOM.timerLabel.textContent = 'منتهي';
        DOM.timerFill.style.cssText = 'width:0%;background:#ff5050';
        clearInterval(interval);
        return;
      }

      const m = Math.floor(left / 60);
      const s = String(left % 60).padStart(2, '0');
      DOM.timerLabel.textContent = `${m}:${s}`;

      const pct = Math.max(0, (left / duration) * 100);
      DOM.timerFill.style.width = pct + '%';
      DOM.timerFill.style.background =
        pct > 40 ? 'var(--red)' : pct > 15 ? '#ffaa00' : '#ff5050';
    }, 1000);
  }

  function getExpiry() {
    return expiry;
  }

  function destroy() {
    clearInterval(interval);
  }

  return { start, getExpiry, destroy };
})();
