from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from zoneinfo import ZoneInfo
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import asyncio

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

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
EMAIL_FROM = os.environ.get('EMAIL_FROM', 'noreply@example.com')
EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'Lacre Monitor')

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== TIMEZONE HELPER ====================

def get_brazil_time():
    """Get current time in Brazil timezone (UTC-3)"""
    return datetime.now(ZoneInfo("America/Sao_Paulo"))

def convert_utc_to_brazil(utc_datetime):
    """Convert UTC datetime to Brazil timezone"""
    if utc_datetime.tzinfo is None:
        # If naive datetime (from MongoDB), assume it's UTC
        utc_datetime = utc_datetime.replace(tzinfo=ZoneInfo("UTC"))
    # Convert to Brazil timezone
    return utc_datetime.astimezone(ZoneInfo("America/Sao_Paulo"))

# ==================== EMAIL HELPER ====================

async def send_email_alert(to_email: str, employee_name: str, photo_type: str, timestamp: datetime):
    """Send email alert when a photo is submitted"""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured, skipping email")
        return False
    
    try:
        # Format photo type for display
        photo_type_display = {
            'lacre': 'Lacre',
            'medidor_manha': 'Medidor Manhã',
            'medidor_tarde': 'Medidor Tarde',
            'medidor': 'Medidor'
        }.get(photo_type, photo_type)
        
        # Format timestamp
        brazil_time = convert_utc_to_brazil(timestamp)
        time_str = brazil_time.strftime('%d/%m/%Y às %H:%M')
        
        # Email content
        subject = f"📸 Nova Foto Enviada - {employee_name}"
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #007AFF; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">🔔 Alerta de Foto</h2>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; color: #333;">Uma nova foto foi enviada:</p>
                <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 8px 0;"><strong>👤 Funcionário:</strong> {employee_name}</p>
                    <p style="margin: 8px 0;"><strong>📷 Tipo de Foto:</strong> {photo_type_display}</p>
                    <p style="margin: 8px 0;"><strong>🕐 Data/Hora:</strong> {time_str}</p>
                </div>
                <p style="font-size: 14px; color: #666; margin-top: 20px;">
                    Este é um alerta automático do Sistema Lacre Monitor.
                </p>
            </div>
        </div>
        """
        
        # Create email
        message = Mail(
            from_email=Email(EMAIL_FROM, EMAIL_FROM_NAME),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", html_content)
        )
        
        # Send email
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = await asyncio.to_thread(sg.send, message)
        
        logger.info(f"Email sent to {to_email} - Status: {response.status_code}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending email to {to_email}: {str(e)}")
        return False

async def check_and_send_alerts(employee_id: str, employee_name: str, photo_type: str, timestamp: datetime):
    """Check email alert configuration and send emails if needed"""
    try:
        # Get email alerts configuration
        config = await db.email_alerts_config.find_one({"_id": "config"})
        
        if not config or not config.get("recipients"):
            return
        
        recipients = config.get("recipients", [])
        
        for recipient in recipients:
            # Skip if recipient is not enabled or has no email
            if not recipient.get("enabled") or not recipient.get("email"):
                continue
            
            # Check if this employee has alerts configured for this recipient
            employee_alerts = recipient.get("employee_alerts", {}).get(employee_id, {})
            alert_all_photos = recipient.get("alert_all_photos", {}).get(employee_id, False)
            
            # Determine if we should send alert
            should_alert = False
            
            if alert_all_photos:
                # If "all photos" is enabled, send alert for any photo type
                should_alert = True
            else:
                # Check specific photo type
                should_alert = employee_alerts.get(photo_type, False)
            
            if should_alert:
                # Send email alert
                await send_email_alert(
                    recipient["email"],
                    employee_name,
                    photo_type,
                    timestamp
                )
                
    except Exception as e:
        logger.error(f"Error checking/sending alerts: {str(e)}")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str = "employee"  # employee or admin
    required_photos: str = "both"  # lacre, medidor, or both

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str
    required_photos: str = "both"

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

def check_photo_schedule(photo_type: str, username: str = None) -> dict:
    """Check if photo can be taken at current time and return schedule info"""
    
    # BYPASS VALIDATION FOR TEST USER
    if username and username.lower() == "teste":
        return {
            "allowed": True,
            "message": "Usuário de teste - horário livre",
            "period": "Teste - qualquer horário",
            "period_code": f"{photo_type}_teste"
        }
    
    now = get_brazil_time()  # Use Brazil timezone (UTC-3)
    weekday = now.weekday()  # 0=Monday, 6=Sunday
    hour = now.hour
    minute = now.minute
    current_time = hour * 60 + minute  # Minutes since midnight
    
    if photo_type == "lacre":
        # Monday(0), Wednesday(2), Friday(4) from 06:00 to 12:00
        if weekday not in [0, 2, 4]:
            return {
                "allowed": False,
                "message": "Fotos de lacre só podem ser tiradas em Segunda, Quarta e Sexta",
                "period": "",
                "period_code": ""
            }
        
        # Check time window: 06:00 to 12:00
        lacre_start = 6 * 60   # 06:00
        lacre_end = 12 * 60    # 12:00
        
        if current_time < lacre_start:  # Before 06:00 AM
            return {
                "allowed": False,
                "message": "Fotos de lacre só podem ser tiradas a partir das 06:00",
                "period": "",
                "period_code": ""
            }
        
        if current_time > lacre_end:  # After 12:00 PM
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
            "period": f"{day_names[weekday]} 06:00-12:00",
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
@api_router.post("/auth/login", response_model=LoginResponse)
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
    # Check for active authorization first
    now = get_brazil_time()
    
    logger.info(f"Photo submit - User: {current_user['username']}, Type: {photo.photo_type}, Employee ID: {current_user['id']}")
    
    # For medidor photos, check both medidor_manha and medidor_tarde authorizations
    if photo.photo_type == "medidor":
        authorization = await db.authorizations.find_one({
            "employee_id": current_user["id"],
            "photo_type": {"$in": ["medidor", "medidor_manha", "medidor_tarde"]},
            "expires_at": {"$gt": now}
        })
        logger.info(f"Medidor authorization check - Found: {authorization is not None}")
    else:
        authorization = await db.authorizations.find_one({
            "employee_id": current_user["id"],
            "photo_type": photo.photo_type,
            "expires_at": {"$gt": now}
        })
        logger.info(f"{photo.photo_type} authorization check - Found: {authorization is not None}")
    
    # If no authorization, check normal schedule
    if not authorization:
        schedule_check = check_photo_schedule(photo.photo_type, current_user["username"])
        
        if not schedule_check["allowed"]:
            raise HTTPException(status_code=400, detail=schedule_check["message"])
    else:
        # Has authorization - create schedule_check with authorization info
        expires_str = authorization["expires_at"].strftime("%d/%m %H:%M")
        schedule_check = {
            "allowed": True,
            "message": f"Autorizado até {expires_str}",
            "period": f"Autorização até {expires_str}",
            "period_code": f"{photo.photo_type}_authorized"
        }
    
    # For lacre photos with location (SKIP FOR TEST USER)
    if photo.photo_type == "lacre" and photo.seal_location_id and current_user["username"].lower() != "teste":
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
    # SKIP THIS CHECK FOR TEST USER
    if photo.photo_type == "medidor" and current_user["username"].lower() != "teste":
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
    
    # DELETE OLD PHOTOS before saving new one (only same specific photo)
    # SKIP DELETION FOR TEST USER - allow unlimited photos for testing
    if current_user["username"].lower() != "teste":
        delete_query = {
            "employee_id": current_user["id"],
            "photo_type": photo.photo_type
        }
        
        # For lacre photos, delete ONLY old photos of SAME location and seal number
        # This allows multiple lacres (different numbers/locations) to coexist
        if photo.photo_type == "lacre":
            if photo.seal_location_id and photo.seal_number:
                # Only delete if same location AND same seal number
                delete_query["seal_location_id"] = photo.seal_location_id
                delete_query["seal_number"] = photo.seal_number
            else:
                # If no location info, don't delete anything (allow multiple photos)
                delete_query = None
        
        # For medidor photos, delete ONLY old photos of SAME period (morning OR afternoon)
        # This allows morning AND afternoon photos to coexist
        elif photo.photo_type == "medidor":
            delete_query["period_code"] = schedule_check["period_code"]
        
        # Delete old photos matching criteria (if any)
        if delete_query:
            delete_result = await db.photos.delete_many(delete_query)
            if delete_result.deleted_count > 0:
                print(f"🗑️ Deleted {delete_result.deleted_count} old photo(s) before saving new one")
    
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
        "timestamp": get_brazil_time(),
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "location_name": photo.location_name,
        "scheduled_period": schedule_check["period"],
        "period_code": schedule_check.get("period_code", ""),
        "seal_location_id": photo.seal_location_id,
        "seal_location_name": seal_location_name,
        "seal_number": photo.seal_number
    }
    
    await db.photos.insert_one(photo_doc)
    
    # Send email alerts (non-blocking)
    asyncio.create_task(check_and_send_alerts(
        current_user["id"],
        current_user["name"],
        photo.photo_type,
        photo_doc["timestamp"]
    ))
    
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
            timestamp=convert_utc_to_brazil(p["timestamp"]),
            latitude=p.get("latitude"),
            longitude=p.get("longitude"),
            location_name=p.get("location_name"),
            scheduled_period=p["scheduled_period"],
            seal_location_id=p.get("seal_location_id"),
            seal_location_name=p.get("seal_location_name"),
            seal_number=p.get("seal_number")
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
    required_photos: Optional[str] = None

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

# Email Alert Configuration Models
class EmailRecipient(BaseModel):
    email: str
    enabled: bool = True
    employee_alerts: Dict[str, Dict[str, bool]] = {}  # {employee_id: {photo_type: bool}}
    alert_all_photos: Dict[str, bool] = {}  # {employee_id: bool} - if True, alerts for all photo types

class EmailAlertsConfig(BaseModel):
    recipients: List[EmailRecipient] = []

# Authorization Model
class Authorization(BaseModel):
    employee_id: str
    photo_type: str
    duration_hours: int = 24

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

# ==================== EMAIL ALERTS ENDPOINTS ====================

@api_router.get("/admin/email-alerts/config")
async def get_email_alerts_config(current_user = Depends(get_current_user)):
    """Get email alerts configuration"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    config = await db.email_alerts_config.find_one({"_id": "config"})
    
    if not config:
        # Return default config with 3 empty recipients
        return {
            "recipients": [
                {"email": "", "enabled": False, "employee_alerts": {}, "alert_all_photos": {}},
                {"email": "", "enabled": False, "employee_alerts": {}, "alert_all_photos": {}},
                {"email": "", "enabled": False, "employee_alerts": {}, "alert_all_photos": {}}
            ]
        }
    
    # Ensure we always return 3 recipients
    recipients = config.get("recipients", [])
    while len(recipients) < 3:
        recipients.append({"email": "", "enabled": False, "employee_alerts": {}, "alert_all_photos": {}})
    
    return {"recipients": recipients[:3]}  # Limit to 3

@api_router.post("/admin/email-alerts/config")
async def save_email_alerts_config(config: EmailAlertsConfig, current_user = Depends(get_current_user)):
    """Save email alerts configuration"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate emails
    for recipient in config.recipients:
        if recipient.enabled and recipient.email:
            if "@" not in recipient.email:
                raise HTTPException(status_code=400, detail=f"Email inválido: {recipient.email}")
    
    # Limit to 3 recipients
    recipients_data = [r.dict() for r in config.recipients[:3]]
    
    await db.email_alerts_config.update_one(
        {"_id": "config"},
        {"$set": {"recipients": recipients_data}},
        upsert=True
    )
    
    return {"success": True, "message": "Configuração salva com sucesso"}

# ==================== AUTHORIZATION ENDPOINTS ====================

@api_router.post("/admin/authorize")
async def authorize_photo(auth: Authorization, current_user = Depends(get_current_user)):
    """Grant temporary photo submission authorization"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify employee exists
    employee = await db.users.find_one({"id": auth.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    
    # Calculate expiration time
    expires_at = get_brazil_time() + timedelta(hours=auth.duration_hours)
    
    # Save authorization
    await db.authorizations.update_one(
        {"employee_id": auth.employee_id, "photo_type": auth.photo_type},
        {"$set": {
            "authorized": True,
            "expires_at": expires_at,
            "authorized_by": current_user["username"],
            "created_at": get_brazil_time()
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Autorização concedida até {expires_at.strftime('%d/%m/%Y %H:%M')}"
    }

@api_router.get("/admin/authorizations")
async def get_authorizations(current_user = Depends(get_current_user)):
    """Get all active authorizations"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = get_brazil_time()
    
    # Get all active authorizations (not expired)
    auths = await db.authorizations.find({
        "expires_at": {"$gt": now}
    }).to_list(length=1000)
    
    # Group by employee
    result = {}
    for auth in auths:
        emp_id = auth["employee_id"]
        if emp_id not in result:
            result[emp_id] = {}
        
        result[emp_id][auth["photo_type"]] = {
            "authorized": auth.get("authorized", True),
            "expires_at": auth["expires_at"].isoformat(),
            "authorized_by": auth.get("authorized_by", "admin")
        }
    
    return {"authorizations": result}

@api_router.get("/my-authorizations")
async def get_my_authorizations(current_user = Depends(get_current_user)):
    """Get current user's active authorizations"""
    now = get_brazil_time()
    
    # Get authorizations for current user
    auths = await db.authorizations.find({
        "employee_id": current_user["id"],
        "expires_at": {"$gt": now}
    }).to_list(length=100)
    
    # Format response
    result = {}
    for auth in auths:
        result[auth["photo_type"]] = {
            "authorized": auth.get("authorized", True),
            "expires_at": auth["expires_at"].isoformat(),
            "authorized_by": auth.get("authorized_by", "admin")
        }
    
    return {"authorizations": result}

@api_router.delete("/admin/authorizations/{employee_id}/{photo_type}")
async def revoke_authorization(employee_id: str, photo_type: str, current_user = Depends(get_current_user)):
    """Revoke authorization for specific employee and photo type"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.authorizations.delete_one({
        "employee_id": employee_id,
        "photo_type": photo_type
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Autorização não encontrada")
    
    return {"success": True, "message": "Autorização revogada"}

# ==================== ANALYTICS/COMPLIANCE ENDPOINTS ====================

@api_router.get("/analytics/missing-photos")
async def get_missing_photos_report(
    current_user = Depends(get_current_user),
    days_back: int = 30
):
    """Get report of missing photos for all employees"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all employees (excluding test user)
    employees = await db.users.find({
        "role": "employee",
        "username": {"$ne": "teste"}
    }).to_list(100)
    
    now = get_brazil_time()
    report = []
    
    for employee in employees:
        employee_id = employee["id"]
        employee_name = employee["name"]
        
        missing_lacres = []
        missing_medidor = []
        
        # Check last N days
        for days_ago in range(days_back):
            check_date = now - timedelta(days=days_ago)
            day_start = check_date.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            weekday = check_date.weekday()
            
            # Check LACRES (Monday=0, Wednesday=2, Friday=4)
            if weekday in [0, 2, 4]:
                # Should have taken lacre photo
                lacre_photos = await db.photos.count_documents({
                    "employee_id": employee_id,
                    "photo_type": "lacre",
                    "timestamp": {"$gte": day_start, "$lt": day_end}
                })
                
                if lacre_photos == 0:
                    missing_lacres.append({
                        "date": day_start.isoformat(),
                        "date_formatted": check_date.strftime("%d/%m/%Y"),
                        "weekday": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][weekday]
                    })
            
            # Check MEDIDOR - Morning and Afternoon
            medidor_manha = await db.photos.count_documents({
                "employee_id": employee_id,
                "photo_type": "medidor",
                "period_code": "medidor_manha",
                "timestamp": {"$gte": day_start, "$lt": day_end}
            })
            
            medidor_tarde = await db.photos.count_documents({
                "employee_id": employee_id,
                "photo_type": "medidor",
                "period_code": "medidor_tarde",
                "timestamp": {"$gte": day_start, "$lt": day_end}
            })
            
            if medidor_manha == 0:
                missing_medidor.append({
                    "date": day_start.isoformat(),
                    "date_formatted": check_date.strftime("%d/%m/%Y"),
                    "period": "Manhã",
                    "weekday": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][weekday]
                })
            
            if medidor_tarde == 0:
                missing_medidor.append({
                    "date": day_start.isoformat(),
                    "date_formatted": check_date.strftime("%d/%m/%Y"),
                    "period": "Tarde",
                    "weekday": ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][weekday]
                })
        
        # Calculate compliance percentage
        expected_lacres = len([d for d in range(days_back) if (now - timedelta(days=d)).weekday() in [0, 2, 4]])
        expected_medidor = days_back * 2  # 2 per day (morning + afternoon)
        
        taken_lacres = expected_lacres - len(missing_lacres)
        taken_medidor = expected_medidor - len(missing_medidor)
        
        lacre_compliance = (taken_lacres / expected_lacres * 100) if expected_lacres > 0 else 100
        medidor_compliance = (taken_medidor / expected_medidor * 100) if expected_medidor > 0 else 100
        
        report.append({
            "employee_id": employee_id,
            "employee_name": employee_name,
            "missing_lacres": missing_lacres,
            "missing_medidor": missing_medidor,
            "total_missing_lacres": len(missing_lacres),
            "total_missing_medidor": len(missing_medidor),
            "total_missing": len(missing_lacres) + len(missing_medidor),
            "lacre_compliance": round(lacre_compliance, 1),
            "medidor_compliance": round(medidor_compliance, 1),
            "overall_compliance": round((lacre_compliance + medidor_compliance) / 2, 1)
        })
    
    # Sort by most missing photos
    report.sort(key=lambda x: x["total_missing"], reverse=True)
    
    return {
        "report": report,
        "period_days": days_back,
        "generated_at": now.isoformat()
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
