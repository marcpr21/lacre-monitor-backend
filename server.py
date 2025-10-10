from fastapi import FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Criar a aplicação FastAPI
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

class PhotoSubmission(BaseModel):
    employee_id: str
    photo_type: str
    image_base64: str
    latitude: float = None
    longitude: float = None
    location_name: str = None

# Dados temporários
USERS = {
    "admin": {"id": "1", "username": "admin", "name": "Administrador", "password": "admin123", "role": "admin"},
    "teste": {"id": "2", "username": "teste", "name": "Funcionário Teste", "password": "123456", "role": "employee"}
}

PHOTOS = []

# Rotas básicas
@app.get("/")
async def root():
    return {"message": "Lacre Monitor API Online!", "status": "success"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "users": len(USERS), "photos": len(PHOTOS)}

@app.post("/api/users/login")
async def login(user_data: UserLogin):
    user = USERS.get(user_data.username)
    if not user or user["password"] != user_data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "token": f"fake-jwt-{user['username']}-123",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.post("/api/photos/submit")
async def submit_photo(photo_data: PhotoSubmission):
    photo = {
        "id": str(len(PHOTOS) + 1),
        "employee_id": photo_data.employee_id,
        "photo_type": photo_data.photo_type,
        "image_base64": photo_data.image_base64,
        "latitude": photo_data.latitude,
        "longitude": photo_data.longitude,
        "location_name": photo_data.location_name,
        "timestamp": "2024-10-10T10:00:00"
    }
    PHOTOS.append(photo)
    return {"message": "Photo submitted successfully", "photo_id": photo["id"]}

@app.get("/api/photos")
async def get_photos():
    return PHOTOS

@app.get("/api/users/employees")
async def get_employees():
    employees = [u for u in USERS.values() if u["role"] == "employee"]
    return employees

@app.get("/api/analytics/missing-photos")
async def get_missing_photos():
    return {
        "period": "Últimos 30 dias",
        "total_employees": 1,
        "report": [
            {
                "employee_id": "2",
                "employee_name": "Funcionário Teste",
                "missing_lacres": [],
                "missing_medidor": [],
                "total_missing": 0,
                "overall_compliance": 100.0
            }
        ]
    }

