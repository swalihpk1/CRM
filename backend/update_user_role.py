import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('.env')

async def update_user_role():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Update the user role
    result = await db.users.update_one(
        {"email": "swalih123@gmail.com"},
        {"$set": {"role": "admin"}}
    )
    
    if result.matched_count > 0:
        print(f"✅ Successfully updated swalih123@gmail.com to admin role")
        print(f"   Modified {result.modified_count} document(s)")
        
        # Verify the update
        user = await db.users.find_one({"email": "swalih123@gmail.com"}, {"_id": 0, "email": 1, "role": 1})
        if user:
            print(f"   User: {user['email']} - Role: {user.get('role', 'NOT SET')}")
    else:
        print(f"❌ User swalih123@gmail.com not found in database")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_user_role())
