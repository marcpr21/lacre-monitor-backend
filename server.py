from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import bcrypt
import jwt
import os

JWT_SECRET = "seu-segredo-jwt-mude-em-producao-12345"
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

USERS = {}
PHOTOS = []

def init_users():
    admin_pw = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
    USERS["admin"] = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password": admin_pw,
        "name": "Administrador",
        "role": "admin"
    }
    employee_names = [
        "Posto Fagundao", "Posto Glamour", "Posto Gloria", "Posto Laranjal",
        "Posto Malvino", "Posto Marclau", "Posto Meia Noite", "Posto ML",
        "Posto Monteiro", "Posto MR", "Posto Pinheirinho", "Posto Planeta",
        "Posto Quintino", "Posto Santa Cruz", "Posto Santa Rosa", "Posto Santissimo",
    teste_pw = bcrypt.hashpw("teste".encode('utf-8'), bcrypt.gensalt())
    USERS["teste"] = {
        "id": str(uuid.uuid4()),
        "username": "teste",
        "password": teste_pw,
        "name": "Usuário Teste",
        "role": "employee"
    } 
    ]
    for name in employee_names:
        emp_pw = bcrypt.hashpw("123456".encode('utf-8'), bcrypt.gensalt())
        username = name.lower().replace(" ", "_")
        USERS[username] = {
            "id": str(uuid.uuid4()),
            "username": username,
            "password": emp_pw,
            "name": name,
            "role": "employee"
        }

init_users()

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "employee"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str

class LoginResponse(BaseModel):
    token: str
    user: UserResponse

class PhotoSubmit(BaseModel):
    photo_type: str
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None

app = FastAPI(title="Lacre Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_brazil_time():
    return datetime.now(ZoneInfo("America/Sao_Paulo"))

def convert_utc_to_brazil(utc_datetime):
    if utc_datetime.tzinfo is None:
        utc_datetime = utc_datetime.replace(tzinfo=ZoneInfo("UTC"))
    return utc_datetime.astimezone(ZoneInfo("America/Sao_Paulo"))

def create_token(user_id: str, username: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=168)
    payload = {"user_id": user_id, "username": username, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials):
    try:
        token = credentials.credentials
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except:
        raise HTTPException(status_code=401, detail="Token inválido")

def check_schedule_window(photo_type: str, now: datetime) -> tuple:
    weekday = now.weekday()
    hour = now.hour
    minute = now.minute
    current_time = hour + minute / 60.0
    if photo_type == "lacre":
        if weekday in [0, 2, 4] and current_time <= 12.0:
            day_name = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"][weekday]
            return True, f"{day_name} 06:00-12:00"
        return False, "Fora do horário permitido"
    elif photo_type == "medidor":
        if 6.0 <= current_time <= 9.0:
            return True, "Manhã 06:00-09:00"
        elif 17.0 <= current_time <= 18.0:
            return True, "Tarde 17:00-18:00"
        return False, "Fora do horário permitido"
    return False, "Tipo de foto inválido"

@app.get("/")
def root():
    return {"message": "Lacre Monitor API Online", "status": "ok", "time": get_brazil_time().strftime("%H:%M:%S")}

@app.get("/api/")
def api_root():
    return {"message": "API Online", "version": "1.0"}

@app.post("/api/auth/login", response_model=LoginResponse)
def login(credentials: UserLogin):
    user = USERS.get(credentials.username)
    if not user or not bcrypt.checkpw(credentials.password.encode('utf-8'), user["password"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_token(user["id"], user["username"], user["role"])
    return LoginResponse(token=token, user=UserResponse(id=user["id"], username=user["username"], name=user["name"], role=user["role"]))

@app.get("/api/users/me")
def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    user = USERS.get(payload["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return UserResponse(id=user["id"], username=user["username"], name=user["name"], role=user["role"])

@app.get("/api/users/employees", response_model=List[UserResponse])
def get_employees(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    employees = [UserResponse(id=u["id"], username=u["username"], name=u["name"], role=u["role"]) for u in USERS.values() if u["role"] == "employee"]
    return employees

@app.post("/api/users", response_model=UserResponse)
def create_user(user_data: UserCreate, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    if user_data.username in USERS:
        raise HTTPException(status_code=400, detail="Usuário já existe")
    hashed_pw = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    user_id = str(uuid.uuid4())
    USERS[user_data.username] = {"id": user_id, "username": user_data.username, "password": hashed_pw, "name": user_data.name, "role": user_data.role}
    return UserResponse(id=user_id, username=user_data.username, name=user_data.name, role=user_data.role)

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    for username, user in list(USERS.items()):
        if user["id"] == user_id:
            if user["role"] == "admin":
                raise HTTPException(status_code=400, detail="Não é possível deletar administrador")
            del USERS[username]
            return {"success": True, "message": "Usuário deletado"}
    raise HTTPException(status_code=404, detail="Usuário não encontrado")

@app.post("/api/users/{user_id}/reset-password")
def reset_password(user_id: str, new_password: dict, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    password = new_password.get("password")
    if not password:
        raise HTTPException(status_code=400, detail="Senha não fornecida")
    for username, user in USERS.items():
        if user["id"] == user_id:
            user["password"] = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            return {"success": True, "message": "Senha alterada"}
    raise HTTPException(status_code=404, detail="Usuário não encontrado")

@app.get("/api/photos/check-schedule")
def check_schedule(photo_type: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    now = get_brazil_time()
    if payload["username"] == "teste":
        return {"allowed": True, "period": "Teste - sem restrições", "message": "Usuário teste pode enviar a qualquer momento"}
    allowed, period = check_schedule_window(photo_type, now)
    return {"allowed": allowed, "period": period, "current_time": now.strftime("%Y-%m-%d %H:%M:%S")}

@app.post("/api/photos/submit")
def submit_photo(photo: PhotoSubmit, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    user = USERS.get(payload["username"])
    now = get_brazil_time()
    if payload["username"] != "teste":
        allowed, period = check_schedule_window(photo.photo_type, now)
        if not allowed:
            raise HTTPException(status_code=400, detail=f"Fora do horário: {period}")
    else:
        period = "Teste - sem restrições"
    photo_data = {"id": str(uuid.uuid4()), "employee_id": user["id"], "employee_name": user["name"], "photo_type": photo.photo_type, "image_base64": photo.image_base64, "timestamp": now, "latitude": photo.latitude, "longitude": photo.longitude, "location_name": photo.location_name, "scheduled_period": period}
    PHOTOS.append(photo_data)
    return {"success": True, "photo_id": photo_data["id"], "message": "Foto enviada"}

@app.get("/api/photos")
def get_photos(photo_type: Optional[str] = None, employee_id: Optional[str] = None, limit: int = 100, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    filtered_photos = PHOTOS.copy()
    if payload["role"] != "admin":
        filtered_photos = [p for p in filtered_photos if p["employee_id"] == payload["user_id"]]
    if photo_type:
        filtered_photos = [p for p in filtered_photos if p["photo_type"] == photo_type]
    if employee_id:
        filtered_photos = [p for p in filtered_photos if p["employee_id"] == employee_id]
    filtered_photos.sort(key=lambda x: x["timestamp"], reverse=True)
    filtered_photos = filtered_photos[:limit]
    photos_response = [{**p, "timestamp": convert_utc_to_brazil(p["timestamp"]).isoformat()} for p in filtered_photos]
    return {"photos": photos_response, "total": len(photos_response)}

@app.get("/api/analytics/missing-photos")
def get_missing_photos(days_back: int = 30, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    if payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    report = []
    employees = [u for u in USERS.values() if u["role"] == "employee" and u["username"] != "teste"]
    for employee in employees:
        report.append({"employee_id": employee["id"], "employee_name": employee["name"], "missing_lacres": [], "missing_medidor": [], "total_missing_lacres": 0, "total_missing_medidor": 0, "total_missing": 0, "lacre_compliance": 100, "medidor_compliance": 100, "overall_compliance": 100})
    return {"report": report, "period_days": days_back, "generated_at": get_brazil_time().isoformat()}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
