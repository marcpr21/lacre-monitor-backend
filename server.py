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
    "admin": {"id": "1", "username": "admin", "name": "Administrador", "password": "prime123", "role": "admin"},
    "teste": {"id": "2", "username": "teste", "name": "Funcionario Teste", "password": "123456", "role": "employee"}
}

PHOTOS = []

def validate_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token required")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = authorization.replace("Bearer ", "")
    if len(token) < 10:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Extract username from token
    if "jwt-admin-" in token:
        return USERS["admin"]
    elif "jwt-teste-" in token:
        return USERS["teste"]
    else:
        # Fallback - try to find user by checking token content
        for username, user_data in USERS.items():
            if username in token:
                return user_data
        
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/")
async def root():
    current_time = get_brazil_time()
    return {
        "message": "Lacre Monitor API Online", 
        "time": current_time.strftime("%H:%M:%S"),
        "date": current_time.strftime("%d/%m/%Y")
    }

@app.get("/api/health")
async def health():
    return {"status": "healthy", "users": len(USERS), "photos": len(PHOTOS)}

@app.post("/api/users/login")
async def login(user_data: UserLogin):
    print(f"Login attempt for: {user_data.username}")
    
    user = USERS.get(user_data.username)
    if not user:
        print(f"User not found: {user_data.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["password"] != user_data.password:
        print(f"Wrong password for: {user_data.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = f"jwt-{user['username']}-123456789"
    print(f"Login successful for: {user_data.username}")
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"], 
            "name": user["name"],
            "role": user["role"]
        }
    }

@app.post("/api/users/create")
async def create_user(user_data: dict, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        if user_data["username"] in USERS:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        new_id = str(len(USERS) + 1)
        USERS[user_data["username"]] = {
            "id": new_id,
            "username": user_data["username"],
            "name": user_data["name"],
            "password": user_data["password"],
            "role": user_data.get("role", "employee")
        }
        
        print(f"User created: {user_data['username']}")
        return {"message": "User created successfully", "user_id": new_id}
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching users: {e}")
        return []

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, user_data: dict, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
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
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/users/{user_id}/reset-password")
async def reset_password(user_id: str, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        username_to_update = None
        for username, user_info in USERS.items():
            if user_info["id"] == user_id:
                username_to_update = username
                break
        
        if not username_to_update:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_password = "123456"
        USERS[username_to_update]["password"] = new_password
        
        print(f"Password reset for user: {username_to_update}")
        return {"message": "Password reset successfully", "new_password": new_password}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
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
        
        print(f"User deleted: {username_to_delete}")
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/photos/submit")
async def submit_photo(photo_data: PhotoSubmission, authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
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
        print(f"Photo saved - User: {current_user['username']}, Type: {photo_data.photo_type}")
        
        return {"message": "Photo submitted successfully", "photo_id": photo_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting photo: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/photos")
async def get_photos(authorization: str = Header(None)):
    try:
        current_user = validate_token(authorization)
        
        if current_user["role"] == "admin":
            return PHOTOS
        else:
            user_photos = [p for p in PHOTOS if p["employee_id"] == current_user["id"]]
            return user_photos
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching photos: {e}")
        return []

@app.get("/api/users/employees")
async def get_employees(authorization: str = Header(None)):
    try:
        validate_token(authorization)
        employees = [u for u in USERS.values() if u["role"] == "employee"]
        return employees
    except Exception as e:
        print(f"Error fetching employees: {e}")
        return []

@app.get("/api/analytics/missing-photos")
async def get_missing_photos(authorization: str = Header(None)):
    try:
        validate_token(authorization)
        return {
            "period": "Ultimos 30 dias",
            "total_employees": 1,
            "report": [{
                "employee_id": "2",
                "employee_name": "Funcionario Teste",
                "missing_lacres": [],
                "missing_medidor": [],
                "total_missing": 0,
                "overall_compliance": 100.0
            }]
        }
    except Exception as e:
        print(f"Error in analytics: {e}")
        return {"period": "30 dias", "total_employees": 0, "report": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
