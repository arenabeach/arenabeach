const SESSION_KEY = "ala-beach-admin-session";

interface StoredSession {
  token: string;
  expires: number;
}

function readSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data?.token === "string" && typeof data?.expires === "number") {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: "Erro de conexão. Tente novamente." };
  }

  if (res.status === 401) {
    return { ok: false, error: "Email ou senha incorretos" };
  }
  if (!res.ok) {
    return { ok: false, error: "Erro ao verificar credenciais" };
  }

  const data = (await res.json()) as Partial<StoredSession>;
  if (typeof data?.token !== "string" || typeof data?.expires !== "number") {
    return { ok: false, error: "Resposta inválida do servidor" };
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: data.token, expires: data.expires })
  );
  return { ok: true };
}

export function isSessionValid(): boolean {
  const session = readSession();
  if (!session) return false;
  return session.expires > Date.now();
}

export function getSessionToken(): string | null {
  const session = readSession();
  if (!session || session.expires <= Date.now()) return null;
  return session.token;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
