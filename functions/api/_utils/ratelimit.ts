// functions/api/_utils/ratelimit.ts

// Fixed-window KV rate limit. Example: 10 requests per 60 seconds per key.
export async function checkRate(
  env: any,
  keyParts: string[],
  limit = 10,
  windowSec = 60,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const bucket = Math.floor(now / (windowSec * 1000));
  const key = `rl:${keyParts.join(":")}:${bucket}`;

  // KV value is just an integer count
  const cur = await env.RATELIMIT.get(key, "text");
  const count = cur ? parseInt(cur, 10) || 0 : 0;

  const msUntilReset = (bucket + 1) * windowSec * 1000 - now;
  const reset = Math.max(1, Math.ceil(msUntilReset / 1000));

  if (count >= limit) {
    return { allowed: false, remaining: 0, reset };
  }

  // bump count; TTL slightly longer than the window to avoid stale reads
  await env.RATELIMIT.put(key, String(count + 1), { expirationTtl: windowSec + 15 });

  return { allowed: true, remaining: Math.max(0, limit - (count + 1)), reset };
}

export function getClientIp(request: Request): string {
  const h = request.headers;
  // Cloudflare sets cf-connecting-ip. Fallbacks help for local/dev.
  const ip =
    h.get("cf-connecting-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "";
  return ip || "::1";
}
