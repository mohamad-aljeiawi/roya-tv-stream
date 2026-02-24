/* ══════════════════════════════════════
   controls.js — Custom HLS Player Controls
   ══════════════════════════════════════ */

const Controls = (() => {
  let videoEl = null;
  let hlsInstance = null;

  // Custom DOM items
  const UI = {
    wrap: document.querySelector(".player-wrap"),
    controls: document.getElementById("playerControls"),
    interaction: document.getElementById("interactionArea"),
    ripple: document.getElementById("interactionRipple"),
    inlineError: document.getElementById("inlineError"),
    inlineSpinner: document.getElementById("inlineSpinner"),
    speedToast: document.getElementById("speedToast"),
    btnRetry: document.getElementById("inlineRetryBtn"),
    playPauseBtn: document.getElementById("btnPlayPause"),
    iconPlay: document.querySelector(".icon-play"),
    iconPause: document.querySelector(".icon-pause"),
    btnMute: document.getElementById("btnMute"),
    iconVol: document.querySelector(".icon-vol"),
    iconMuted: document.querySelector(".icon-muted"),
    volSliderWrap: document.querySelector(".volume-slider-wrap"),
    volSlider: document.getElementById("volumeSlider"),
    btnLive: document.getElementById("btnLive"),
    timeDisplay: document.getElementById("timeDisplay"),
    btnPip: document.getElementById("btnPip"),
    btnFullscreen: document.getElementById("btnFullscreen"),
    iconFsEnter: document.querySelector(".icon-fs-enter"),
    iconFsExit: document.querySelector(".icon-fs-exit"),
    progressArea: document.getElementById("progressArea"),
    progressFill: document.getElementById("progressFill"),
    progressTooltip: document.getElementById("progressTooltip"),
    ariaLive: document.getElementById("ariaLive"),
  };

  let autohideTmr = null;
  let rafId = null;

  // Touch gesture state
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let activeGesture = null;
  let initialVolume = 1;
  let lastTapTime = 0;
  let lastTapTarget = null;
  let longPressTmr = null;

  /* ── Initialization ── */
  function init(vid, hls) {
    videoEl = vid;
    hlsInstance = hls;

    _bindEvents();
    _checkPipSupport();
    _restoreVolume();

    // Start RAF loop for UI updates
    if (rafId) cancelAnimationFrame(rafId);
    _updateLoop();
  }

  /* ── Public API ── */
  function show() {
    UI.controls.classList.remove("hidden");
    UI.wrap.classList.remove("hide-cursor");
    _autohide();
  }

  function hide() {
    if (videoEl && !videoEl.paused) {
      UI.controls.classList.add("hidden");
      if (_isFullscreen()) {
        UI.wrap.classList.add("hide-cursor");
      }
    }
  }

  function showError(msgStr) {
    UI.inlineError.style.display = "flex";
    UI.inlineError.querySelector("span").innerHTML = msgStr;
    UI.inlineSpinner.style.display = "none";
    hide();
  }

  function hideError() {
    UI.inlineError.style.display = "none";
  }

  function updateQuality(levels, currentLevel) {
    // Quality.js handles the DOM inside qMenu/qBtn, but we can call Quality.buildMenu again if needed.
    // The legacy Quality module handles this.
  }

  /* ── Event Binding ── */
  function _bindEvents() {
    // Video Events
    videoEl.addEventListener("play", () => {
      UI.iconPlay.classList.add("icon-hidden");
      UI.iconPause.classList.remove("icon-hidden");
      UI.inlineSpinner.style.display = "none";
      _autohide();
      _announce("تم التشغيل");
    });

    videoEl.addEventListener("pause", () => {
      UI.iconPlay.classList.remove("icon-hidden");
      UI.iconPause.classList.add("icon-hidden");
      show();
      _announce("تم الإيقاف");
    });

    videoEl.addEventListener("waiting", () => {
      UI.inlineSpinner.style.display = "flex";
    });

    videoEl.addEventListener("playing", () => {
      UI.inlineSpinner.style.display = "none";
    });

    videoEl.addEventListener("volumechange", _updateVolumeUI);

    // Controls Events
    UI.playPauseBtn.addEventListener("click", _togglePlay);
    UI.btnMute.addEventListener("click", _toggleMute);
    UI.volSlider.addEventListener("input", (e) => {
      videoEl.volume = e.target.value;
      videoEl.muted = e.target.value == 0;
      _saveVolume();
    });

    UI.btnLive.addEventListener("click", _syncLive);
    UI.btnPip.addEventListener("click", _togglePip);
    UI.btnFullscreen.addEventListener("click", _toggleFullscreen);
    UI.btnRetry?.addEventListener("click", () => {
      hideError();
      Player.load(false, 0); // Restart stream
    });

    // Auto-hide on interaction
    UI.wrap.addEventListener("mousemove", _onMouseMove);
    UI.wrap.addEventListener("mouseleave", hide);
    UI.controls.addEventListener("mouseenter", show);

    // Progress Hover Tooltip
    UI.progressArea.addEventListener("mousemove", _onProgressHover);
    UI.progressArea.addEventListener("mouseleave", () => {
      UI.progressTooltip.style.opacity = "0";
    });

    // Progress Click & Drag Seeking
    UI.progressArea.addEventListener("click", _onProgressClick);
    let isDragging = false;
    UI.progressArea.addEventListener("mousedown", () => (isDragging = true));
    document.addEventListener("mouseup", () => (isDragging = false));
    UI.progressArea.addEventListener("mousemove", (e) => {
      if (isDragging) _onProgressClick(e);
    });

    // Touch & Swipe gestures
    UI.interaction.addEventListener("touchstart", _handleTouchStart, {
      passive: false,
    });
    UI.interaction.addEventListener("touchmove", _handleTouchMove, {
      passive: false,
    });
    UI.interaction.addEventListener("touchend", _handleTouchEnd);
    UI.interaction.addEventListener("click", _handleTap); // desktop click

    // Keyboard Shortcuts
    document.addEventListener("keydown", _handleKeydown);

    // Fullscreen changes
    document.addEventListener("fullscreenchange", _updateFsUI);
    document.addEventListener("webkitfullscreenchange", _updateFsUI);
  }

  /* ── Interaction Logic ── */
  let mouseMoveTmr;
  function _onMouseMove() {
    clearTimeout(mouseMoveTmr);
    show(); // Request show immediately
    mouseMoveTmr = setTimeout(() => {
      // Debounce wrapper just for performance edge cases, _autohide handles the 3s rule.
    }, 100);
  }

  function _autohide() {
    clearTimeout(autohideTmr);
    if (!videoEl || videoEl.paused) return;

    autohideTmr = setTimeout(() => {
      const qMenuOpen = document
        .getElementById("qMenu")
        .classList.contains("open");
      if (!qMenuOpen && !UI.controls.matches(":hover")) {
        hide();
      } else {
        _autohide(); // retry later
      }
    }, 3000);
  }

  function _togglePlay() {
    if (videoEl.paused) {
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
    }
  }

  function _toggleMute() {
    videoEl.muted = !videoEl.muted;
    if (!videoEl.muted && videoEl.volume === 0) videoEl.volume = 0.5;
    _saveVolume();
  }

  function _updateVolumeUI() {
    const isMuted = videoEl.muted || videoEl.volume === 0;

    if (isMuted) {
      UI.iconVol.classList.add("icon-hidden");
      UI.iconMuted.classList.remove("icon-hidden");
    } else {
      UI.iconVol.classList.remove("icon-hidden");
      UI.iconMuted.classList.add("icon-hidden");
    }

    const sliderVal = isMuted ? 0 : videoEl.volume;
    UI.volSlider.value = sliderVal;
    UI.volSlider.style.setProperty("--value", `${sliderVal * 100}%`);

    // Announce
    _announce(
      isMuted
        ? "تم كتم الصوت"
        : `مستوى الصوت ${Math.round(videoEl.volume * 100)}%`,
    );
  }

  function _saveVolume() {
    localStorage.setItem("roya_volume", videoEl.volume);
    localStorage.setItem("roya_muted", videoEl.muted);
  }

  function _restoreVolume() {
    const vol = localStorage.getItem("roya_volume");
    if (vol !== null) videoEl.volume = parseFloat(vol);
    // Always start unmuted. If the browser blocks unmuted autoplay, player.js
    // .catch() will set muted=true as a fallback, and _autoUnmuteOnInteract
    // will restore audio on the very first user interaction.
    videoEl.muted = false;
    _updateVolumeUI();
  }

  function _syncLive() {
    if (hlsInstance && hlsInstance.liveSyncPosition) {
      videoEl.currentTime = hlsInstance.liveSyncPosition;
      videoEl.play().catch(() => {});
    }
  }

  function _getTimeAtRatio(ratio) {
    if (!videoEl) return 0;

    // Check if it's a sliding window
    if (videoEl.seekable && videoEl.seekable.length > 0) {
      let start = videoEl.seekable.start(0);
      const end = videoEl.seekable.end(videoEl.seekable.length - 1);

      const liveEdge =
        hlsInstance && hlsInstance.liveSyncPosition
          ? hlsInstance.liveSyncPosition
          : end;

      // Limit the visual timeline and seeking window to a maximum of 40 seconds ago.
      start = Math.max(start, liveEdge - 40);

      if (liveEdge - start > 0) {
        return start + (liveEdge - start) * ratio;
      }
    }

    // Fallback
    const duration =
      videoEl.duration && isFinite(videoEl.duration) ? videoEl.duration : 0;
    return duration * ratio;
  }

  function _onProgressClick(e) {
    if (!videoEl) return;
    const rect = UI.progressArea.getBoundingClientRect();
    let ratio = (e.clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));
    videoEl.currentTime = _getTimeAtRatio(ratio);
  }

  function _onProgressHover(e) {
    const rect = UI.progressArea.getBoundingClientRect();
    let ratio = (e.clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));

    const targetTime = _getTimeAtRatio(ratio);

    const liveEdge =
      hlsInstance && hlsInstance.liveSyncPosition
        ? hlsInstance.liveSyncPosition
        : 0;
    if (liveEdge > 0 && liveEdge - targetTime > 0) {
      const diff = liveEdge - targetTime;
      if (diff < 4) {
        UI.progressTooltip.textContent = "مباشر";
      } else {
        const m = Math.floor(diff / 60);
        const s = Math.floor(diff % 60)
          .toString()
          .padStart(2, "0");
        UI.progressTooltip.textContent = `-${m}:${s}`;
      }
    } else {
      const targetDisplay = Math.max(0, targetTime);
      const m = Math.floor(targetDisplay / 60);
      const s = Math.floor(targetDisplay % 60)
        .toString()
        .padStart(2, "0");
      UI.progressTooltip.textContent = `${m}:${s}`;
    }

    UI.progressTooltip.style.opacity = "1";
    // Position tooltip
    UI.progressTooltip.style.left = `${e.clientX - rect.left}px`;
    UI.progressTooltip.style.right = "auto";
  }

  /* ── Time & Sync Update Loop ── */
  function _updateLoop() {
    if (!videoEl) return;

    let edge =
      hlsInstance && hlsInstance.liveSyncPosition
        ? hlsInstance.liveSyncPosition
        : null;
    let start = 0;
    const curr = videoEl.currentTime;

    if (videoEl.seekable && videoEl.seekable.length > 0) {
      start = videoEl.seekable.start(0);
      if (!edge) edge = videoEl.seekable.end(videoEl.seekable.length - 1);
      start = Math.max(start, edge - 40);
    }

    if (edge !== null && curr !== null && !isNaN(edge) && !isNaN(curr)) {
      const diff = Math.max(0, edge - curr);

      if (diff < 4) {
        UI.btnLive.classList.add("active");
        UI.timeDisplay.style.display = "none"; // Hide redundant text when live
        UI.progressFill.style.width = "100%";
      } else {
        UI.btnLive.classList.remove("active");
        UI.timeDisplay.style.display = "block"; // Show time remainder when behind
        const m = Math.floor(diff / 60);
        const s = Math.floor(diff % 60)
          .toString()
          .padStart(2, "0");

        UI.timeDisplay.textContent = `-${m}:${s}`;

        const windowSize = edge - start;
        if (windowSize > 0) {
          const pct = Math.max(0, 100 - (diff / windowSize) * 100);
          UI.progressFill.style.width = `${pct}%`;
        } else {
          UI.progressFill.style.width = "100%";
        }
      }
    }

    rafId = requestAnimationFrame(_updateLoop);
  }

  /* ── Fullscreen ── */
  function _isFullscreen() {
    return document.fullscreenElement || document.webkitFullscreenElement;
  }

  function _toggleFullscreen() {
    if (_isFullscreen()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();

      // Unlock orientation
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } else {
      const el = UI.wrap;
      if (el.requestFullscreen) {
        el.requestFullscreen()
          .then(() => {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock("landscape").catch(() => {});
            }
          })
          .catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock("landscape").catch(() => {});
        }
      } else if (videoEl.webkitEnterFullscreen) {
        // iOS Fallback
        videoEl.webkitEnterFullscreen();
      }
    }
  }

  function _updateFsUI() {
    if (_isFullscreen()) {
      UI.iconFsEnter.classList.add("icon-hidden");
      UI.iconFsExit.classList.remove("icon-hidden");
      _announce("تم الدخول لملء الشاشة");
    } else {
      UI.iconFsEnter.classList.remove("icon-hidden");
      UI.iconFsExit.classList.add("icon-hidden");
      UI.wrap.classList.remove("hide-cursor");
      _announce("تم الخروج من ملء الشاشة");
    }
  }

  /* ── PiP ── */
  function _checkPipSupport() {
    if (document.pictureInPictureEnabled) {
      UI.btnPip.style.display = "flex";
      videoEl.addEventListener("enterpictureinpicture", () =>
        _announce("صورة داخل صورة مفعل"),
      );
      videoEl.addEventListener("leavepictureinpicture", () =>
        _announce("صورة داخل صورة معطل"),
      );
    }
  }

  function _togglePip() {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      videoEl.requestPictureInPicture().catch(() => {});
    }
  }

  /* ── Keyboard Shortcuts ── */
  function _handleKeydown(e) {
    if (document.activeElement.tagName === "INPUT") return;

    switch (e.key.toLowerCase()) {
      case " ":
      case "k":
        e.preventDefault();
        _togglePlay();
        show();
        break;
      case "m":
        e.preventDefault();
        _toggleMute();
        show();
        break;
      case "f":
        e.preventDefault();
        _toggleFullscreen();
        break;
      case "arrowup":
        e.preventDefault();
        videoEl.volume = Math.min(1, videoEl.volume + 0.05);
        videoEl.muted = false;
        _saveVolume();
        show();
        break;
      case "arrowdown":
        e.preventDefault();
        videoEl.volume = Math.max(0, videoEl.volume - 0.05);
        if (videoEl.volume === 0) videoEl.muted = true;
        _saveVolume();
        show();
        break;
      case "escape":
        if (_isFullscreen()) _toggleFullscreen();
        break;
    }
  }

  /* ── Touch & Mobile Gestures ── */
  function _handleTap(e) {
    show();
    if (e.pointerType === "mouse") return; // pure touch handling below
  }

  function _handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    activeGesture = null;
    initialVolume = videoEl.volume;

    // Double tap?
    if (touchStartTime - lastTapTime < 300) {
      e.preventDefault();
      const rect = UI.interaction.getBoundingClientRect();
      const isLeft = touchStartX < rect.left + rect.width / 2;

      // Perform seek
      if (isLeft) {
        // RTL logic: visually right for Arabic user, but technically screen X coords
        _triggerRipple("left");

        const edge =
          hlsInstance && hlsInstance.liveSyncPosition
            ? hlsInstance.liveSyncPosition
            : videoEl.duration || 0;
        const limit = Math.max(0, edge - 40);
        videoEl.currentTime = Math.max(limit, videoEl.currentTime - 10);
      } else {
        _triggerRipple("right");
        // Live stream bounding checks automatically restrict
        videoEl.currentTime += 10;
      }
      return;
    }

    // Long press?
    longPressTmr = setTimeout(() => {
      _cycleSpeed();
      activeGesture = "ignored";
    }, 600);

    lastTapTime = touchStartTime;
  }

  function _handleTouchMove(e) {
    if (!activeGesture && activeGesture !== null) return;
    if (activeGesture === "ignored") {
      e.preventDefault();
      return;
    }

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Detect intent
    if (activeGesture === null) {
      if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
        activeGesture = "volume";
        clearTimeout(longPressTmr);
      } else if (Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
        activeGesture = "seek";
        clearTimeout(longPressTmr);
      }
    }

    if (activeGesture) e.preventDefault();

    if (activeGesture === "volume") {
      const delta = -(dy / 200); // swipe up increases
      videoEl.volume = Math.max(0, Math.min(1, initialVolume + delta));
      if (videoEl.volume > 0) videoEl.muted = false;
      _updateVolumeUI();
      UI.volSliderWrap.classList.add("active-touch");
    } else if (activeGesture === "seek") {
      // Small scrub
    }
  }

  function _handleTouchEnd(e) {
    clearTimeout(longPressTmr);
    if (!activeGesture) {
      // It was a single tap, toggle controls
      if (UI.controls.classList.contains("hidden")) show();
      else hide();
    }

    UI.volSliderWrap.classList.remove("active-touch");
    if (activeGesture === "volume") _saveVolume();
  }

  function _triggerRipple(side) {
    UI.ripple.className = "interaction-ripple active-" + side;
    setTimeout(() => {
      UI.ripple.className = "interaction-ripple";
    }, 400);
  }

  const speeds = [1, 1.25, 1.5, 2];
  function _cycleSpeed() {
    const curIndex = speeds.indexOf(videoEl.playbackRate);
    const nextSpeed = speeds[(curIndex + 1) % speeds.length];
    videoEl.playbackRate = nextSpeed;

    UI.speedToast.textContent = nextSpeed + "x";
    UI.speedToast.style.display = "block";
    UI.speedToast.style.opacity = "1";

    setTimeout(() => {
      UI.speedToast.style.opacity = "0";
      setTimeout(() => (UI.speedToast.style.display = "none"), 300);
    }, 1500);

    _announce(`سرعة التشغيل ${nextSpeed}`);
  }

  /* ── Accessibility ── */

  function _announce(msg) {
    if (UI.ariaLive) {
      UI.ariaLive.textContent = "";
      setTimeout(() => {
        UI.ariaLive.textContent = msg;
      }, 50);
    }
  }

  return {
    init,
    show,
    hide,
    showError,
    hideError,
    updateQuality,
  };
})();
