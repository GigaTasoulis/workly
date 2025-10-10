export async function onRequest({ env, request }: any) {
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";

  // Write + read a probe key (expires in 60s)
  await env.RATELIMIT.put("probe", JSON.stringify({ t: Date.now(), ip }), { expirationTtl: 60 });
  const val = await env.RATELIMIT.get("probe", "json");

  return new Response(JSON.stringify({ ok: true, kv: !!val, from: ip, val }), {
    headers: { "content-type": "application/json" },
  });
}
