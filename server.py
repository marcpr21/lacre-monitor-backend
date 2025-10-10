from fastapi import FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Lacre Monitor API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelo
class UserLogin(BaseModel):
    username: str
    password: str

# Usuários temporários (em memória)
USERS = {
    "admin": {
        "id": "1",
        "username": "admin",
        "name": "Administrador",
        "password": "admin123",
        "role": "admin"
    },
    "teste": {
        "id": "2", 
        "username": "teste",
        "name": "Funcionário Teste",
        "password": "123456",
        "role": "employee"
    }
}

# Rotas
@app.get("/")
async def root():
    return {"message": "Lacre Monitor API Online!", "status": "success"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "users_count": len(USERS)}

@app.post("/api/users/login")
async def login(user_data: UserLogin):
    user = USERS.get(user_data.username)
    
    if not user or user["password"] != user_data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "token": "fake-jwt-token-123",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"], 
            "role": user["role"]
        }
    }

@app.get("/api/photos")
async def get_photos():
    return {"photos": [], "message": "No photos yet"}
