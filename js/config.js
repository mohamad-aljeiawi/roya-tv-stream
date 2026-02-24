/* ══════════════════════════════════════
   config.js — All app constants
   ══════════════════════════════════════ */

const CONFIG = {
  // Supabase Edge Function endpoint
  PROXY_URL:
    "https://ibirujhtigdwqxezcfyi.supabase.co/functions/v1/roya-tv-stream",

  // Renew token this many seconds before expiry
  RENEW_BEFORE: 240,

  // Max retry attempts before showing error
  MAX_RETRY: 6,

  // Default assumed token duration (seconds)
  DEFAULT_TOKEN_DURATION: 7200,

  // HLS.js configuration
  HLS: {
    startLevel: -1,
    autoStartLoad: true,
    manifestLoadingMaxRetry: 4,
    levelLoadingMaxRetry: 4,
    fragLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 600,
    levelLoadingRetryDelay: 600,
    fragLoadingRetryDelay: 600,
    enableWorker: true,
    lowLatencyMode: false,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 10,
    maxLiveSyncPlaybackRate: 1.5,
  },
};
