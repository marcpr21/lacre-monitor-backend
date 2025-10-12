from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import bcrypt
import jwt

# Configuration
JWT_SECRET = "seu-segredo-jwt-mude-em-producao-12345"
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

# In-memory storage
USERS = {}
PHOTOS = []

# Initialize default users
def init_users():
    admin_pw = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
    USERS["admin"] = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password": admin_pw,
        "name": "Administrador",
        "role": "admin"
    }

init_users()

# Models
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

# Create app
app = FastAPI(title="Lacre Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions
def get_brazil_time():
    return datetime.now(ZoneInfo("America/Sao_Paulo"))

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

# Routes
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
    return LoginResponse(
        token=token,
        user=UserResponse(id=user["id"], username=user["username"], name=user["name"], role=user["role"])
    )

@app.get("/api/users/me")
def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    user = USERS.get(payload["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return UserResponse(id=user["id"], username=user["username"], name=user["name"], role=user["role"])

@app.post("/api/photos/submit")
def submit_photo(photo: PhotoSubmit, credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_token(credentials)
    user = USERS.get(payload["username"])
    
    now = get_brazil_time()
    photo_data = {
        "id": str(uuid.uuid4()),
        "employee_id": user["id"],
        "employee_name": user["name"],
        "photo_type": photo.photo_type,
        "image_base64": photo.image_base64,
        "timestamp": now,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "location_name": photo.location_name,
        "scheduled_period": "Teste"
    }
    
    PHOTOS.append(photo_data)
    return {"success": True, "photo_id": photo_data["id"], "message": "Foto enviada"}

@app.get("/api/photos")
def get_photos(credentials: HTTPAuthorizationCredentials = Depends(security)):
    verify_token(credentials)
    return {"photos": PHOTOS, "total": len(PHOTOS)}

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
