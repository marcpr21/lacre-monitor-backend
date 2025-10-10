from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 1 week

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "employee"  # employee or admin

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
    photo_type: str  # "lacre" or "medidor"
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    seal_location_id: Optional[str] = None  # For lacre photos
    seal_number: Optional[int] = None  # For lacre photos (1, 2, 3, etc.)

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
    scheduled_period: str  # e.g., "Segunda 06:00-12:00"
    seal_location_id: Optional[str] = None
    seal_location_name: Optional[str] = None
    seal_number: Optional[int] = None

class PhotoListResponse(BaseModel):
    photos: List[PhotoResponse]
    total: int

# Seal Location Models
class SealLocation(BaseModel):
    id: str
    name: str
    seal_count: int
    description: Optional[str] = None
    created_at: datetime

class SealLocationCreate(BaseModel):
    name: str
    seal_count: int
    description: Optional[str] = None

class SealLocationUpdate(BaseModel):
    name: Optional[str] = None
    seal_count: Optional[int] = None
    description: Optional[str] = None

# ==================== HELPER FUNCTIONS ====================

def get_brazil_time() -> datetime:
    """Get current time in Brazil timezone (America/Sao_Paulo = UTC-3)"""
    return datetime.now(ZoneInfo("America/Sao_Paulo"))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def check_photo_schedule(photo_type: str) -> dict:
    """Check if photo can be taken at current time and return schedule info"""
    now = get_brazil_time()  # Use Brazil timezone (UTC-3)
    weekday = now.weekday()  # 0=Monday, 6=Sunday
    hour = now.hour
    minute = now.minute
    current_time = hour * 60 + minute  # Minutes since midnight
    
    if photo_type == "lacre":
        # Monday(0), Wednesday(2), Friday(4) until 12:00 PM
        if weekday not in [0, 2, 4]:
            return {
                "allowed": False,
                "message": "Fotos de lacre só podem ser tiradas em Segunda, Quarta e Sexta",
                "period": "",
                "period_code": ""
            }
        
        if current_time > 12 * 60:  # After 12:00 PM
            return {
                "allowed": False,
                "message": "Fotos de lacre devem ser tiradas até 12:00",
                "period": "",
                "period_code": ""
            }
        
        day_names = {0: "Segunda", 2: "Quarta", 4: "Sexta"}
        return {
            "allowed": True,
            "message": "Horário válido",
            "period": f"{day_names[weekday]} até 12:00",
            "period_code": f"lacre_{weekday}"
        }
    
    elif photo_type == "medidor":
        # Daily, twice: 06:00-09:00 (morning) and 17:00-18:00 (afternoon)
        morning_start = 6 * 60  # 06:00
        morning_end = 9 * 60    # 09:00
        evening_start = 17 * 60 # 17:00
        evening_end = 18 * 60   # 18:00
        
        if morning_start <= current_time <= morning_end:
            return {
                "allowed": True,
                "message": "Horário válido - Período manhã",
                "period": "Manhã 06:00-09:00",
                "period_code": "medidor_manha"
            }
        elif evening_start <= current_time <= evening_end:
            return {
                "allowed": True,
                "message": "Horário válido - Período tarde",
                "period": "Tarde 17:00-18:00",
                "period_code": "medidor_tarde"
            }
        else:
            return {
                "allowed": False,
                "message": "Fotos de medidor devem ser tiradas entre 06:00-09:00 (manhã) ou 17:00-18:00 (tarde)",
                "period": "",
                "period_code": ""
            }
    
    return {"allowed": False, "message": "Tipo de foto inválido", "period": "", "period_code": ""}

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Photo Monitoring API", "version": "1.0"}

# User Registration (Admin can create employees)
@api_router.post("/users/register", response_model=UserResponse)
async def register_user(user: UserCreate):
    # Check if username exists
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user.password)
    
    user_doc = {
        "id": user_id,
        "username": user.username,
        "password": hashed_pw,
        "name": user.name,
        "role": user.role,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_id,
        username=user.username,
        name=user.name,
        role=user.role
    )

# User Login
@api_router.post("/users/login", response_model=LoginResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_token(user["id"], user["username"], user["role"])
    
    return LoginResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            name=user["name"],
            role=user["role"]
        )
    )

# Get current user info
@api_router.get("/users/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        name=current_user["name"],
        role=current_user["role"]
    )

# Submit Photo
@api_router.post("/photos/submit")
async def submit_photo(photo: PhotoSubmit, current_user = Depends(get_current_user)):
    # Check schedule
    schedule_check = check_photo_schedule(photo.photo_type)
    
    if not schedule_check["allowed"]:
        raise HTTPException(status_code=400, detail=schedule_check["message"])
    
    # For lacre photos with location
    if photo.photo_type == "lacre" and photo.seal_location_id:
        # Verify location exists
        location = await db.seal_locations.find_one({"id": photo.seal_location_id})
        if not location:
            raise HTTPException(status_code=404, detail="Local não encontrado")
        
        # Verify seal number is valid
        if not photo.seal_number or photo.seal_number < 1 or photo.seal_number > location["seal_count"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Número do lacre inválido. Deve ser entre 1 e {location['seal_count']}"
            )
        
        # Check if this specific seal was already photographed today (Brazil time)
        today_start = get_brazil_time().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        existing_photo = await db.photos.find_one({
            "employee_id": current_user["id"],
            "photo_type": "lacre",
            "seal_location_id": photo.seal_location_id,
            "seal_number": photo.seal_number,
            "timestamp": {
                "$gte": today_start,
                "$lt": today_end
            }
        })
        
        if existing_photo:
            raise HTTPException(
                status_code=400, 
                detail=f"Você já fotografou o lacre #{photo.seal_number} de {location['name']} hoje"
            )
    
    # For medidor photos, check if user already submitted for this period today
    if photo.photo_type == "medidor":
        today_start = get_brazil_time().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        existing_photo = await db.photos.find_one({
            "employee_id": current_user["id"],
            "photo_type": "medidor",
            "period_code": schedule_check["period_code"],
            "timestamp": {
                "$gte": today_start,
                "$lt": today_end
            }
        })
        
        if existing_photo:
            period_name = "manhã" if schedule_check["period_code"] == "medidor_manha" else "tarde"
            raise HTTPException(
                status_code=400, 
                detail=f"Você já enviou a foto do medidor do período da {period_name} hoje"
            )
    
    photo_id = str(uuid.uuid4())
    
    # Get seal location name if applicable
    seal_location_name = None
    if photo.photo_type == "lacre" and photo.seal_location_id:
        location = await db.seal_locations.find_one({"id": photo.seal_location_id})
        seal_location_name = location["name"] if location else None
    
    photo_doc = {
        "id": photo_id,
        "employee_id": current_user["id"],
        "employee_name": current_user["name"],
        "photo_type": photo.photo_type,
        "image_base64": photo.image_base64,
        "timestamp": datetime.utcnow(),
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "location_name": photo.location_name,
        "scheduled_period": schedule_check["period"],
        "period_code": schedule_check.get("period_code", ""),
        "seal_location_id": photo.seal_location_id,
        "seal_location_name": seal_location_name,
        "seal_number": photo.seal_number,
        "expires_at": datetime.utcnow() + timedelta(days=15)  # Auto-delete after 15 days
    }
    
    await db.photos.insert_one(photo_doc)
    
    message = "Foto enviada com sucesso!"
    if photo.photo_type == "lacre" and seal_location_name and photo.seal_number:
        message = f"Lacre #{photo.seal_number} de {seal_location_name} fotografado!"
    
    return {
        "success": True,
        "photo_id": photo_id,
        "message": message,
        "period": schedule_check["period"]
    }

# Get Photos (for Admin)
@api_router.get("/photos", response_model=PhotoListResponse)
async def get_photos(
    current_user = Depends(get_current_user),
    employee_id: Optional[str] = None,
    photo_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
):
    # Only admins can view all photos
    if current_user["role"] != "admin":
        # Employees can only see their own photos
        employee_id = current_user["id"]
    
    # Build query
    query = {}
    
    if employee_id:
        query["employee_id"] = employee_id
    
    if photo_type:
        query["photo_type"] = photo_type
    
    if start_date:
        if "timestamp" not in query:
            query["timestamp"] = {}
        query["timestamp"]["$gte"] = datetime.fromisoformat(start_date)
    
    if end_date:
        if "timestamp" not in query:
            query["timestamp"] = {}
        query["timestamp"]["$lte"] = datetime.fromisoformat(end_date)
    
    # Get photos
    photos = await db.photos.find(query).sort("timestamp", -1).limit(limit).to_list(limit)
    
    photo_list = [
        PhotoResponse(
            id=p["id"],
            employee_id=p["employee_id"],
            employee_name=p["employee_name"],
            photo_type=p["photo_type"],
            image_base64=p["image_base64"],
            timestamp=p["timestamp"],
            latitude=p.get("latitude"),
            longitude=p.get("longitude"),
            location_name=p.get("location_name"),
            scheduled_period=p["scheduled_period"]
        )
        for p in photos
    ]
    
    return PhotoListResponse(photos=photo_list, total=len(photo_list))

# Check schedule (for frontend to show what's due)
@api_router.get("/photos/check-schedule")
async def check_schedule(photo_type: str):
    schedule_info = check_photo_schedule(photo_type)
    return schedule_info

# Get all employees (for admin)
@api_router.get("/users/employees", response_model=List[UserResponse])
async def get_employees(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    employees = await db.users.find({"role": "employee"}).to_list(100)
    
    return [
        UserResponse(
            id=e["id"],
            username=e["username"],
            name=e["name"],
            role=e["role"]
        )
        for e in employees
    ]

# Get all users (for admin)
@api_router.get("/users/all", response_model=List[UserResponse])
async def get_all_users(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}).to_list(1000)
    
    return [
        UserResponse(
            id=u["id"],
            username=u["username"],
            name=u["name"],
            role=u["role"]
        )
        for u in users
    ]

# Create user (admin only)
@api_router.post("/users/create", response_model=UserResponse)
async def create_user(user: UserCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username exists
    existing = await db.users.find_one({"username": user.username})
    if existing:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user.password)
    
    user_doc = {
        "id": user_id,
        "username": user.username,
        "password": hashed_pw,
        "name": user.name,
        "role": user.role,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_id,
        username=user.username,
        name=user.name,
        role=user.role
    )

# Update user (admin only)
class UserUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, updates: UserUpdate, current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Check if new username already exists
    if updates.username and updates.username != user["username"]:
        existing = await db.users.find_one({"username": updates.username})
        if existing:
            raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    
    update_data = {}
    if updates.name:
        update_data["name"] = updates.name
    if updates.username:
        update_data["username"] = updates.username
    if updates.role:
        update_data["role"] = updates.role
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
        user.update(update_data)
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        name=user["name"],
        role=user["role"]
    )

# Reset password (admin only)
class PasswordReset(BaseModel):
    new_password: str

@api_router.put("/users/{user_id}/reset-password")
async def reset_password(user_id: str, reset_data: PasswordReset, current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    hashed_pw = hash_password(reset_data.new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"password": hashed_pw}})
    
    return {"success": True, "message": "Senha alterada com sucesso"}

# Delete user (admin only)
@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Cannot delete yourself
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Você não pode deletar sua própria conta")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Delete user's photos
    await db.photos.delete_many({"employee_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"success": True, "message": "Usuário deletado com sucesso"}

# Cleanup expired photos (can be called by cron job)
@api_router.post("/photos/cleanup")
async def cleanup_expired_photos(current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.photos.delete_many({"expires_at": {"$lt": datetime.utcnow()}})
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "message": f"{result.deleted_count} fotos expiradas foram deletadas"
    }

# ==================== SEAL LOCATIONS ENDPOINTS ====================

# Get all seal locations
@api_router.get("/seal-locations", response_model=List[SealLocation])
async def get_seal_locations(current_user = Depends(get_current_user)):
    locations = await db.seal_locations.find({}).to_list(1000)
    
    return [
        SealLocation(
            id=loc["id"],
            name=loc["name"],
            seal_count=loc["seal_count"],
            description=loc.get("description"),
            created_at=loc["created_at"]
        )
        for loc in locations
    ]

# Create seal location (admin only)
@api_router.post("/seal-locations", response_model=SealLocation)
async def create_seal_location(location: SealLocationCreate, current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if location name exists
    existing = await db.seal_locations.find_one({"name": location.name})
    if existing:
        raise HTTPException(status_code=400, detail="Já existe um local com este nome")
    
    location_id = str(uuid.uuid4())
    
    location_doc = {
        "id": location_id,
        "name": location.name,
        "seal_count": location.seal_count,
        "description": location.description,
        "created_at": datetime.utcnow()
    }
    
    await db.seal_locations.insert_one(location_doc)
    
    return SealLocation(**location_doc)

# Update seal location (admin only)
@api_router.put("/seal-locations/{location_id}", response_model=SealLocation)
async def update_seal_location(
    location_id: str, 
    updates: SealLocationUpdate, 
    current_user = Depends(get_current_user)
):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    location = await db.seal_locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Local não encontrado")
    
    # Check if new name already exists
    if updates.name and updates.name != location["name"]:
        existing = await db.seal_locations.find_one({"name": updates.name})
        if existing:
            raise HTTPException(status_code=400, detail="Já existe um local com este nome")
    
    update_data = {}
    if updates.name:
        update_data["name"] = updates.name
    if updates.seal_count is not None:
        update_data["seal_count"] = updates.seal_count
    if updates.description is not None:
        update_data["description"] = updates.description
    
    if update_data:
        await db.seal_locations.update_one({"id": location_id}, {"$set": update_data})
        location.update(update_data)
    
    return SealLocation(
        id=location["id"],
        name=location["name"],
        seal_count=location["seal_count"],
        description=location.get("description"),
        created_at=location["created_at"]
    )

# Delete seal location (admin only)
@api_router.delete("/seal-locations/{location_id}")
async def delete_seal_location(location_id: str, current_user = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    location = await db.seal_locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Local não encontrado")
    
    # Delete all photos from this location
    await db.photos.delete_many({"seal_location_id": location_id})
    
    # Delete location
    await db.seal_locations.delete_one({"id": location_id})
    
    return {"success": True, "message": "Local deletado com sucesso"}

# Get seal photo progress for today
@api_router.get("/seal-locations/progress/today")
async def get_seal_progress_today(current_user = Depends(get_current_user)):
    # Get all locations
    locations = await db.seal_locations.find({}).to_list(1000)
    
    # Get today's start and end
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    progress = []
    
    for loc in locations:
        # Count photos taken today for this location by current user
        photo_count = await db.photos.count_documents({
            "employee_id": current_user["id"],
            "photo_type": "lacre",
            "seal_location_id": loc["id"],
            "timestamp": {
                "$gte": today_start,
                "$lt": today_end
            }
        })
        
        progress.append({
            "location_id": loc["id"],
            "location_name": loc["name"],
            "total_seals": loc["seal_count"],
            "photographed": photo_count,
            "remaining": max(0, loc["seal_count"] - photo_count),
            "completed": photo_count >= loc["seal_count"]
        })
    
    return progress

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
