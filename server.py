from fastapi import FastAPI, HTTPException, Header
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import base64
from typing import Optional

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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None

# Dados temporários
USERS = {
    "admin": {"id": "1", "username": "admin", "name": "Administrador", "password": "admin123", "role": "admin"},
    "teste": {"id": "2", "username": "teste", "name": "Funcionário Teste", "password": "123456", "role": "employee"}
}

PHOTOS = []

# Função para validar token simples
def validate_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token required")
    
    # Token simples - apenas verificar se existe
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = authorization.replace("Bearer ", "")
    if not token or len(token) < 10:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Retornar usuário baseado no token
    if "admin" in token:
        return USERS["admin"]
    else:
        return USERS["teste"]

# Rotas básicas
@app.get("/")
async def root():
    return {"message": "Lacre Monitor API Online!", "status": "success"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "users": len(USERS), "photos": len(PHOTOS)}

@app.post("/api/users/login")
async def login(user_data: UserLogin):
    print(f"Login attempt: {user_data.username}")
    
    user = USERS.get(user_data.username)
    if not user or user["password"] != user_data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "token": f"fake-jwt-{user['username']}-123456789",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.post("/api/photos/submit")
async def submit_photo(photo_data: PhotoSubmission, authorization: str = Header(None)):
    try:
        print(f"Photo submission attempt - Type: {photo_data.photo_type}")
        
        # Validar token
        current_user = validate_token(authorization)
        print(f"User validated: {current_user['username']}")
        
        # Validar imagem base64 (limite de tamanho)
        try:
            # Verificar se é base64 válido e não muito grande
            image_data = photo_data.image_base64
            if len(image_data) > 10000000:  # 10MB limit
                raise HTTPException(status_code=400, detail="Image too large")
            
            # Tentar decodificar para validar
            if image_data.startswith('data:image'):
                # Remover prefixo se existir
                image_data = image_data.split(',')[1]
            
            base64.b64decode(image_data[:100])  # Testar só o início
            print("Image validation passed")
            
        except Exception as e:
            print(f"Image validation failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        # Criar foto
        photo_id = str(len(PHOTOS) + 1)
        photo = {
            "id": photo_id,
            "employee_id": current_user["id"],
            "employee_name": current_user["name"],
            "photo_type": photo_data.photo_type,
            "image_base64": f"data:image/jpeg;base64,{image_data[:1000]}...",  # Truncar para economizar
            "latitude": photo_data.latitude,
            "longitude": photo_data.longitude,
            "location_name": photo_data.location_name,
            "timestamp": "2024-10-10T10:00:00",
            "scheduled_period": f"{photo_data.photo_type} - Teste"
        }
        
        PHOTOS.append(photo)
        print(f"Photo saved successfully - ID: {photo_id}")
        
        return {"message": "Photo submitted successfully", "photo_id": photo_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/photos")
async def get_photos(authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        print(f"Fetching photos for user: {current_user['username']}")
        
        if current_user["role"] == "admin":
            return PHOTOS
        else:
            user_photos = [p for p in PHOTOS if p["employee_id"] == current_user["id"]]
            return user_photos
            
    except Exception as e:
        print(f"Error fetching photos: {e}")
        return []

@app.get("/api/users/employees")
async def get_employees(authorization: str = Header(None)):
    validate_token(authorization)
    employees = [u for u in USERS.values() if u["role"] == "employee"]
    return employees

@app.get("/api/analytics/missing-photos")
async def get_missing_photos(authorization: str = Header(None)):
    validate_token(authorization)
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
