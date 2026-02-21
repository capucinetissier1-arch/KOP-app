// ================== CONFIG BACKEND ==================
const API = "http://127.0.0.1:8000"; // si téléphone: http://TON_IP:8000

// ================== HELPERS ==================
function go(url) { window.location.href = url; }
function upperCode(v) { return (v || "").toString().trim().toUpperCase(); }

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

const page = document.body?.dataset?.page || ""; // home | settings | lobby | waiting

// ================== HOME (index.html) ==================
if (page === "home") {
  const createBtn = document.querySelector('[data-action="create"]');
  const joinBtn   = document.querySelector('[data-action="join"]');

  const params = new URLSearchParams(window.location.search);
  const codeFromQr = upperCode(params.get("code"));

  // Scan QR -> waiting
  if (codeFromQr) {
    go(`waiting.html?code=${encodeURIComponent(codeFromQr)}`);
  }

  createBtn?.addEventListener("click", () => {
    go("settings.html");
  });

  joinBtn?.addEventListener("click", () => {
    const code = upperCode(prompt("Code de la partie (ex: AB12) :"));
    if (!code) return;
    go(`waiting.html?code=${encodeURIComponent(code)}`);
  });
}

// ================== SETTINGS (settings.html) ==================
if (page === "settings") {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");

  const mancheSelect = document.getElementById("mancheSelect");
  const roundSelect  = document.getElementById("roundSelect");
  const voteSelect   = document.getElementById("voteSelect");

  backBtn?.addEventListener("click", () => go("index.html"));

  nextBtn?.addEventListener("click", async () => {
    if (!mancheSelect?.value || !roundSelect?.value || !voteSelect?.value) {
      alert("Choisis les 3 temps 🙂");
      return;
    }

    const manche = Number(mancheSelect.value);
    const round  = Number(roundSelect.value);
    const vote   = Number(voteSelect.value);

    // ✅ crée la partie sur le BACKEND
    const res = await apiPost("/party", { manche, round, vote });
    if (!res?.ok) {
      alert("Backend pas lancé ? (vérifie le terminal + /docs)");
      return;
    }

    const code = upperCode(res.code);
    go(`lobby.html?role=host&code=${encodeURIComponent(code)}`);
  });
}

// ================== WAITING (waiting.html) ==================
if (page === "waiting") {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const code = upperCode(params.get("code"));
    if (!code) return alert("Aucun code.");

    // ✅ join côté backend
    const j = await apiPost(`/party/${encodeURIComponent(code)}/join`);
    if (!j?.ok) {
      alert("Code invalide / partie introuvable");
      return go("index.html");
    }

    // attente: check started
    const tick = async () => {
      const s = await apiGet(`/party/${encodeURIComponent(code)}/status`);
      if (s?.ok && s.started) {
        return go(`lobby.html?role=guest&code=${encodeURIComponent(code)}`);
      }
      setTimeout(tick, 1000);
    };
    tick();
  })();
}

// ================== LOBBY (lobby.html) ==================
if (page === "lobby") {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const role = (params.get("role") || "").toLowerCase(); // host | guest
    const code = upperCode(params.get("code"));

    const codeEl  = document.getElementById("game-code");
    const qrImg   = document.getElementById("qrImg");
    const countEl = document.getElementById("players-count");
    const backBtn = document.getElementById("backBtn");
    const startBtn = document.getElementById("start-game-btn");

    if (codeEl) codeEl.textContent = code || "----";

    // QR (vers index.html?code=XXXX)
    if (qrImg && code) {
      const joinUrl = `${window.location.origin}/index.html?code=${encodeURIComponent(code)}`;
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;
    }

    // Retour
    backBtn?.addEventListener("click", () => {
      if (role === "host") go("settings.html");
      else go("index.html");
    });

    // Host: voit bouton commencer + compteur
    if (role === "host") {
      if (startBtn) startBtn.style.display = "flex";

      const tick = async () => {
        const s = await apiGet(`/party/${encodeURIComponent(code)}/status`);
        if (s?.ok && countEl) countEl.textContent = String(s.count);
        setTimeout(tick, 1000);
      };
      tick();

      startBtn?.addEventListener("click", async () => {
        const r = await apiPost(`/party/${encodeURIComponent(code)}/start`);
        if (!r?.ok) return alert("Erreur start");
        alert("Partie lancée ✅");
      });
    }

    // Guest: bouton commencer caché + (optionnel) affiche compteur
    if (role === "guest") {
      if (startBtn) startBtn.style.display = "none";

      const tick = async () => {
        const s = await apiGet(`/party/${encodeURIComponent(code)}/status`);
        if (s?.ok && countEl) countEl.textContent = String(s.count);
        setTimeout(tick, 1000);
      };
      tick();
    }
  })();
}