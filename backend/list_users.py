import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('.env')

async def list_users():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # List all users
    users = await db.users.find({}, {"_id": 0, "email": 1, "role": 1, "created_at": 1}).to_list(None)
    
    if users:
        print(f"📋 Found {len(users)} user(s) in database:")
        for user in users:
            print(f"   - {user['email']} | Role: {user.get('role', 'NOT SET')} | Created: {user.get('created_at', 'N/A')}")
    else:
        print("❌ No users found in database")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(list_users())
