import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
mongo_url = os.environ.get('MONGODB_URL', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db_name = os.environ.get('MONGODB_DATABASE', os.environ.get('DB_NAME', 'lacre_monitor'))
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

async def create_admin_user():
    """Create admin user if not exists"""
    try:
        # Check if admin user already exists
        existing_admin = await db.users.find_one({"username": "admin"})
        if existing_admin:
            print("Admin user already exists")
            return

        # Create admin user
        hashed_password = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt())
        admin_user = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "name": "Administrador",
            "password": hashed_password.decode('utf-8'),
            "role": "admin",
            "created_at": datetime.utcnow(),
            "locations": []
        }
        
        await db.users.insert_one(admin_user)
        print("✅ Admin user created successfully")

        # Create test employee user
        existing_test = await db.users.find_one({"username": "teste"})
        if not existing_test:
            hashed_test_password = bcrypt.hashpw("123456".encode('utf-8'), bcrypt.gensalt())
            test_user = {
                "id": str(uuid.uuid4()),
                "username": "teste",
                "name": "Funcionário Teste", 
                "password": hashed_test_password.decode('utf-8'),
                "role": "employee",
                "created_at": datetime.utcnow(),
                "locations": ["Posto Teste"]
            }
            
            await db.users.insert_one(test_user)
            print("✅ Test employee user created successfully")

    except Exception as e:
        print(f"Error creating users: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_admin_user())
