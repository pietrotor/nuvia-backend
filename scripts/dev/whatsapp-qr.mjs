/**
 * Dev-only helper: serves a self-refreshing WhatsApp QR page.
 *
 * WhatsApp rotates the pairing QR every few seconds, so a static screenshot is
 * unusable. This page re-fetches the current QR from the API and stops once the
 * session reports itself connected.
 *
 * Usage: node scripts/dev/whatsapp-qr.mjs [--port 3011]
 * Credentials come from QR_EMAIL / QR_PASSWORD / API_URL env vars.
 */
import { createServer } from 'node:http';

const API_URL = process.env.API_URL ?? 'http://localhost:3010/api/v1';
const EMAIL = process.env.QR_EMAIL ?? 'ana@glow.test';
const PASSWORD = process.env.QR_PASSWORD ?? 'Secreta123';
const PORT = Number(
  process.argv.includes('--port')
    ? process.argv[process.argv.indexOf('--port') + 1]
    : 3011,
);

let token = null;

async function login() {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`login failed: ${response.status}`);
  token = (await response.json()).token;
}

async function authorized(path, init = {}) {
  if (!token) await login();
  const call = () =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${token}` },
    });

  let response = await call();
  if (response.status === 401) {
    await login();
    response = await call();
  }
  return response;
}

// Never ask for a QR while the session is linked: the provider would restart
// the socket and drop it.
async function currentQr() {
  if (await isConnected()) return null;

  const response = await authorized('/whatsapp-session/qr');
  if (!response.ok) return null;
  const { qrBase64 } = await response.json();
  return qrBase64 ? Buffer.from(qrBase64.split(',').pop(), 'base64') : null;
}

async function isConnected() {
  const response = await authorized('/whatsapp-session/status');
  return response.ok ? Boolean((await response.json()).connected) : false;
}

const PAGE = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Vincular WhatsApp - Nuvi</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center;
           min-height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
    .card { background: #1e293b; padding: 32px; border-radius: 16px; text-align: center;
            max-width: 520px; }
    img { width: 420px; height: 420px; max-width: 90vw; max-height: 90vw;
          background: #fff; border-radius: 12px; image-rendering: pixelated; }
    .state { margin-top: 16px; font-size: 14px; color: #94a3b8; }
    .ok { color: #4ade80; font-weight: 600; }
    .hint { font-size: 13px; color: #94a3b8; margin-top: 8px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Vinculá tu WhatsApp</h1>
    <p>WhatsApp → Dispositivos vinculados → Vincular un dispositivo</p>
    <img id="qr" alt="QR de WhatsApp">
    <div class="state" id="state">Cargando…</div>
    <p class="hint">Subí el brillo, acercá el celular y esperá 1–2 s sin mover.
      El QR se renueva cada ~15 s; si WhatsApp dice “error al leer”, pedí uno nuevo
      con el botón o esperá la renovación.</p>
    <p><button id="refresh" type="button">Nuevo QR ahora</button></p>
  </div>
  <script>
    let timer;
    async function tick(force) {
      clearTimeout(timer);
      const { connected } = await (await fetch('/status')).json();
      const state = document.getElementById('state');
      const img = document.getElementById('qr');
      if (connected) {
        state.textContent = 'WhatsApp vinculado correctamente';
        state.className = 'state ok';
        img.style.display = 'none';
        return;
      }
      img.style.display = 'inline-block';
      // Avoid thrashing the camera mid-scan: only swap when loaded.
      const next = new Image();
      next.onload = () => { img.src = next.src; };
      next.onerror = () => { state.textContent = 'No se pudo cargar el QR. Reintentando…'; };
      next.src = '/qr.png?t=' + Date.now() + (force ? '&force=1' : '');
      state.textContent = 'Esperando escaneo… (renueva cada ~15 s)';
      timer = setTimeout(() => tick(false), 15000);
    }
    document.getElementById('refresh').onclick = () => tick(true);
    tick(true);
  </script>
</body>
</html>`;

createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/qr.png')) {
      const png = await currentQr();
      if (!png) {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200, {
        'content-type': 'image/png',
        'cache-control': 'no-store',
      });
      res.end(png);
      return;
    }

    if (req.url?.startsWith('/status')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ connected: await isConnected() }));
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(error));
  }
}).listen(PORT, () => console.log(`QR page: http://localhost:${PORT}`));
