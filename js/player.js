/* ══════════════════════════════════════
   player.js — Stream loader & HLS engine
   ══════════════════════════════════════ */

const Player = (() => {
  let hls = null;
  let renewTmr = null;
  let retryTmr = null;

  function getHls() {
    return hls;
  }

  /* ── Fetch stream URL from proxy ── */
  async function _fetchUrl() {
    const res = await fetch(CONFIG.PROXY_URL + "?_=" + Date.now(), {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("proxy_" + res.status);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    const url = json?.data?.secured_url;
    if (!url) throw new Error("no_url");
    return url;
  }

  /* ── Destroy HLS instance ── */
  function _destroyHls() {
    if (hls) {
      try {
        hls.destroy();
      } catch (_) {}
      hls = null;
    }
  }

  /* ── Schedule auto-renew before token expires ── */
  function _scheduleRenew(exp) {
    clearTimeout(renewTmr);
    const ms = Math.max(
      8000,
      (exp - CONFIG.RENEW_BEFORE - Math.floor(Date.now() / 1000)) * 1000,
    );
    renewTmr = setTimeout(() => load(true), ms);
  }

  /* ── Calculate retry delay with exponential backoff ── */
  function _retryDelay(attempt) {
    return Math.min(20000, 2000 * Math.pow(1.5, attempt));
  }

  /* ── Setup HLS.js (Chrome, Firefox, Android) ── */
  function _setupHlsJs(url, attempt) {
    hls = new Hls(CONFIG.HLS);
    hls.loadSource(url);
    hls.attachMedia(DOM.vid);

    Controls.init(DOM.vid, hls);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      hideOverlay();
      setStatus("live", "بث رؤيا المباشر");
      Quality.buildMenu(data.levels);
      Quality.restore(hls, data.levels);
      _promptPlay();
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => {
      Quality.onLevelSwitch(level, hls.levels);
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;
      _destroyHls();
      retryTmr = setTimeout(
        () => load(true, attempt + 1),
        _retryDelay(attempt),
      );
    });
  }

  /* ── Setup native HLS (Safari, iOS) ── */
  function _setupNative(url, attempt) {
    DOM.vid.src = url;
    DOM.vid.load();

    Controls.init(DOM.vid, null);

    DOM.vid.addEventListener(
      "canplay",
      () => {
        hideOverlay();
        setStatus("live", "بث رؤيا المباشر");
        DOM.qLabel.textContent = "تلقائي";
        _promptPlay();
      },
      { once: true },
    );

    DOM.vid.addEventListener(
      "error",
      () => {
        retryTmr = setTimeout(
          () => load(true, attempt + 1),
          _retryDelay(attempt),
        );
      },
      { once: true },
    );
  }

  /* ── Try unmuted play; if blocked, show play overlay ── */
  function _promptPlay() {
    DOM.vid.muted = false;
    const p = DOM.vid.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err.name === "NotAllowedError") {
          // Browser blocked unmuted autoplay — show a play button so the
          // user's tap provides the required gesture for unmuted audio.
          _showPlayOverlay();
        }
      });
    }
  }

  function _showPlayOverlay() {
    const overlay = document.getElementById("playOverlay");
    const btn = document.getElementById("playOverlayBtn");
    overlay.style.display = "flex";

    function _start() {
      overlay.style.display = "none";
      DOM.vid.muted = false;
      DOM.vid.play().catch(() => {});
      btn.removeEventListener("click", _start);
      overlay.removeEventListener("click", _start);
    }
    btn.addEventListener("click", _start);
    overlay.addEventListener("click", _start);
  }

  /* ── Main load function ── */
  async function load(silent = false, attempt = 0) {
    clearTimeout(retryTmr);

    if (!silent) {
      setStatus("load", "جاري التحميل...");
      showOverlay("جاري تحميل البث...");
    }

    // Fetch URL
    let url;
    try {
      url = await _fetchUrl();
    } catch (err) {
      if (attempt < CONFIG.MAX_RETRY) {
        setStatus(
          "load",
          `إعادة المحاولة ${attempt + 1}/${CONFIG.MAX_RETRY}...`,
        );
        showOverlay("جاري إعادة الاتصال...");
        retryTmr = setTimeout(
          () => load(true, attempt + 1),
          _retryDelay(attempt),
        );
      } else {
        setStatus("error", "تعذر الاتصال");
        Controls.showError(
          "<strong>تعذر تحميل البث</strong><br>تحقق من اتصالك بالإنترنت",
        );
      }
      return;
    }

    // Parse token expiry
    const expMatch = url.match(/[?&]e=(\d+)/);
    const exp = expMatch ? parseInt(expMatch[1]) : 0;

    // Setup player
    _destroyHls();

    if (Hls.isSupported()) {
      _setupHlsJs(url, attempt);
    } else if (DOM.vid.canPlayType("application/vnd.apple.mpegurl")) {
      _setupNative(url, attempt);
    } else {
      Controls.showError(
        "<strong>المتصفح غير مدعوم</strong><br>استخدم Chrome أو Safari",
      );
      setStatus("error", "غير مدعوم");
      return;
    }

    // Start timer & schedule renew
    if (exp) {
      Timer.start(exp);
      _scheduleRenew(exp);
    }
  }

  /* ── Cleanup ── */
  function destroy() {
    clearTimeout(renewTmr);
    clearTimeout(retryTmr);
    Timer.destroy();
    _destroyHls();
  }

  return { getHls, load, destroy };
})();
