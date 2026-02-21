from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random, time

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PARTIES = {}  # code -> {started, count, manche, round, vote}

def gen_code():
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    nums = "0123456789"
    return random.choice(letters)+random.choice(letters)+random.choice(nums)+random.choice(nums)

class CreateBody(BaseModel):
    manche: int
    round: int
    vote: int

@app.post("/party")
def create_party(body: CreateBody):
    code = gen_code()
    PARTIES[code] = {
        "code": code,
        "manche": body.manche,
        "round": body.round,
        "vote": body.vote,
        "started": False,
        "count": 1,  # l'hôte
        "createdAt": int(time.time())
    }
    return {"ok": True, "code": code}

@app.post("/party/{code}/join")
def join_party(code: str):
    p = PARTIES.get(code)
    if not p:
        return {"ok": False, "error": "NOT_FOUND"}
    p["count"] += 1
    return {"ok": True, "count": p["count"], "started": p["started"]}

@app.post("/party/{code}/start")
def start_party(code: str):
    p = PARTIES.get(code)
    if not p:
        return {"ok": False, "error": "NOT_FOUND"}
    p["started"] = True
    return {"ok": True}

@app.get("/party/{code}/status")
def status_party(code: str):
    p = PARTIES.get(code)
    if not p:
        return {"ok": False, "error": "NOT_FOUND"}
    return {"ok": True, "count": p["count"], "started": p["started"]}