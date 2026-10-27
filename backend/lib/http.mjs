import { timingSafeEqual, createHash } from "node:crypto";

const origins = (
  process.env.ALLOWED_ORIGINS ||
  "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173"
).split(",");

export function withApi(fn) {
  return async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    try {
      await fn(req, res);
    } catch (err) {
      if (!res.headersSent)
        res.status(err.status || 500).json({
          error: err.status
            ? err.message
            : "We could not process the request. Please try again or contact the team.",
        });
      console.error("Request failed:", err.name || err);
    }
  };
}

export function remoteAddress(req) {
  return process.env.TRUST_PROXY === "1"
    ? String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress)
        .split(",")[0]
        .trim()
    : req.socket?.remoteAddress || "unknown";
}

export function adminOK(req) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || adminToken.length < 32) return false;
  const given = String(req.headers.authorization || "").replace(/^Bearer /, "");
  return timingSafeEqual(
    createHash("sha256").update(given).digest(),
    createHash("sha256").update(adminToken).digest(),
  );
}

export const hash = (value) => createHash("sha256").update(value).digest("hex");
