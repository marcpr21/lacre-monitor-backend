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
mongo_url = os.environ.get('MONGODB_URL', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db_name = os.environ.get('MONGODB_DATABASE', os.environ.get('DB_NAME', 'lacre_monitor'))
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 1 week

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Lacre Monitor API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router with prefix
router = APIRouter(prefix="/api")

def get_brazil_time():
    """Get current time in Brazil timezone (UTC-3)"""
    return datetime.now(ZoneInfo("America/Sao_Paulo"))

# Pydantic models
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    name: str
    password: str
    role: str = "employee"
    locations: Optional[List[str]] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    locations: Optional[List[str]] = None

class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    role: str
    locations: List[str]
    created_at: datetime

class PhotoSubmission(BaseModel):
    employee_id: str
    photo_type: str  # 'lacre' or 'medidor'
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
    scheduled_period: Optional[str] = None

class SealLocationCreate(BaseModel):
    name: str
    description: Optional[str] = None

class SealLocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class NotificationRegistration(BaseModel):
    user_id: str
    expo_push_token: str

# Authentication functions
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def check_photo_schedule(photo_type: str, current_time: datetime, username: str = None):
    """Check if photo can be taken based on schedule"""
    
    # Always allow for teste user
    if username == "teste":
        return {"allowed": True, "period": "teste"}
    
    # Convert to Brazil timezone for checking
    br_time = current_time.astimezone(ZoneInfo("America/Sao_Paulo"))
    current_hour = br_time.hour
    current_weekday = br_time.weekday()  # Monday = 0, Sunday = 6
    
    if photo_type == "lacre":
        # Lacres: Monday, Wednesday, Friday (0, 2, 4) between 06:00-12:00
        allowed_weekdays = [0, 2, 4]  # Mon, Wed, Fri
        if current_weekday in allowed_weekdays and 6 <= current_hour < 12:
            return {"allowed": True, "period": f"Lacre - {br_time.strftime('%A')"}
        else:
            return {"allowed": False, "reason": "Lacres só podem ser fotografados às segundas, quartas e sextas-feiras entre 06:00 e 12:00"}
    
    elif photo_type == "medidor":
        # Medidores: Daily, twice (morning: 06:00-09:00, evening: 17:00-18:00)
        if 6 <= current_hour < 9:
            return {"allowed": True, "period": "Medidor - Manhã"}
        elif 17 <= current_hour < 18:
            return {"allowed": True, "period": "Medidor - Tarde"}
        else:
            return {"allowed": False, "reason": "Medidores só podem ser fotografados das 06:00-09:00 ou 17:00-18:00"}
    
    return {"allowed": False, "reason": "Tipo de foto inválido"}

# API Routes
@router.post("/users/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(user_data.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT token
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"]
        }
    }

@router.post("/photos/submit")
async def submit_photo(photo_data: PhotoSubmission, current_user: dict = Depends(get_current_user)):
    current_time = get_brazil_time()
    
    # Check schedule (skip for admin)
    if current_user["role"] != "admin":
        schedule_check = check_photo_schedule(photo_data.photo_type, current_time, current_user["username"])
        
        if not schedule_check["allowed"]:
            raise HTTPException(status_code=400, detail=schedule_check["reason"])
    else:
        schedule_check = {"period": "Admin Override"}
    
    # For non-teste users, remove existing photos of the same type and period
    if current_user["username"] != "teste":
        # Define the period for deletion logic
        if photo_data.photo_type == "lacre":
            # For lacres, delete any existing lacre photo from today
            today_start = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = current_time.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            await db.photos.delete_many({
                "employee_id": current_user["id"],
                "photo_type": "lacre",
                "timestamp": {"$gte": today_start, "$lt": today_end}
            })
        
        elif photo_data.photo_type == "medidor":
            # For medidor, delete existing photo from the same period (morning/afternoon)
            current_hour = current_time.hour
            if 6 <= current_hour < 9:
                period = "Medidor - Manhã"
            elif 17 <= current_hour < 18:
                period = "Medidor - Tarde"
            else:
                period = schedule_check.get("period", "Unknown")
            
            # Delete existing medidor photos from the same period today
            today_start = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = current_time.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            await db.photos.delete_many({
                "employee_id": current_user["id"],
                "photo_type": "medidor",
                "scheduled_period": period,
                "timestamp": {"$gte": today_start, "$lt": today_end}
            })
    
    # Create new photo document
    photo = {
        "id": str(uuid.uuid4()),
        "employee_id": current_user["id"],
        "employee_name": current_user["name"],
        "photo_type": photo_data.photo_type,
        "image_base64": photo_data.image_base64,
        "timestamp": current_time,
        "latitude": photo_data.latitude,
        "longitude": photo_data.longitude,
        "location_name": photo_data.location_name,
        "scheduled_period": schedule_check.get("period")
    }
    
    await db.photos.insert_one(photo)
    
    return {"message": "Photo submitted successfully", "photo_id": photo["id"]}

@router.get("/photos", response_model=List[PhotoResponse])
async def get_photos(
    current_user: dict = Depends(get_current_user),
    limit: int = 100
):
    if current_user["role"] == "admin":
        # Admin can see all photos
        cursor = db.photos.find().sort("timestamp", -1).limit(limit)
    else:
        # Employees can only see their own photos
        cursor = db.photos.find({"employee_id": current_user["id"]}).sort("timestamp", -1).limit(limit)
    
    photos = await cursor.to_list(length=limit)
    
    return [
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
            scheduled_period=p.get("scheduled_period")
        )
        for p in photos
    ]

@router.get("/users/employees", response_model=List[UserResponse])
async def get_employees(current_user: dict = Depends(get_admin_user)):
    cursor = db.users.find({"role": "employee"}).sort("name", 1)
    employees = await cursor.to_list(length=None)
    
    return [
        UserResponse(
            id=e["id"],
            username=e["username"],
            name=e["name"],
            role=e["role"],
            locations=e.get("locations", []),
            created_at=e["created_at"]
        )
        for e in employees
    ]

@router.get("/users/all", response_model=List[UserResponse])
async def get_all_users(current_user: dict = Depends(get_admin_user)):
    cursor = db.users.find().sort("name", 1)
    users = await cursor.to_list(length=None)
    
    return [
        UserResponse(
            id=u["id"],
            username=u["username"],
            name=u["name"],
            role=u["role"],
            locations=u.get("locations", []),
            created_at=u["created_at"]
        )
        for u in users
    ]

@router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_admin_user)):
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user document
    user = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "name": user_data.name,
        "password": hashed_password.decode('utf-8'),
        "role": user_data.role,
        "locations": user_data.locations or [],
        "created_at": get_brazil_time()
    }
    
    await db.users.insert_one(user)
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        name=user["name"],
        role=user["role"],
        locations=user["locations"],
        created_at=user["created_at"]
    )

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    update_data = {}
    if user_data.name is not None:
        update_data["name"] = user_data.name
    if user_data.locations is not None:
        update_data["locations"] = user_data.locations
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
        user.update(update_data)
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        name=user["name"],
        role=user["role"],
        locations=user["locations"],
        created_at=user["created_at"]
    )

@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow deleting admin user
    if user["role"] == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    
    await db.users.delete_one({"id": user_id})
    return {"message": "User deleted successfully"}

@router.put("/users/{user_id}/reset-password")
async def reset_password(user_id: str, current_user: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Reset password to "123456"
    new_password = "123456"
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    
    await db.users.update_one(
        {"id": user_id}, 
        {"$set": {"password": hashed_password.decode('utf-8')}}
    )
    
    return {"message": "Password reset successfully", "new_password": new_password}

@router.get("/analytics/missing-photos")
async def get_missing_photos_report(
    days_back: int = 30,
    current_user: dict = Depends(get_admin_user)
):
    """Generate compliance report showing missing photos by employee"""
    
    # Calculate date range
    end_date = get_brazil_time()
    start_date = end_date - timedelta(days=days_back)
    
    # Get all employees (excluding admin and teste user for reporting)
    employees_cursor = db.users.find({
        "role": "employee", 
        "username": {"$ne": "teste"}  # Exclude teste user from compliance reports
    })
    employees = await employees_cursor.to_list(length=None)
    
    report = []
    
    for employee in employees:
        employee_report = {
            "employee_id": employee["id"],
            "employee_name": employee["name"],
            "missing_lacres": [],
            "missing_medidor": [],
            "total_missing_lacres": 0,
            "total_missing_medidor": 0,
            "total_missing": 0,
            "lacre_compliance": 100.0,
            "medidor_compliance": 100.0,
            "overall_compliance": 100.0
        }
        
        # Check each day in the date range
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        total_lacre_days = 0
        total_medidor_periods = 0
        
        while current_date <= end_date_only:
            weekday = current_date.weekday()  # Monday = 0
            
            # Check lacres (Mon, Wed, Fri)
            if weekday in [0, 2, 4]:  # Mon, Wed, Fri
                total_lacre_days += 1
                
                # Check if lacre photo exists for this day
                day_start = datetime.combine(current_date, datetime.min.time()).replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
                day_end = datetime.combine(current_date, datetime.max.time()).replace(tzinfo=ZoneInfo("America/Sao_Paulo"))
                
                lacre_photo = await db.photos.find_one({
                    "employee_id": employee["id"],
                    "photo_type": "lacre",
                    "timestamp": {"$gte": day_start, "$lte": day_end}
                })
                
                if not lacre_photo:
                    employee_report["missing_lacres"].append({
                        "date": current_date.isoformat(),
                        "date_formatted": current_date.strftime("%d/%m/%Y"),
                        "weekday": current_date.strftime("%A")
                    })
            
            # Check medidores (daily, twice)
            total_medidor_periods += 2  # Morning and evening
            
            # Morning period (06:00-09:00)
            morning_start = datetime.combine(current_date, datetime.min.time()).replace(hour=6, tzinfo=ZoneInfo("America/Sao_Paulo"))
            morning_end = datetime.combine(current_date, datetime.min.time()).replace(hour=8, minute=59, tzinfo=ZoneInfo("America/Sao_Paulo"))
            
            morning_photo = await db.photos.find_one({
                "employee_id": employee["id"],
                "photo_type": "medidor",
                "timestamp": {"$gte": morning_start, "$lte": morning_end}
            })
            
            if not morning_photo:
                employee_report["missing_medidor"].append({
                    "date": current_date.isoformat(),
                    "date_formatted": current_date.strftime("%d/%m/%Y"),
                    "period": "Manhã",
                    "weekday": current_date.strftime("%A")
                })
            
            # Evening period (17:00-18:00)
            evening_start = datetime.combine(current_date, datetime.min.time()).replace(hour=17, tzinfo=ZoneInfo("America/Sao_Paulo"))
            evening_end = datetime.combine(current_date, datetime.min.time()).replace(hour=17, minute=59, tzinfo=ZoneInfo("America/Sao_Paulo"))
            
            evening_photo = await db.photos.find_one({
                "employee_id": employee["id"],
                "photo_type": "medidor",
                "timestamp": {"$gte": evening_start, "$lte": evening_end}
            })
            
            if not evening_photo:
                employee_report["missing_medidor"].append({
                    "date": current_date.isoformat(),
                    "date_formatted": current_date.strftime("%d/%m/%Y"),
                    "period": "Tarde",
                    "weekday": current_date.strftime("%A")
                })
            
            current_date += timedelta(days=1)
        
        # Calculate totals and compliance percentages
        employee_report["total_missing_lacres"] = len(employee_report["missing_lacres"])
        employee_report["total_missing_medidor"] = len(employee_report["missing_medidor"])
        employee_report["total_missing"] = employee_report["total_missing_lacres"] + employee_report["total_missing_medidor"]
        
        # Calculate compliance percentages
        if total_lacre_days > 0:
            employee_report["lacre_compliance"] = round(
                ((total_lacre_days - employee_report["total_missing_lacres"]) / total_lacre_days) * 100, 1
            )
        
        if total_medidor_periods > 0:
            employee_report["medidor_compliance"] = round(
                ((total_medidor_periods - employee_report["total_missing_medidor"]) / total_medidor_periods) * 100, 1
            )
        
        total_expected = total_lacre_days + total_medidor_periods
        if total_expected > 0:
            employee_report["overall_compliance"] = round(
                ((total_expected - employee_report["total_missing"]) / total_expected) * 100, 1
            )
        
        report.append(employee_report)
    
    # Sort by overall compliance (worst first)
    report.sort(key=lambda x: x["overall_compliance"])
    
    return {
        "period": f"Últimos {days_back} dias",
        "start_date": start_date.date().isoformat(),
        "end_date": end_date.date().isoformat(), 
        "total_employees": len(report),
        "report": report
    }

@router.post("/notifications/register")
async def register_for_notifications(
    notification_data: NotificationRegistration,
    current_user: dict = Depends(get_current_user)
):
    """Register user for push notifications"""
    
    # Store or update the push token
    await db.push_tokens.update_one(
        {"user_id": notification_data.user_id},
        {
            "$set": {
                "user_id": notification_data.user_id,
                "expo_push_token": notification_data.expo_push_token,
                "updated_at": get_brazil_time()
            }
        },
        upsert=True
    )
    
    return {"message": "Notification registration successful"}

# Health check
@router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": get_brazil_time()}

# Include router in app
app.include_router(router)

# Startup event
@app.on_event("startup")
async def startup_db_client():
    logger.info("Connected to MongoDB")

# Shutdown event  
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
