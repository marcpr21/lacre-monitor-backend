from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 1 week

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# IN-MEMORY DATA STORAGE
USERS = {}
PHOTOS = []

# Initialize with default users
def init_users():
    admin_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
    joao_password = bcrypt.hashpw("123456".encode('utf-8'), bcrypt.gensalt())
    teste_password = bcrypt.hashpw("teste".encode('utf-8'), bcrypt.gensalt())
    
    USERS["admin"] = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password": admin_password,
        "name": "Administrador",
        "role": "admin"
    }
    USERS["joao"] = {
        "id": str(uuid.uuid4()),
        "username": "joao",
        "password": joao_password,
        "name": "João Silva",
        "role": "employee"
    }
    USERS["teste"] = {
        "id": str(uuid.uuid4()),
        "username": "teste",
        "password": teste_password,
        "name": "Usuário Teste",
        "role": "employee"
    }

init_users()

# ==================== MODELS ====================

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

class PhotoResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    photo_type: str
    image_base64: str
    timestamp: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    scheduled_period: str

# ==================== HELPERS ====================

def get_brazil_time():
    """Get current time in Brazil timezone (UTC-3)"""
    return datetime.now(ZoneInfo("America/Sao_Paulo"))

def create_access_token(user_id: str, username: str, role: str) -> str:
    """Create JWT access token"""
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials):
    """Verify JWT token and return payload"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from token"""
    payload = verify_token(credentials)
    return payload

def check_schedule_window(photo_type: str, now: datetime) -> tuple:
    """Check if current time is within allowed schedule"""
    weekday = now.weekday()  # 0=Monday, 6=Sunday
    hour = now.hour
    minute = now.minute
    current_time = hour + minute / 60.0

    if photo_type == "lacre":
        # Monday, Wednesday, Friday until 12:00
        if weekday in [0, 2, 4] and current_time <= 12.0:
            day_name = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"][weekday]
            return True, f"{day_name} 06:00-12:00"
        return False, "Fora do horário permitido"
    
    elif photo_type == "medidor":
        # Every day: 06:00-09:00 or 17:00-18:00
        if 6.0 <= current_time <= 9.0:
            return True, "Manhã 06:00-09:00"
        elif 17.0 <= current_time <= 18.0:
            return True, "Tarde 17:00-18:00"
        return False, "Fora do horário permitido"
    
    return False, "Tipo de foto inválido"

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Lacre Monitor API", "version": "1.0"}

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(credentials: UserLogin):
    """Login endpoint"""
    user = USERS.get(credentials.username)
    
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user["password"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    token = create_access_token(user["id"], user["username"], user["role"])
    
    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            name=user["name"],
            role=user["role"]
        )
    )

@api_router.get("/users/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current user info"""
    user = USERS.get(current_user["username"])
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        name=user["name"],
        role=user["role"]
    )

@api_router.get("/users/employees", response_model=List[UserResponse])
async def get_employees(current_user = Depends(get_current_user)):
    """Get all employees (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    employees = [
        UserResponse(id=u["id"], username=u["username"], name=u["name"], role=u["role"])
        for u in USERS.values()
        if u["role"] == "employee"
    ]
    return employees

@api_router.get("/photos/check-schedule")
async def check_schedule(photo_type: str, current_user = Depends(get_current_user)):
    """Check if current time allows photo submission"""
    now = get_brazil_time()
    
    # 'teste' user can always submit
    if current_user["username"] == "teste":
        return {
            "allowed": True,
            "period": "Teste - sem restrições",
            "message": "Usuário teste pode enviar a qualquer momento"
        }
    
    allowed, period = check_schedule_window(photo_type, now)
    
    return {
        "allowed": allowed,
        "period": period,
        "current_time": now.strftime("%Y-%m-%d %H:%M:%S")
    }

@api_router.post("/photos/submit")
async def submit_photo(photo: PhotoSubmit, current_user = Depends(get_current_user)):
    """Submit a new photo"""
    now = get_brazil_time()
    user = USERS.get(current_user["username"])
    
    # Check schedule (except for teste user)
    if current_user["username"] != "teste":
        allowed, period = check_schedule_window(photo.photo_type, now)
        if not allowed:
            raise HTTPException(status_code=400, detail=f"Fora do horário: {period}")
    else:
        period = "Teste - sem restrições"
    
    # Create photo record
    photo_id = str(uuid.uuid4())
    photo_data = {
        "id": photo_id,
        "employee_id": user["id"],
        "employee_name": user["name"],
        "photo_type": photo.photo_type,
        "image_base64": photo.image_base64,
        "timestamp": now,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "location_name": photo.location_name,
        "scheduled_period": period
    }
    
    PHOTOS.append(photo_data)
    
    return {
        "success": True,
        "photo_id": photo_id,
        "period": period,
        "message": "Foto enviada com sucesso"
    }

@api_router.get("/photos", response_model=List[PhotoResponse])
async def get_photos(
    photo_type: Optional[str] = None,
    employee_id: Optional[str] = None,
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    """Get photos with optional filters"""
    filtered_photos = PHOTOS.copy()
    
    # Filter by employee if not admin
    if current_user["role"] != "admin":
        filtered_photos = [p for p in filtered_photos if p["employee_id"] == current_user["user_id"]]
    
    # Apply filters
    if photo_type:
        filtered_photos = [p for p in filtered_photos if p["photo_type"] == photo_type]
    
    if employee_id:
        filtered_photos = [p for p in filtered_photos if p["employee_id"] == employee_id]
    
    # Sort by timestamp descending
    filtered_photos.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Limit results
    filtered_photos = filtered_photos[:limit]
    
    return [PhotoResponse(**p) for p in filtered_photos]

@api_router.get("/analytics/missing-photos")
async def get_missing_photos(days_back: int = 30, current_user = Depends(get_current_user)):
    """Get compliance report (simplified)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    # Simplified - just return empty report
    return {
        "report": [],
        "period_days": days_back,
        "generated_at": get_brazil_time().isoformat()
    }

# ==================== CORS & APP SETUP ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
