import "server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Rate limit sederhana in-memory per key (mis. `ip:route`) — cukup untuk deployment satu instance
 * seperti sistem ini (state reset kalau container restart, itu diterima). Dipakai di endpoint publik
 * yang rawan disalahgunakan untuk scraping/brute-force (Cek Kelulusan, Tracer Study mandiri, dll). */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

function parseForwardedIp(get: (name: string) => string | null): string {
  const fwd = get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return get("x-real-ip") ?? "unknown";
}

export function getClientIp(req: Request): string {
  return parseForwardedIp(n => req.headers.get(n));
}

/** Sama seperti getClientIp, tapi terima objek headers langsung (bukan Request utuh) — dipakai di
 * Server Action (mis. login()) yang tidak punya akses ke `Request`, cuma `await headers()` dari
 * `next/headers`. */
export function getClientIpFromHeaders(h: { get(name: string): string | null }): string {
  return parseForwardedIp(n => h.get(n));
}
