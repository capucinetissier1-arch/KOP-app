from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, Optional
import random, time, os

app = FastAPI(title="KOP Backend", version="1.0.0")

# ================== CORS ==================
# ✅ Mets TON domaine GitHub Pages ici (recommandé).
# Si tu veux tester vite, remets ["*"].
ALLOWED_ORIGINS = [
    "https://capucinetissier1-arch.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== STORE (RAM) ==================
# ⚠️ En gratuit sur Render, la RAM peut reset si le service redémarre.
# Pour V1 c’est ok. Plus tard: Redis/DB.
PARTIES: Dict[str, dict] = {}

TTL_SECONDS = 60 * 60 * 6  # 6h avant nettoyage auto

def now() -> int:
    return int(time.time())

def cleanup():
    t = now()
    to_del = [code for code, p in PARTIES.items() if t - p["createdAt"] > TTL_SECONDS]
    for code in to_del:
        PARTIES.pop(code, None)

def gen_code() -> str:
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    nums = "0123456789"
    for _ in range(50):
        code = (
            random.choice(letters)
            + random.choice(letters)
            + random.choice(nums)
            + random.choice(nums)
        )
        if code not in PARTIES:
            return code
    raise RuntimeError("Unable to generate unique code")

def get_party_or_404(code: str) -> dict:
    cleanup()
    code = code.strip().upper()
    p = PARTIES.get(code)
    if not p:
        raise HTTPException(status_code=404, detail="NOT_FOUND")
    return p

# ================== MODELS ==================
class CreateBody(BaseModel):
    manche: int = Field(ge=1, le=99)
    round: int = Field(ge=1, le=99)
    vote: int = Field(ge=1, le=99)

class JoinBody(BaseModel):
    name: Optional[str] = Field(default=None, max_length=24)

# ================== ROUTES ==================
@app.get("/health")
def health():
    return {"ok": True, "time": now()}

@app.post("/party")
def create_party(body: CreateBody):
    cleanup()
    code = gen_code()
    PARTIES[code] = {
        "code": code,
        "manche": body.manche,
        "round": body.round,
        "vote": body.vote,
        "started": False,
        "count": 1,          # l'hôte
        "players": [],       # optionnel (si tu veux garder des noms)
        "createdAt": now(),
        "startedAt": None,
    }
    return {"ok": True, "code": code}

@app.post("/party/{code}/join")
def join_party(code: str, body: JoinBody = JoinBody()):
    p = get_party_or_404(code)

    # (optionnel) stocker les noms
    if body.name:
        name = body.name.strip()
        if name:
            p["players"].append(name)

    p["count"] += 1
    return {"ok": True, "code": p["code"], "count": p["count"], "started": p["started"]}

@app.post("/party/{code}/start")
def start_party(code: str):
    p = get_party_or_404(code)
    p["started"] = True
    p["startedAt"] = now()
    return {"ok": True, "started": True}

@app.get("/party/{code}/status")
def status_party(code: str):
    p = get_party_or_404(code)
    return {
        "ok": True,
        "code": p["code"],
        "count": p["count"],
        "started": p["started"],
        "manche": p["manche"],
        "round": p["round"],
        "vote": p["vote"],
        "players": p["players"],   # tu peux enlever si tu veux
    }

# ================== LOCAL RUN (optionnel) ==================
# Sur Render tu ne l'utilises pas, mais en local oui.
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend:app", host="0.0.0.0", port=port, reload=True)