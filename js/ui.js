/* ══════════════════════════════════════
   ui.js — DOM references & UI helpers
   ══════════════════════════════════════ */

/* ── DOM Elements ── */
const DOM = {
  vid: document.getElementById("vid"),
  overlay: document.getElementById("overlay"),
  spinner: document.getElementById("spinner"),
  overlayMsg: document.getElementById("overlayMsg"),
  btnRetry: document.getElementById("btnRetry"),
  statusEl: document.getElementById("status"),
  statusTxt: document.getElementById("statusTxt"),
  qBtn: document.getElementById("qBtn"),
  qMenu: document.getElementById("qMenu"),
  qLabel: document.getElementById("qLabel"),
  qWrap: document.getElementById("qWrap"),
};

/* ── Status Badge ── */
function setStatus(cls, txt) {
  DOM.statusEl.className = "status " + cls;
  DOM.statusTxt.textContent = txt;
}

/* ── Overlay ── */
function showOverlay(html, retry = false) {
  DOM.overlay.classList.remove("gone");
  DOM.overlayMsg.innerHTML = html;
  DOM.spinner.style.display = retry ? "none" : "block";
  DOM.btnRetry.style.display = retry ? "block" : "none";
}

function hideOverlay() {
  DOM.overlay.classList.add("gone");
}

/* ── Token Timer ── */
const Timer = (() => {
  let expiry = 0;

  function start(exp) {
    expiry = exp;
  }

  function getExpiry() {
    return expiry;
  }

  function destroy() {}

  return { start, getExpiry, destroy };
})();
