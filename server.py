from fastapi import FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pydantic import BaseModel
import bcrypt
import jwt
from datetime import datetime, timedelta

# Configurações
mongo_url = os.environ.get('MONGODB_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('MONGODB_DATABASE', 'lacre_monitor')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret-key')

# Conectar MongoDB
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# App FastAPI
app = FastAPI(title="Lacre Monitor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos
class UserLogin(BaseModel):
    username: str
    password: str

# Rotas
@app.get("/")
async def root():
    return {"message": "Lacre Monitor API is running"}

@app.get("/api/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/users/login")
async def login(user_data: UserLogin):
    # Buscar usuário
    user = await db.users.find_one({"username": user_data.username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verificar senha
    if not bcrypt.checkpw(user_data.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Criar token
    payload = {
        "user_id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(hours=168)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"], 
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.on_event("startup")
async def startup():
    print("API Started")

@app.on_event("shutdown") 
async def shutdown():
    client.close()
