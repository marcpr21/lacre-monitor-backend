from fastapi import FastAPI, HTTPException, Header
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import base64
from typing import Optional
from datetime import datetime, timezone, timedelta

# Timezone do Brasil (UTC-3)
BRAZIL_TZ = timezone(timedelta(hours=-3))

def get_brazil_time():
    """Retorna o horário atual do Brasil (UTC-3)"""
    return datetime.now(BRAZIL_TZ)

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
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = authorization.replace("Bearer ", "")
    if not token or len(token) < 10:
        raise HTTPException(status_code=401, detail="Invalid token")
@app.post("/api/users/create")
async def create_user(user_data: dict, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        # Only admins can create users
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Check if username already exists
        if user_data["username"] in USERS:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Create new user
        new_user_id = str(len(USERS) + 1)
        USERS[user_data["username"]] = {
            "id": new_user_id,
            "username": user_data["username"],
            "name": user_data["name"],
            "password": user_data["password"],
            "role": user_data.get("role", "employee")
        }
        
        print(f"User created: {user_data['username']}")
        
        return {"message": "User created successfully", "user_id": new_user_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/users/all")
async def get_all_users(authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        users_list = []
        for username, user_data in USERS.items():
            users_list.append({
                "id": user_data["id"],
                "username": user_data["username"], 
                "name": user_data["name"],
                "role": user_data["role"]
            })
        
        return users_list
        
    except Exception as e:
        print(f"Error fetching users: {e}")
        return []

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user_data: dict, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Find user by ID
        user_to_update = None
        username_to_update = None
        
        for username, user_info in USERS.items():
            if user_info["id"] == user_id:
                user_to_update = user_info
                username_to_update = username
                break
        
        if not user_to_update:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user data
        if "name" in user_data:
            USERS[username_to_update]["name"] = user_data["name"]
        if "role" in user_data:
            USERS[username_to_update]["role"] = user_data["role"]
        
        return {"message": "User updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Find and delete user by ID
        username_to_delete = None
        
        for username, user_info in USERS.items():
            if user_info["id"] == user_id:
                username_to_delete = username
                break
        
        if not username_to_delete:
            raise HTTPException(status_code=404, detail="User not found")
        
        if USERS[username_to_delete]["role"] == "admin":
            raise HTTPException(status_code=400, detail="Cannot delete admin user")
        
        del USERS[username_to_delete]
        
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")    
    if "admin" in token:
        return USERS["admin"]
    else:
        return USERS["teste"]

# Rotas básicas
@app.get("/")
async def root():
    current_time = get_brazil_time()
    return {
        "message": "Lacre Monitor API Online!", 
        "status": "success",
        "brazil_time": current_time.strftime("%H:%M:%S %d/%m/%Y")
    }

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
        
        # Validar imagem base64
        try:
            image_data = photo_data.image_base64
            if len(image_data) > 10000000:  # 10MB limit
                raise HTTPException(status_code=400, detail="Image too large")
            
            if image_data.startswith('data:image'):
                base64_data = image_data.split(',')[1]
            else:
                base64_data = image_data
            
            base64.b64decode(base64_data[:100])  # Test decode
            print("Image validation passed")
            
        except Exception as e:
            print(f"Image validation failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        # Criar foto com horário atual do Brasil
        current_time = get_brazil_time()
        photo_id = str(len(PHOTOS) + 1)
        
        photo = {
            "id": photo_id,
            "employee_id": current_user["id"],
            "employee_name": current_user["name"],
            "photo_type": photo_data.photo_type,
            "image_base64": photo_data.image_base64,
            "latitude": photo_data.latitude,
            "longitude": photo_data.longitude,
            "location_name": photo_data.location_name,
            "timestamp": current_time.isoformat(),
            "scheduled_period": f"{photo_data.photo_type} - {current_time.strftime('%H:%M')}"
        }
        
        PHOTOS.append(photo)
        print(f"Photo saved successfully - ID: {photo_id}, Brazil Time: {current_time.strftime('%H:%M:%S')}")
        
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
