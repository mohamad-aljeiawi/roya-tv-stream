/* ══════════════════════════════════════
   quality.js — Quality selector menu
   ══════════════════════════════════════ */

const Quality = (() => {
  let currentLevel = -1;

  function getCurrentLevel() {
    return currentLevel;
  }

  /* Build menu from HLS levels */
  function buildMenu(levels) {
    DOM.qMenu.innerHTML = '';
    _createOption(-1, 'تلقائي', '');

    [...levels].reverse().forEach((lvl, ri) => {
      const idx = levels.length - 1 - ri;
      const label = lvl.height ? lvl.height + 'p' : 'طبقة ' + idx;
      const bw    = lvl.bitrate ? Math.round(lvl.bitrate / 1000) + ' kbps' : '';
      _createOption(idx, label, bw);
    });

    _setActive(currentLevel);
  }

  /* Create a single option element */
  function _createOption(idx, label, bw) {
    const el = document.createElement('div');
    el.className = 'q-option';
    el.role = 'option';
    el.dataset.level = idx;
    el.innerHTML = `
      <svg class="q-check" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>${label}</span>
      ${bw ? `<span class="q-bw">${bw}</span>` : ''}`;
    el.addEventListener('click', () => apply(idx));
    DOM.qMenu.appendChild(el);
  }

  /* Highlight the active option */
  function _setActive(idx) {
    DOM.qMenu.querySelectorAll('.q-option').forEach(el => {
      const isActive = parseInt(el.dataset.level) === idx;
      el.classList.toggle('active', isActive);
      el.querySelector('.q-check').style.opacity = isActive ? '1' : '0';
    });
  }

  /* Apply a quality level */
  function apply(idx) {
    const hls = Player.getHls();
    if (!hls) return;

    currentLevel = idx;
    hls.currentLevel = idx;
    _setActive(idx);

    DOM.qLabel.textContent = idx === -1
      ? 'تلقائي'
      : (hls.levels[idx]?.height ? hls.levels[idx].height + 'p' : 'طبقة ' + idx);

    _closeMenu();
  }

  /* Update label when auto-switching */
  function onLevelSwitch(level, levels) {
    if (currentLevel === -1 && levels[level]) {
      const h = levels[level].height;
      DOM.qLabel.textContent = h ? `تلقائي (${h}p)` : 'تلقائي';
    }
  }

  /* Restore saved level after reconnect */
  function restore(hls, levels) {
    hls.currentLevel = currentLevel;
    DOM.qLabel.textContent = currentLevel === -1
      ? 'تلقائي'
      : (levels[currentLevel]?.height ? levels[currentLevel].height + 'p' : 'تلقائي');
  }

  /* ── Menu open/close ── */
  function _toggleMenu() {
    const open = DOM.qMenu.classList.toggle('open');
    DOM.qBtn.classList.toggle('open', open);
    DOM.qBtn.setAttribute('aria-expanded', open);
    if (open) {
      setTimeout(() => {
        document.addEventListener('click', _outsideClick, { capture: true, once: true });
      }, 10);
    }
  }

  function _closeMenu() {
    DOM.qMenu.classList.remove('open');
    DOM.qBtn.classList.remove('open');
    DOM.qBtn.setAttribute('aria-expanded', false);
  }

  function _outsideClick(e) {
    if (!DOM.qWrap.contains(e.target)) _closeMenu();
  }

  /* Bind button */
  DOM.qBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _toggleMenu();
  });

  return { getCurrentLevel, buildMenu, apply, onLevelSwitch, restore };
})();
