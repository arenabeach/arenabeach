const ADMIN_EMAIL = "arenaalcabeach@gmail.com";
const ADMIN_PASSWORD = "viniarena2026";
const SESSION_KEY = "ala-beach-admin-session";
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours

export function verifyAdminCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export function createSession(): void {
  const session = { expires: Date.now() + SESSION_DURATION };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function isSessionValid(): boolean {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return false;
  try {
    const session = JSON.parse(data);
    return session.expires > Date.now();
  } catch {
    return false;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
