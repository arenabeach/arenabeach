import crypto from "crypto";

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

// Rate limit em memória: por instância de função. Não é à prova de múltiplas
// regiões/instâncias, mas já corta força-bruta trivial. Reinicia em cold start.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min
const attempts = new Map<string, { count: number; windowStart: number; lockedUntil?: number }>();

function getClientIp(req: any): string {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (now - entry.windowStart > WINDOW_MS) {
    attempts.delete(ip);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  attempts.set(ip, entry);
}

function recordSuccess(ip: string): void {
  attempts.delete(ip);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function signSession(expires: number, secret: string): string {
  const sig = crypto.createHmac("sha256", secret).update(String(expires)).digest("hex");
  return `${expires}.${sig}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.ADMIN_TOKEN_SECRET || "";

  if (!secret || !adminEmail || !adminPassword) {
    console.error("admin-login: ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_TOKEN_SECRET não configurados");
    return res.status(500).json({ error: "Servidor não configurado" });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(rl.retryAfterSec || LOCKOUT_MS / 1000));
    return res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  const envMatch =
    timingSafeStringEqual(email, adminEmail) &&
    timingSafeStringEqual(password, adminPassword);

  if (!envMatch) {
    recordFailure(ip);
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  recordSuccess(ip);
  const expires = Date.now() + SESSION_DURATION_MS;
  const token = signSession(expires, secret);

  return res.status(200).json({ token, expires });
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}
