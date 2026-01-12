import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('.env')

async def backfill_assigned_staff():
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Find all contacts with status != "None" but no assigned_staff
    contacts = await db.contacts.find({
        "status": {"$ne": "None"},
        "$or": [
            {"assigned_staff": {"$exists": False}},
            {"assigned_staff": None},
            {"assigned_staff": ""}
        ]
    }, {"_id": 0}).to_list(None)
    
    print(f"Found {len(contacts)} contacts to backfill\n")
    
    updated_count = 0
    not_found_count = 0
    
    for contact in contacts:
        contact_id = contact['id']
        phone = contact.get('phone', 'Unknown')
        
        # Look for activity logs for this contact
        # Find the first "Updated contact" or "Created contact" activity for this phone
        activity = await db.activity_logs.find_one(
            {
                "target": phone,
                "action": {"$in": ["Updated contact", "Created contact", "Called contact"]}
            },
            {"_id": 0}
        )
        
        if activity:
            # Assign this staff member to the contact (use name only, not full email)
            staff_name = activity['user_email'].split('@')[0]
            await db.contacts.update_one(
                {"id": contact_id},
                {
                    "$set": {
                        "assigned_staff": staff_name,
                        "assigned_staff_id": activity['user_id']
                    }
                }
            )
            print(f"✅ Assigned {staff_name} to contact {phone}")
            updated_count += 1
        else:
            print(f"⚠️  No activity log found for contact {phone} - leaving unassigned")
            not_found_count += 1
    
    print(f"\n=== Summary ===")
    print(f"Total contacts processed: {len(contacts)}")
    print(f"Successfully assigned: {updated_count}")
    print(f"No activity found: {not_found_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(backfill_assigned_staff())
