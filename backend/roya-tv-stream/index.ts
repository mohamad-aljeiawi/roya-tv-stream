/**
 * Roya TV Stream Proxy — Supabase Edge Function
 * With Upstash Redis for shared cache across all isolates
 *
 * Environment Variables needed in Supabase Dashboard:
 *   UPSTASH_REDIS_REST_URL    → https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  → AXxxxxxxxxxxxx
 */

// ─── Config ───────────────────────────────────────────────────
const API = "https://ticket.roya-tv.com/api/v5/fastchannel/1?device_type=1";
const HEADERS = {
  accept: "application/json, */*",
  origin: "https://roya.tv",
  referer: "https://roya.tv/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

const CACHE_KEY = "roya:stream:v1";
const MIN_TTL = 600; // 10 min — don't serve tokens expiring sooner
const MAX_RETRY = 5;
const LOCK_KEY = "roya:stream:lock";
const LOCK_TTL = 15; // seconds — max time one instance holds the fetch lock

// ─── Upstash Redis (REST API — no SDK needed) ────────────────
const REDIS_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")!;
const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!;

async function redis(
  command: string[],
): Promise<{ result: unknown; error?: string }> {
  const res = await fetch(`${REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  return res.json();
}

// Convenience wrappers
async function redisGet(key: string): Promise<string | null> {
  const { result } = await redis(["GET", key]);
  return result as string | null;
}

async function redisSetEx(
  key: string,
  ttl: number,
  value: string,
): Promise<void> {
  await redis(["SET", key, value, "EX", String(ttl)]);
}

/**
 * Distributed lock using SET NX EX
 * Returns true if lock acquired, false otherwise
 */
async function acquireLock(): Promise<boolean> {
  const { result } = await redis([
    "SET",
    LOCK_KEY,
    "1",
    "NX",
    "EX",
    String(LOCK_TTL),
  ]);
  return result === "OK";
}

async function releaseLock(): Promise<void> {
  await redis(["DEL", LOCK_KEY]);
}

// ─── In-memory L1 cache (per-isolate, best-effort) ───────────
let l1: { raw: string; expiry: number } | null = null;

// ─── Upstream Fetch with Retry ────────────────────────────────
async function fetchFresh(): Promise<{ json: string; expiry: number }> {
  let lastErr: Error = new Error("unknown");

  for (let i = 0; i < MAX_RETRY; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 700 * i));
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(API, { headers: HEADERS, signal: ctrl.signal });
      clearTimeout(t);

      if (!res.ok) {
        lastErr = new Error("upstream_" + res.status);
        continue;
      }

      const body = await res.json();
      const url: string = body?.data?.secured_url;
      if (!url) {
        lastErr = new Error("empty_url");
        continue;
      }

      const m = url.match(/[?&]e=(\d+)/);
      const expiry = m ? parseInt(m[1]) : 0;

      if (expiry) {
        const ttl = expiry - Math.floor(Date.now() / 1000);
        if (ttl < MIN_TTL) {
          lastErr = new Error("token_too_short_" + ttl + "s");
          continue;
        }
      }

      return { json: JSON.stringify(body), expiry };
    } catch (e: unknown) {
      lastErr =
        e instanceof Error && e.name === "AbortError"
          ? new Error("timeout")
          : (e as Error);
    }
  }
  throw lastErr;
}

// ─── Main Logic: L1 → Redis → Upstream (with distributed lock) ─
async function getStream(): Promise<{ data: string; expiry: number }> {
  const now = Math.floor(Date.now() / 1000);

  // ① L1 in-memory check (fastest — 0ms)
  if (l1 && l1.expiry - now > MIN_TTL) {
    return { data: l1.raw, expiry: l1.expiry };
  }

  // ② Redis check (~1-5ms from edge)
  const cached = await redisGet(CACHE_KEY);
  if (cached) {
    const parsed: { json: string; expiry: number } = JSON.parse(cached);
    if (parsed.expiry - now > MIN_TTL) {
      // Populate L1 for subsequent requests in this isolate
      l1 = { raw: parsed.json, expiry: parsed.expiry };
      return { data: parsed.json, expiry: parsed.expiry };
    }
  }

  // ③ Cache miss — try to acquire distributed lock
  const gotLock = await acquireLock();

  if (!gotLock) {
    // Another instance is fetching. Poll Redis for up to 10 seconds.
    for (let wait = 0; wait < 10; wait++) {
      await new Promise((r) => setTimeout(r, 1000));
      const retryCache = await redisGet(CACHE_KEY);
      if (retryCache) {
        const parsed: { json: string; expiry: number } = JSON.parse(retryCache);
        if (parsed.expiry - now > MIN_TTL) {
          l1 = { raw: parsed.json, expiry: parsed.expiry };
          return { data: parsed.json, expiry: parsed.expiry };
        }
      }
    }
    throw new Error("lock_timeout");
  }

  // ④ We hold the lock — fetch from upstream
  try {
    const fresh = await fetchFresh();
    const redisTTL = Math.max(fresh.expiry - now - 60, 60); // expire 1 min early in Redis

    // Store in Redis (shared across all isolates)
    await redisSetEx(
      CACHE_KEY,
      redisTTL,
      JSON.stringify({ json: fresh.json, expiry: fresh.expiry }),
    );

    // Store in L1
    l1 = { raw: fresh.json, expiry: fresh.expiry };

    return { data: fresh.json, expiry: fresh.expiry };
  } finally {
    await releaseLock();
  }
}

// ─── CORS Headers ─────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

// ─── HTTP Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return Response.json(
      { error: "method_not_allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const { data, expiry } = await getStream();
    const now = Math.floor(Date.now() / 1000);
    const parsed = JSON.parse(data);

    return Response.json(
      { ...parsed, _meta: { expires_in: expiry - now } },
      { status: 200, headers: corsHeaders },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[roya-proxy] failed:", msg);
    return Response.json(
      { error: "stream_unavailable", detail: msg },
      { status: 502, headers: corsHeaders },
    );
  }
});
