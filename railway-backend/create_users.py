"""
Script to create test users for the Photo Monitoring App
Run this script to add an admin and sample employees
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid
from datetime import datetime
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def create_users():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔧 Creating users...")
    
    # Admin user
    admin_user = {
        "id": str(uuid.uuid4()),
        "username": "admin",
        "password": hash_password("admin123"),
        "name": "Administrador",
        "role": "admin",
        "created_at": datetime.utcnow()
    }
    
    # Check if admin exists
    existing_admin = await db.users.find_one({"username": "admin"})
    if existing_admin:
        print("⚠️  Admin user already exists")
    else:
        await db.users.insert_one(admin_user)
        print("✅ Admin created - username: admin, password: admin123")
    
    # Sample employees
    employees = [
        {"username": "joao", "name": "João Silva", "password": "123456"},
        {"username": "maria", "name": "Maria Santos", "password": "123456"},
        {"username": "pedro", "name": "Pedro Costa", "password": "123456"},
    ]
    
    for emp in employees:
        existing = await db.users.find_one({"username": emp["username"]})
        if existing:
            print(f"⚠️  Employee {emp['username']} already exists")
        else:
            employee_user = {
                "id": str(uuid.uuid4()),
                "username": emp["username"],
                "password": hash_password(emp["password"]),
                "name": emp["name"],
                "role": "employee",
                "created_at": datetime.utcnow()
            }
            await db.users.insert_one(employee_user)
            print(f"✅ Employee created - username: {emp['username']}, password: {emp['password']}")
    
    print("\n📋 Summary:")
    total_users = await db.users.count_documents({})
    total_admins = await db.users.count_documents({"role": "admin"})
    total_employees = await db.users.count_documents({"role": "employee"})
    
    print(f"   Total users: {total_users}")
    print(f"   Admins: {total_admins}")
    print(f"   Employees: {total_employees}")
    
    client.close()

if __name__ == "__main__":
    print("\n🚀 Photo Monitoring App - User Creation Script\n")
    asyncio.run(create_users())
    print("\n✨ Done!\n")
