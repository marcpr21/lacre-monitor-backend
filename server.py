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

# Configuration
JWT_SECRET = "seu-segredo-jwt-mude-em-producao-12345"
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

# In-memory storage
USERS = {}
PHOTOS = []

# Initialize users with test data
def init_users():
    admin_pw = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
    
    USERS["admin"] = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password": admin_pw,
        "name": "Administrador",
        "role": "admin"
    }
    
    # Create 20 test employees
    employee_names = [
        "Posto Fagundao", "Posto Glamour", "Posto Gloria", "Posto Laranjal",
        "Posto Malvino", "Posto Marclau", "Posto Meia Noite", "Posto ML",
        "Posto Monteiro", "Posto MR", "Posto Pinheirinho", "Posto Planeta",
        "Posto Quintino", "Posto Santa Cruz", "Posto Santa Rosa", "Posto Santissimo",
        "Posto Serraria", "Posto Souza", "Posto Sul", "Posto Vila Nova"
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

# Models
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

# Create app
app = FastAPI(title="Lacre Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
