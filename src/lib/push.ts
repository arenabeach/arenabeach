import { getSessionToken } from "./auth";

// Notificações do painel admin (Web Push). Funciona no computador direto pelo
// navegador; no iPhone só com o painel instalado na Tela de Início (iOS 16.4+).

export type PushStatus =
  | "unsupported" // navegador não suporta
  | "needs-install" // iPhone/iPad: precisa instalar na Tela de Início
  | "denied" // usuário bloqueou
  | "disabled" // pode ativar
  | "enabled"; // este aparelho já recebe

async function adminPost<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = getSessionToken();
  if (!token) throw new Error("Sessão admin expirada. Faça login novamente.");
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ op, args }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Erro ${res.status}`);
  return data as T;
}

const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const hasPushApi = (): boolean =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function getPushStatus(): Promise<PushStatus> {
  if (!hasPushApi()) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  if (isIOS() && !isStandalone()) return "needs-install";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === "granted" ? "enabled" : "disabled";
  } catch {
    return "disabled";
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Computador (Windows)";
  if (/Mac/.test(ua)) return "Computador (Mac)";
  return "Outro aparelho";
}

// Precisa ser chamado direto do clique do botão: o iPhone só mostra o pedido
// de permissão se ele vier de um toque do usuário.
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }

  const { publicKey } = await adminPost<{ publicKey: string }>("getPushPublicKey");
  if (!publicKey) {
    throw new Error("Notificações ainda não configuradas no servidor (faltam as chaves VAPID na Vercel).");
  }

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await adminPost("savePushSubscription", { subscription: sub.toJSON(), label: deviceLabel() });
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await adminPost("removePushSubscription", { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<{ sent: number; failed: number; devices: number }> {
  return adminPost("testPush");
}
