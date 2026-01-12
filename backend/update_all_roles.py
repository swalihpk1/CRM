import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('.env')

async def update_all_users():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Update swaliih123@gmail.com to admin
    result = await db.users.update_one(
        {"email": "swaliih123@gmail.com"},
        {"$set": {"role": "admin"}}
    )
    
    if result.matched_count > 0:
        print(f"✅ Updated swaliih123@gmail.com to admin role")
    
    # Update all other users without role to staff
    result2 = await db.users.update_many(
        {"role": {"$exists": False}},
        {"$set": {"role": "staff"}}
    )
    
    print(f"✅ Updated {result2.modified_count} user(s) to staff role")
    
    # List all users with their roles
    users = await db.users.find({}, {"_id": 0, "email": 1, "role": 1}).to_list(None)
    
    print(f"\n📋 All users:")
    for user in users:
        role_emoji = "👑" if user.get('role') == 'admin' else "👤"
        print(f"   {role_emoji} {user['email']} - {user.get('role', 'NOT SET')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_all_users())
