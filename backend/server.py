from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import pandas as pd
import io
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import aiosmtplib
from email.message import EmailMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Scheduler for follow-up alerts
scheduler = AsyncIOScheduler()

# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserSignup(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Contact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    status: str = "Follow-up"
    data: Dict[str, Any] = {}  # Flexible schema for other columns
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_call_at: Optional[str] = None

class ContactCreate(BaseModel):
    phone: str
    status: Optional[str] = "Follow-up"
    data: Dict[str, Any] = {}

class ContactUpdate(BaseModel):
    phone: Optional[str] = None
    status: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class Note(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str
    user_id: str
    content: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class NoteCreate(BaseModel):
    contact_id: str
    content: str

class FollowUp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str
    user_id: str
    user_email: str
    follow_up_date: str
    notes: Optional[str] = None
    status: str = "pending"  # pending, completed, overdue
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notified: bool = False

class FollowUpCreate(BaseModel):
    contact_id: str
    follow_up_date: str
    notes: Optional[str] = None

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    action: str
    target: Optional[str] = None
    details: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============ HELPER FUNCTIONS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = decode_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def log_activity(user_id: str, user_email: str, action: str, target: Optional[str] = None, details: Optional[str] = None):
    log = ActivityLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        target=target,
        details=details
    )
    await db.activity_logs.insert_one(log.model_dump())

async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email via SMTP"""
    try:
        smtp_host = os.environ.get('SMTP_HOST', '')
        smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        smtp_user = os.environ.get('SMTP_USER', '')
        smtp_pass = os.environ.get('SMTP_PASS', '')
        
        if not smtp_host or not smtp_user:
            logging.warning("SMTP not configured, skipping email")
            return
        
        message = EmailMessage()
        message["From"] = smtp_user
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body)
        
        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_pass,
            start_tls=True
        )
        logging.info(f"Email sent to {to_email}")
    except Exception as e:
        logging.error(f"Failed to send email: {str(e)}")

# ============ AUTHENTICATION ROUTES ============

@api_router.post("/auth/signup")
async def signup(user_data: UserSignup):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(email=user_data.email)
    user_doc = user.model_dump()
    user_doc['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_doc)
    
    # Generate token
    token = create_jwt_token(user.id, user.email)
    
    return {
        "message": "User created successfully",
        "token": token,
        "user": {"id": user.id, "email": user.email}
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    # Find user
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = create_jwt_token(user['id'], user['email'])
    
    return {
        "message": "Login successful",
        "token": token,
        "user": {"id": user['id'], "email": user['email']}
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user['id'], "email": current_user['email']}

# ============ CONTACT ROUTES ============

@api_router.post("/contacts/import")
async def import_contacts(
    file: UploadFile = File(...),
    column_mapping: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Import contacts from Excel file with dynamic column mapping"""
    try:
        # Parse column mapping
        import json
        mapping = json.loads(column_mapping)
        phone_column = mapping.get('phone')
        
        if not phone_column:
            raise HTTPException(status_code=400, detail="Phone column mapping is required")
        
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Remove duplicates based on phone column
        df = df.drop_duplicates(subset=[phone_column], keep='first')
        
        imported_count = 0
        skipped_count = 0
        
        for _, row in df.iterrows():
            phone = str(row[phone_column]) if pd.notna(row[phone_column]) else None
            
            if not phone:
                skipped_count += 1
                continue
            
            # Check if contact already exists
            existing = await db.contacts.find_one({"phone": phone})
            if existing:
                skipped_count += 1
                continue
            
            # Create contact with flexible data structure
            contact_data = {}
            for excel_col, crm_field in mapping.items():
                if excel_col in df.columns and pd.notna(row[excel_col]):
                    # Convert to string and handle special values
                    value = row[excel_col]
                    if pd.isna(value) or value == '' or str(value).lower() in ['nan', 'none', 'null']:
                        continue
                    contact_data[crm_field] = str(value).strip()
            
            contact = Contact(
                phone=phone,
                data=contact_data
            )
            
            await db.contacts.insert_one(contact.model_dump())
            imported_count += 1
        
        # Log activity
        await log_activity(
            current_user['id'],
            current_user['email'],
            "Imported contacts",
            details=f"Imported {imported_count} contacts, skipped {skipped_count}"
        )
        
        return {
            "message": "Import completed",
            "imported": imported_count,
            "skipped": skipped_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/contacts/preview")
async def preview_excel(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Preview Excel file columns for mapping"""
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents), nrows=5)
        
        return {
            "columns": df.columns.tolist(),
            "sample_data": df.head().to_dict('records')
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/contacts", response_model=List[Contact])
async def get_contacts(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if search:
        query["$or"] = [
            {"phone": {"$regex": search, "$options": "i"}},
            {"data": {"$regex": search, "$options": "i"}}
        ]
    
    if status:
        query["status"] = status
    
    contacts = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return contacts

@api_router.get("/contacts/count")
async def get_contacts_count(current_user: dict = Depends(get_current_user)):
    total = await db.contacts.count_documents({})
    by_status = await db.contacts.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(None)
    
    return {
        "total": total,
        "by_status": {item['_id']: item['count'] for item in by_status}
    }

@api_router.post("/contacts", response_model=Contact)
async def create_contact(
    contact_data: ContactCreate,
    current_user: dict = Depends(get_current_user)
):
    # Check for duplicate
    existing = await db.contacts.find_one({"phone": contact_data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Contact with this phone number already exists")
    
    contact = Contact(**contact_data.model_dump())
    await db.contacts.insert_one(contact.model_dump())
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Created contact",
        target=contact.phone
    )
    
    return contact

@api_router.get("/contacts/{contact_id}", response_model=Contact)
async def get_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@api_router.put("/contacts/{contact_id}", response_model=Contact)
async def update_contact(
    contact_id: str,
    updates: ContactUpdate,
    current_user: dict = Depends(get_current_user)
):
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.contacts.update_one({"id": contact_id}, {"$set": update_data})
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Updated contact",
        target=contact['phone'],
        details=f"Fields: {', '.join(update_data.keys())}"
    )
    
    updated_contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    return updated_contact

@api_router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    await db.contacts.delete_one({"id": contact_id})
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Deleted contact",
        target=contact['phone']
    )
    
    return {"message": "Contact deleted successfully"}

@api_router.post("/contacts/{contact_id}/call")
async def log_call(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Log a call to a contact"""
    contact = await db.contacts.find_one({"id": contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    call_time = datetime.now(timezone.utc).isoformat()
    await db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"last_call_at": call_time}}
    )
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Called contact",
        target=contact['phone'],
        details=f"Call made at {call_time}"
    )
    
    return {"message": "Call logged successfully", "call_time": call_time}

# ============ NOTES ROUTES ============

@api_router.post("/notes", response_model=Note)
async def create_note(
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_user)
):
    note = Note(
        user_id=current_user['id'],
        **note_data.model_dump()
    )
    await db.notes.insert_one(note.model_dump())
    
    contact = await db.contacts.find_one({"id": note_data.contact_id}, {"_id": 0})
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Added note",
        target=contact['phone'] if contact else note_data.contact_id
    )
    
    return note

@api_router.get("/notes/contact/{contact_id}", response_model=List[Note])
async def get_contact_notes(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    notes = await db.notes.find({"contact_id": contact_id}, {"_id": 0}).sort("created_at", -1).to_list(None)
    return notes

# ============ FOLLOW-UP ROUTES ============

@api_router.post("/followups", response_model=FollowUp)
async def create_followup(
    followup_data: FollowUpCreate,
    current_user: dict = Depends(get_current_user)
):
    followup = FollowUp(
        user_id=current_user['id'],
        user_email=current_user['email'],
        **followup_data.model_dump()
    )
    await db.followups.insert_one(followup.model_dump())
    
    contact = await db.contacts.find_one({"id": followup_data.contact_id}, {"_id": 0})
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Created follow-up",
        target=contact['phone'] if contact else followup_data.contact_id,
        details=f"Scheduled for {followup_data.follow_up_date}"
    )
    
    return followup

@api_router.get("/followups", response_model=List[FollowUp])
async def get_followups(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status
    
    followups = await db.followups.find(query, {"_id": 0}).sort("follow_up_date", 1).to_list(None)
    return followups

@api_router.get("/followups/upcoming")
async def get_upcoming_followups(
    current_user: dict = Depends(get_current_user)
):
    """Get follow-ups that are due soon or overdue with contact details"""
    now = datetime.now(timezone.utc).isoformat()
    
    followups = await db.followups.find(
        {"status": {"$in": ["pending", "overdue"]}},
        {"_id": 0}
    ).sort("follow_up_date", 1).to_list(None)
    
    upcoming = []
    overdue = []
    
    for followup in followups:
        # Get contact details
        contact = await db.contacts.find_one({"id": followup['contact_id']}, {"_id": 0})
        if contact:
            followup['contact'] = contact
        
        if followup['follow_up_date'] < now:
            if followup['status'] != 'overdue':
                followup['status'] = 'overdue'
                await db.followups.update_one({"id": followup['id']}, {"$set": {"status": "overdue"}})
            overdue.append(followup)
        else:
            upcoming.append(followup)
    
    return {
        "overdue": overdue,
        "upcoming": upcoming[:20]
    }

@api_router.get("/followups/by-date")
async def get_followups_by_date(
    date_filter: str,  # today, tomorrow, this_week, all
    current_user: dict = Depends(get_current_user)
):
    """Get follow-ups filtered by date range"""
    now = datetime.now(timezone.utc)
    
    # Calculate date range based on filter
    if date_filter == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_filter == "tomorrow":
        tomorrow = now + timedelta(days=1)
        start_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif date_filter == "this_week":
        # Start from today
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        # End 7 days from now
        end_date = (now + timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=999999)
    else:  # all
        start_date = None
        end_date = None
    
    # Build query
    query = {"status": {"$in": ["pending", "overdue"]}}
    if start_date and end_date:
        query["follow_up_date"] = {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    
    followups = await db.followups.find(query, {"_id": 0}).sort("follow_up_date", 1).to_list(None)
    
    # Add contact details to each follow-up
    result = []
    for followup in followups:
        contact = await db.contacts.find_one({"id": followup['contact_id']}, {"_id": 0})
        if contact:
            followup['contact'] = contact
            result.append(followup)
    
    return {
        "filter": date_filter,
        "count": len(result),
        "followups": result
    }

@api_router.put("/followups/{followup_id}/complete")
async def complete_followup(
    followup_id: str,
    current_user: dict = Depends(get_current_user)
):
    followup = await db.followups.find_one({"id": followup_id}, {"_id": 0})
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    
    await db.followups.update_one({"id": followup_id}, {"$set": {"status": "completed"}})
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Completed follow-up",
        target=followup['contact_id']
    )
    
    return {"message": "Follow-up marked as completed"}

# ============ ACTIVITY LOG ROUTES ============

@api_router.get("/activity-logs", response_model=List[ActivityLog])
async def get_activity_logs(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# ============ SCHEDULER FOR FOLLOW-UP ALERTS ============

async def check_followup_alerts():
    """Check for follow-ups that need alerts"""
    try:
        now = datetime.now(timezone.utc)
        alert_window = now + timedelta(minutes=30)  # Alert 30 minutes before
        
        followups = await db.followups.find({
            "status": "pending",
            "notified": False,
            "follow_up_date": {
                "$lte": alert_window.isoformat()
            }
        }, {"_id": 0}).to_list(None)
        
        for followup in followups:
            # Get contact details
            contact = await db.contacts.find_one({"id": followup['contact_id']}, {"_id": 0})
            if not contact:
                continue
            
            contact_name = contact['data'].get('name', contact['phone'])
            
            # Send email notification
            subject = f"Follow-up Reminder: {contact_name}"
            body = f"""Hello,

This is a reminder for your follow-up with:

Contact: {contact_name}
Phone: {contact['phone']}
Scheduled: {followup['follow_up_date']}
Notes: {followup.get('notes', 'N/A')}

Best regards,
SmartCRM"""
            
            await send_email_notification(followup['user_email'], subject, body)
            
            # Mark as notified
            await db.followups.update_one(
                {"id": followup['id']},
                {"$set": {"notified": True}}
            )
            
            logging.info(f"Sent follow-up alert for contact {contact_name}")
    
    except Exception as e:
        logging.error(f"Error in follow-up alert check: {str(e)}")

# ============ APP STARTUP ============

@app.on_event("startup")
async def startup_event():
    # Start scheduler
    scheduler.add_job(check_followup_alerts, 'interval', minutes=5)
    scheduler.start()
    logging.info("Follow-up alert scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    client.close()
    scheduler.shutdown()

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)