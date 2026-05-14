import crypto from "crypto";

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

// Fallback de emergência — usado quando o env var ADMIN_PASSWORD foi perdido.
// REMOVER esta credencial assim que a senha for redefinida no painel do Vercel.
const FALLBACK_EMAIL = "arenaalcabeach@gmail.com";
const FALLBACK_PASSWORD = "viniarena26";

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

  if (!secret) {
    console.error("admin-login: ADMIN_TOKEN_SECRET não configurado");
    return res.status(500).json({ error: "Servidor não configurado" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  const envMatch =
    adminEmail &&
    adminPassword &&
    timingSafeStringEqual(email, adminEmail) &&
    timingSafeStringEqual(password, adminPassword);

  const fallbackMatch =
    timingSafeStringEqual(email, FALLBACK_EMAIL) &&
    timingSafeStringEqual(password, FALLBACK_PASSWORD);

  if (!envMatch && !fallbackMatch) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const expires = Date.now() + SESSION_DURATION_MS;
  const token = signSession(expires, secret);

  return res.status(200).json({ token, expires });
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return {}; }
}
