from fastapi import FastAPI, HTTPException, Header
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
from typing import Optional
from datetime import datetime, timezone, timedelta

BRAZIL_TZ = timezone(timedelta(hours=-3))

def get_brazil_time():
    return datetime.now(BRAZIL_TZ)

app = FastAPI(title="Lacre Monitor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

USERS = {
    "admin": {"id": "1", "username": "admin", "name": "Administrador", "password": "admin123", "role": "admin"},
    "teste": {"id": "2", "username": "teste", "name": "Funcionario Teste", "password": "123456", "role": "employee"}
}

PHOTOS = []

def validate_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    if len(token) < 10:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if "admin" in token:
        return USERS["admin"]
    else:
        return USERS["teste"]

@app.get("/")
async def root():
    return {"message": "API Online", "time": get_brazil_time().strftime("%H:%M")}

@app.post("/api/users/login")
async def login(user_data: UserLogin):
    user = USERS.get(user_data.username)
    if not user or user["password"] != user_data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "token": f"jwt-{user['username']}-123456789",
        "user": {"id": user["id"], "username": user["username"], "name": user["name"], "role": user["role"]}
    }

@app.post("/api/users/create")
async def create_user(user_data: dict, authorization: str = Header(None)):
    current_user = validate_token(authorization)
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    
    if user_data["username"] in USERS:
        raise HTTPException(status_code=400, detail="User exists")
    
    new_id = str(len(USERS) + 1)
    USERS[user_data["username"]] = {
        "id": new_id,
        "username": user_data["username"],
        "name": user_data["name"],
        "password": user_data["password"],
        "role": user_data.get("role", "employee")
    }
    
    return {"message": "User created", "user_id": new_id}

@app.get("/api/users/all")
async def get_all_users(authorization: str = Header(None)):
    validate_token(authorization)
    return [{"id": u["id"], "username": u["username"], "name": u["name"], "role": u["role"]} for u in USERS.values()]

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user_data: dict, authorization: str = Header(None)):
    current_user = validate_token(authorization)
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    
    username_to_update = None
    for username, user_info in USERS.items():
        if user_info["id"] == user_id:
            username_to_update = username
            break
    
    if not username_to_update:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "name" in user_data:
        USERS[username_to_update]["name"] = user_data["name"]
    if "role" in user_data:
        USERS[username_to_update]["role"] = user_data["role"]
    
    return {"message": "User updated successfully"}

@app.put("/api/users/{user_id}/reset-password")
async def reset_password(user_id: str, authorization: str = Header(None)):
    current_user = validate_token(authorization)
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    
    username_to_update = None
    for username, user_info in USERS.items():
        if user_info["id"] == user_id:
            username_to_update = username
            break
    
    if not username_to_update:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_password = "123456"
    USERS[username_to_update]["password"] = new_password
    
    return {"message": "Password reset successfully", "new_password": new_password}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, authorization: str = Header(None)):
    current_user = validate_token(authorization)
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    
    username_to_delete = None
    for username, user_info in USERS.items():
        if user_info["id"] == user_id:
            username_to_delete = username
            break
    
    if not username_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    if USERS[username_to_delete]["role"] == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin")
    
    del USERS[username_to_delete]
    return {"message": "User deleted successfully"}

@app.post("/api/photos/submit")
async def submit_photo(photo_data: PhotoSubmission, authorization: str = Header(None)):
    current_user = validate_token(authorization)
    current_time = get_brazil_time()
    
    photo_id = str(len(PHOTOS) + 1)
    photo = {
        "id": photo_id,
        "employee_id": current_user["id"],
        "employee_name": current_user["name"],
        "photo_type": photo_data.photo_type,
        "image_base64": photo_data.image_base64,
        "timestamp": current_time.isoformat(),
        "scheduled_period": f"{photo_data.photo_type} - {current_time.strftime('%H:%M')}"
    }
    
    PHOTOS.append(photo)
    return {"message": "Photo saved", "photo_id": photo_id}

@app.get("/api/photos")
async def get_photos(authorization: str = Header(None)):
    current_user = validate_token(authorization)
    if current_user["role"] == "admin":
        return PHOTOS
    return [p for p in PHOTOS if p["employee_id"] == current_user["id"]]

@app.get("/api/users/employees")
async def get_employees(authorization: str = Header(None)):
    validate_token(authorization)
    return [u for u in USERS.values() if u["role"] == "employee"]

@app.get("/api/analytics/missing-photos")
async def get_missing_photos(authorization: str = Header(None)):
    validate_token(authorization)
    return {"period": "30 dias", "total_employees": 1, "report": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
