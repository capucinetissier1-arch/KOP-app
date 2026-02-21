/***********************
 * KOP - app.js (clean)
 * - fonctionne sur GitHub Pages
 * - navigation OK (Créer / Rejoindre / Waiting / Lobby)
 * - QR code OK (pas de 404, garde /KOP-app/)
 * - MODE_BACKEND optionnel (quand tu auras un backend HTTPS public)
 ***********************/

// ====== CONFIG ======
const MODE_BACKEND = false; // ✅ false = tout marche tout de suite sur GitHub Pages
const API = "https://TON-BACKEND-HTTPS.com"; // utilisé seulement si MODE_BACKEND=true

// ====== HELPERS ======
function go(url) { window.location.href = url; }
function upperCode(v) { return (v || "").toString().trim().toUpperCase(); }

function setLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function getLS(key, fallback = null) {
  const v = localStorage.getItem(key);
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

function genCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  return (
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    nums[Math.floor(Math.random() * nums.length)] +
    nums[Math.floor(Math.random() * nums.length)]
  );
}

async function apiGet(path) {
  const r = await fetch(API + path);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null
  });
  return r.json();
}

// ✅ Base GitHub Pages safe (ex: origin=https://...github.io, basePath=/KOP-app/)
function getBasePath() {
  return window.location.pathname.replace(/\/[^\/]*$/, "/");
}
function buildAppUrl(relativeFileWithQuery) {
  // relativeFileWithQuery = "index.html?code=AB12"
  return `${window.location.origin}${getBasePath()}${relativeFileWithQuery}`;
}

const page = document.body?.dataset?.page || ""; // home | settings | waiting | lobby

// ================== HOME (index.html) ==================
if (page === "home") {
  const createBtn = document.querySelector('[data-action="create"]');
  const joinBtn   = document.querySelector('[data-action="join"]');

  const params = new URLSearchParams(window.location.search);
  const codeFromQr = upperCode(params.get("code"));

  // ✅ Scan QR (index.html?code=XXXX) -> waiting
  if (codeFromQr) {
    go(buildAppUrl(`waiting.html?code=${encodeURIComponent(codeFromQr)}`));
    // return not needed; go() change page
  }

  createBtn?.addEventListener("click", () => {
    go(buildAppUrl("settings.html"));
  });

  joinBtn?.addEventListener("click", () => {
    const code = upperCode(prompt("Code de la partie (ex: AB12) :"));
    if (!code) return;
    go(buildAppUrl(`waiting.html?code=${encodeURIComponent(code)}`));
  });
}

// ================== SETTINGS (settings.html) ==================
if (page === "settings") {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");

  const mancheSelect = document.getElementById("mancheSelect");
  const roundSelect  = document.getElementById("roundSelect");
  const voteSelect   = document.getElementById("voteSelect");

  backBtn?.addEventListener("click", () => go(buildAppUrl("index.html")));

  nextBtn?.addEventListener("click", async () => {
    if (!mancheSelect?.value || !roundSelect?.value || !voteSelect?.value) {
      alert("Choisis les 3 temps 🙂");
      return;
    }

    const manche = Number(mancheSelect.value);
    const round  = Number(roundSelect.value);
    const vote   = Number(voteSelect.value);

    // ✅ MODE LOCAL (fonctionne sur GitHub Pages tout de suite)
    if (!MODE_BACKEND) {
      const code = genCode();
      setLS("kop_party", { code, manche, round, vote, started: false, count: 1 });
      go(buildAppUrl(`lobby.html?role=host&code=${encodeURIComponent(code)}`));
      return;
    }

    // ✅ MODE BACKEND (quand tu auras un backend HTTPS public)
    try {
      const res = await apiPost("/party", { manche, round, vote });
      if (!res?.ok) return alert("Erreur backend (création partie).");
      const code = upperCode(res.code);
      go(buildAppUrl(`lobby.html?role=host&code=${encodeURIComponent(code)}`));
    } catch (e) {
      alert("Impossible de contacter le backend.\n\n" + e);
    }
  });
}

// ================== WAITING (waiting.html) ==================
if (page === "waiting") {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const code = upperCode(params.get("code"));
    if (!code) return alert("Aucun code.");

    // ✅ MODE LOCAL : on passe direct au lobby guest (pas d’attente réelle)
    if (!MODE_BACKEND) {
      go(buildAppUrl(`lobby.html?role=guest&code=${encodeURIComponent(code)}`));
      return;
    }

    // ✅ MODE BACKEND : join + attente started
    try {
      const j = await apiPost(`/party/${encodeURIComponent(code)}/join`);
      if (!j?.ok) {
        alert("Code invalide / partie introuvable");
        return go(buildAppUrl("index.html"));
      }

      const tick = async () => {
        const s = await apiGet(`/party/${encodeURIComponent(code)}/status`);
        if (s?.ok && s.started) {
          return go(buildAppUrl(`lobby.html?role=guest&code=${encodeURIComponent(code)}`));
        }
        setTimeout(tick, 1000);
      };
      tick();
    } catch (e) {
      alert("Backend inaccessible.\n\n" + e);
      go(buildAppUrl("index.html"));
    }
  })();
}

// ================== LOBBY (lobby.html) ==================
if (page === "lobby") {
  const params = new URLSearchParams(window.location.search);
  const role = (params.get("role") || "").toLowerCase(); // host | guest
  const code = upperCode(params.get("code"));

  if (!code) {
    alert("Aucun code de partie.");
    go(buildAppUrl("index.html"));
  }

  // ✅ si un guest arrive ici, c’est ok (il peut voir le lobby), mais tu peux aussi le renvoyer vers waiting si tu veux.
  // Si tu veux FORCER waiting pour guest, décommente:
  // if (role === "guest") { go(buildAppUrl(`waiting.html?code=${encodeURIComponent(code)}`)); }

  // Afficher le code
  const codeEl = document.getElementById("game-code");
  if (codeEl) codeEl.textContent = code || "----";

  // ✅ QR UNIVERSel (anti-404) : construit une URL qui garde /KOP-app/
  const qrImg = document.getElementById("qrImg");
  const joinUrl = buildAppUrl(`index.html?code=${encodeURIComponent(code)}`);

  if (qrImg) {
    qrImg.src =
      `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;
  }

  // (Optionnel) Afficher le lien sous le QR pour debug
  const joinLink = document.getElementById("joinLink");
  if (joinLink) {
    joinLink.href = joinUrl;
    joinLink.textContent = joinUrl;
  }

  // Retour
  const backBtn = document.getElementById("backBtn");
  backBtn?.addEventListener("click", () => {
    if (role === "host") go(buildAppUrl("settings.html"));
    else go(buildAppUrl("index.html"));
  });
}