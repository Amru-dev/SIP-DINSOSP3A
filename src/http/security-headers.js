export function setSecurityHeaders(res, production) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self' https://www.youtube-nocookie.com https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  );
  if (production)
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
}
