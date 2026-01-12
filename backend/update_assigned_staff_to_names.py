"""
One-time script to update assigned_staff field from full email to just name
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
MONGODB_URL = "mongodb://localhost:27017/"

async def update_assigned_staff_to_names():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client['smartcrm']
    
    # Find all contacts that have assigned_staff with @ symbol (full email)
    contacts = await db.contacts.find({
        "assigned_staff": {"$regex": "@"}
    }).to_list(None)
    
    print(f"Found {len(contacts)} contacts with full email in assigned_staff\n")
    
    updated_count = 0
    
    for contact in contacts:
        contact_id = contact['id']
        phone = contact.get('phone', 'Unknown')
        old_email = contact['assigned_staff']
        
        # Extract name from email (part before @)
        staff_name = old_email.split('@')[0]
        
        # Update the contact
        await db.contacts.update_one(
            {"id": contact_id},
            {"$set": {"assigned_staff": staff_name}}
        )
        
        print(f"✅ Updated {phone}: {old_email} → {staff_name}")
        updated_count += 1
    
    print(f"\n=== Summary ===")
    print(f"Total contacts updated: {updated_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_assigned_staff_to_names())
