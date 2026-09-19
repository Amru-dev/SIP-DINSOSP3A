import { fail } from "../shared/validation.js";
export function createRateLimiter() {
  const limits = new Map();
  return function enforceRateLimit(req, route) {
    // Rate limits are per process. Put a shared limiter at the reverse proxy for multi-instance hosting.
    const key =
      (req.socket.remoteAddress || "unknown") +
      (route === "/api/login" ? ":login" : ":api");
    const now = Date.now();
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    let lim = limits.get(key);
    if (!lim || lim.until < now) {
      lim = { n: 0, until: now + 60000 };
      limits.set(key, lim);
    }
    if (++lim.n > (route === "/api/login" ? 10 : 250))
      fail(429, "Terlalu banyak permintaan. Coba lagi satu menit.");
    return now;
  };
}
