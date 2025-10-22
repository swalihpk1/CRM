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
    customer_name: Optional[str] = None
    status: str = "None"
    data: Dict[str, Any] = {}  # Flexible schema for other columns
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_call_at: Optional[str] = None

class ContactCreate(BaseModel):
    phone: str
    customer_name: Optional[str] = None
    status: Optional[str] = "None"
    data: Dict[str, Any] = {}

class ContactUpdate(BaseModel):
    phone: Optional[str] = None
    customer_name: Optional[str] = None
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

class Meeting(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    title: str
    date: str
    time: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    attendees: List[Dict[str, Any]] = []
    status: str = "scheduled"  # scheduled, completed, cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MeetingCreate(BaseModel):
    title: str
    date: str
    time: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    attendees: List[Dict[str, Any]] = []

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    action: str
    target: Optional[str] = None
    details: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Demo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str
    user_id: str
    user_email: str
    given_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    watched: bool = False
    watched_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DemoCreate(BaseModel):
    contact_id: str
    notes: Optional[str] = None

class DemoWatchUpdate(BaseModel):
    watched_at: Optional[str] = None

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
        # Parse column mapping (format: {crm_field: excel_column})
        import json
        mapping = json.loads(column_mapping)
        
        # Find which Excel column contains phone numbers and customer name
        phone_column = mapping.get('phone')
        phone2_column = mapping.get('phone2')
        customer_name_column = mapping.get('customer_name')
        
        # Read Excel file
        contents = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(contents), engine='openpyxl', dtype=str, na_filter=False)
        except:
            try:
                df = pd.read_excel(io.BytesIO(contents), engine='xlrd', dtype=str, na_filter=False)
            except:
                df = pd.read_excel(io.BytesIO(contents), dtype=str, na_filter=False)
        
        # Clean up column names
        df.columns = df.columns.str.strip()
        
        # Debug
        print(f"\n=== IMPORT DEBUG ===")
        print(f"Excel columns: {list(df.columns)}")
        print(f"Mapping: {mapping}")
        print(f"Phone column: {phone_column}")
        print(f"Phone 2 column: {phone2_column}")
        print(f"Total rows in Excel: {len(df)}")
        
        # Replace empty values
        df = df.replace(["", " ", "N/A", "n/a", "NA", "na", "NULL", "null", "None", "none"], pd.NA)
        
        # Remove duplicates based on phone columns
        duplicate_columns = []
        if phone_column and phone_column in df.columns:
            duplicate_columns.append(phone_column)
        
        original_count = len(df)
        if duplicate_columns:
            df = df.drop_duplicates(subset=duplicate_columns, keep="first")
            file_duplicates_removed = original_count - len(df)
            print(f"Removed {file_duplicates_removed} duplicate rows from Excel file")
        else:
            file_duplicates_removed = 0
        
        imported_count = 0
        skipped_count = 0
        db_duplicates_count = 0  # Track database duplicates separately
        empty_data_count = 0     # Track empty data skips
        processed_count = 0      # Track total processed
        
        for index, row in df.iterrows():
            processed_count += 1
            contact_data = {}
            
            # Process all mapped fields except phone and customer_name fields
            for crm_field, excel_col in mapping.items():
                if excel_col in df.columns and crm_field not in ['phone', 'phone2', 'customer_name']:
                    value = row[excel_col]
                    if pd.isna(value) or value is None:
                        continue
                    str_value = str(value).strip()
                    if str_value == "" or str_value.lower() in ["nan", "none", "null", "na", "n/a"]:
                        continue
                    try:
                        contact_data[crm_field] = str_value.encode("utf-8", errors="ignore").decode("utf-8")
                    except:
                        contact_data[crm_field] = str_value
            
            # Get primary phone number
            phone = None
            if phone_column and phone_column in df.columns:
                phone_value = row[phone_column]
                if pd.notna(phone_value):
                    phone = str(phone_value).strip()
            
            # Get customer name
            customer_name = None
            if customer_name_column and customer_name_column in df.columns:
                customer_name_value = row[customer_name_column]
                if pd.notna(customer_name_value):
                    customer_name = str(customer_name_value).strip()
            
            # Get secondary phone number
            if phone2_column and phone2_column in df.columns:
                phone2_value = row[phone2_column]
                if pd.notna(phone2_value):
                    phone2 = str(phone2_value).strip()
                    contact_data['phone2'] = phone2
            
            # Generate phone if not available
            if not phone:
                shop_name = contact_data.get("shop_name")
                if shop_name and shop_name.strip():
                    clean_shop = shop_name.replace(" ", "_").replace("-", "_")[:15]
                    phone = f"{clean_shop}_{processed_count}"
                else:
                    phone = f"contact_{processed_count}"
            
            # Check for duplicates in database
            existing = await db.contacts.find_one({"phone": phone})
            if existing:
                db_duplicates_count += 1
                skipped_count += 1
                continue
            
            # Skip if no meaningful contact data
            if not contact_data:
                empty_data_count += 1
                skipped_count += 1
                continue
            
            # Handle status
            status = contact_data.pop("status", "None")
            
            contact = Contact(
                phone=phone,
                customer_name=customer_name,
                status=status,
                data=contact_data
            )
            
            await db.contacts.insert_one(contact.model_dump())
            imported_count += 1
        
        # Calculate totals
        total_processed = processed_count
        
        print(f"=== IMPORT SUMMARY ===")
        print(f"Total rows in Excel: {original_count}")
        print(f"File duplicates removed: {file_duplicates_removed}")
        print(f"Rows processed: {processed_count}")
        print(f"Successfully imported: {imported_count}")
        print(f"Database duplicates: {db_duplicates_count}")
        print(f"Empty data skipped: {empty_data_count}")
        print(f"Total skipped: {skipped_count}")
        
        await log_activity(
            current_user["id"],
            current_user["email"],
            "Imported contacts",
            details=f"Imported {imported_count} contacts, skipped {skipped_count} (duplicates: {db_duplicates_count}, empty: {empty_data_count}, file duplicates removed: {file_duplicates_removed})"
        )
        
        return {
            "message": "Import completed",
            "imported": imported_count,
            "skipped": skipped_count,
            "file_duplicates_removed": file_duplicates_removed,
            "db_duplicates": db_duplicates_count,
            "empty_data_skipped": empty_data_count,
            "total_processed": total_processed,
            "original_excel_rows": original_count
        }
    
    except Exception as e:
        print(f"Import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/contacts/preview")
async def preview_excel(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Preview Excel file columns for mapping"""
    try:
        contents = await file.read()
        # Read with proper encoding and data handling
        try:
            df = pd.read_excel(io.BytesIO(contents), nrows=5, engine='openpyxl', dtype=str, na_filter=False)
        except:
            try:
                df = pd.read_excel(io.BytesIO(contents), nrows=5, engine='xlrd', dtype=str, na_filter=False)
            except:
                df = pd.read_excel(io.BytesIO(contents), nrows=5, dtype=str, na_filter=False)
        
        # Clean up column names
        df.columns = df.columns.str.strip()
        
        # Clean up data for preview
        df = df.replace(['', ' ', 'N/A', 'n/a', 'NA', 'na', 'NULL', 'null', 'None', 'none'], None)
        
        # Replace NaN values with None for JSON serialization
        df = df.replace({pd.NA: None, pd.NaT: None})
        df = df.where(pd.notna(df), None)
        
        # Create better mapping suggestions based on common column names
        suggested_mapping = {}
        for col in df.columns:
            col_lower = col.lower().strip()
            if col_lower in ['shop name', 'shopname', 'shop_name', 'business name']:
                suggested_mapping[col] = 'shop_name'
            elif col_lower in ['customer name', 'customername', 'customer_name', 'name', 'client name', 'owner name']:
                suggested_mapping[col] = 'customer_name'
            elif col_lower in ['street', 'address', 'location', 'addr']:
                suggested_mapping[col] = 'address'
            elif col_lower in ['phone number', 'phone_number', 'phone', 'mobile', 'contact', 'contact number']:
                suggested_mapping[col] = 'phone'
            elif col_lower == 'city':
                suggested_mapping[col] = 'city'
            elif col_lower == 'state':
                suggested_mapping[col] = 'state'
            elif col_lower == 'status':
                suggested_mapping[col] = 'status'
            elif col_lower in ['category', 'type', 'classification']:
                suggested_mapping[col] = 'category'
            else:
                suggested_mapping[col] = ''
        
        return {
            "columns": df.columns.tolist(),
            "sample_data": df.to_dict('records'),
            "suggested_mapping": suggested_mapping
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
        # Log the search query for debugging
        print(f"Searching for: {search}")
        
        # Build a comprehensive search query
        search_conditions = [
            {"phone": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
        ]
        
        # Search in all possible nested data field variations
        data_fields = [
            # Shop names - most common variations
            "shop_name", "Shop_Name", "Shop Name", "shopName", "SHOP_NAME",
            "business_name", "Business_Name", "Business Name", "businessName", "BUSINESS_NAME",
            "shop", "Shop", "SHOP", "store_name", "Store_Name", "Store Name", "storeName",
            # Customer/Owner names  
            "name", "Name", "NAME", "customer_name", "Customer_Name", "Customer Name", "customerName",
            "owner_name", "Owner_Name", "Owner Name", "ownerName", "OWNER_NAME",
            "contact_person", "Contact_Person", "Contact Person", "contactPerson",
            # Addresses
            "address", "Address", "ADDRESS", "full_address", "Full_Address", "Full Address", "fullAddress",
            "city", "City", "CITY", "state", "State", "STATE", "location", "Location", "LOCATION",
            # Other common fields
            "company", "Company", "COMPANY", "firm", "Firm", "FIRM",
            "organization", "Organization", "ORGANIZATION", "title", "Title", "TITLE"
        ]
        
        # Add searches for all possible data field variations
        for field in data_fields:
            search_conditions.append({f"data.{field}": {"$regex": search, "$options": "i"}})
        
        query["$or"] = search_conditions
    
    if status:
        query["status"] = status
    
    try:
        print(f"MongoDB query: {query}")  # Debug log
        contacts = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        print(f"Found {len(contacts)} contacts")  # Debug log
        return contacts
    except Exception as e:
        print(f"Error in get_contacts: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=f"Database query error: {str(e)}")

@api_router.get("/contacts/debug-data")
async def debug_contact_data(current_user: dict = Depends(get_current_user)):
    """Debug endpoint to see the actual data structure"""
    contacts = await db.contacts.find({}, {"_id": 0}).limit(5).to_list(5)
    result = []
    for contact in contacts:
        result.append({
            "phone": contact.get("phone"),
            "customer_name": contact.get("customer_name"),
            "data_keys": list(contact.get("data", {}).keys()) if contact.get("data") else [],
            "sample_data": contact.get("data", {})
        })
    return result

@api_router.get("/test-search")
async def test_search_no_auth():
    """Test endpoint to verify search functionality without authentication"""
    try:
        # Test basic query
        query = {"$or": [{"phone": {"$regex": "test", "$options": "i"}}]}
        result = await db.contacts.find(query, {"_id": 0}).limit(1).to_list(1)
        return {"status": "success", "query_works": True, "sample_count": len(result)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

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
    
    # Get shop name and customer name for logging
    contact_data = contact.data if hasattr(contact, 'data') else {}
    shop_name = (
        contact_data.get('shop_name') or 
        contact_data.get('Shop_Name') or 
        contact_data.get('Shop Name') or
        contact_data.get('shop') or
        contact_data.get('Shop') or
        'Unknown Shop'
    )
    customer_name = getattr(contact, 'customer_name', None) or 'Unknown Customer'
    print(f"Contact creation - Phone: {contact.phone}, Customer: {customer_name}, Shop name: {shop_name}, Contact data keys: {list(contact_data.keys())}")
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Created contact",
        target=contact.phone,
        details=f"Customer: {customer_name}, Shop: {shop_name}, Phone: {contact.phone}"
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
    
    # Get shop name and customer name for logging (check both original and updated data)
    shop_name = (
        update_data.get('data', {}).get('shop_name') or 
        contact.get('data', {}).get('shop_name') or 
        contact.get('data', {}).get('Shop_Name') or 
        contact.get('data', {}).get('Shop Name') or 
        'Unknown Shop'
    )
    customer_name = (
        update_data.get('customer_name') or
        contact.get('customer_name') or
        'Unknown Customer'
    )
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Updated contact",
        target=contact['phone'],
        details=f"Customer: {customer_name}, Shop: {shop_name}, Fields: {', '.join(update_data.keys())}"
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
    
    # Get shop name and customer name before deletion for logging
    contact_data = contact.get('data', {})
    shop_name = (
        contact_data.get('shop_name') or 
        contact_data.get('Shop_Name') or 
        contact_data.get('Shop Name') or
        contact_data.get('shop') or
        contact_data.get('Shop') or
        contact.get('shop_name') or  # In case it's directly on contact
        contact.get('Shop_Name') or
        'Unknown Shop'
    )
    customer_name = contact.get('customer_name') or 'Unknown Customer'
    print(f"Contact deletion - Phone: {contact.get('phone')}, Customer: {customer_name}, Shop name: {shop_name}, Contact data keys: {list(contact_data.keys())}")
    
    await db.contacts.delete_one({"id": contact_id})
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Deleted contact",
        target=contact['phone'],
        details=f"Customer: {customer_name}, Shop: {shop_name}, Phone: {contact['phone']}"
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
    
    # Get the contact to use phone number as target for better activity log display
    contact = await db.contacts.find_one({"id": followup['contact_id']}, {"_id": 0})
    target = contact['phone'] if contact else followup['contact_id']
    
    await db.followups.update_one({"id": followup_id}, {"$set": {"status": "completed"}})
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Completed follow-up",
        target=target
    )
    
    return {"message": "Follow-up marked as completed"}

@api_router.get("/followups/paginated")
async def get_paginated_followups(
    skip: int = 0,
    limit: int = 20,
    date_filter: str = "all",
    current_user: dict = Depends(get_current_user)
):
    """Get paginated follow-ups"""
    now = datetime.now(timezone.utc)
    
    # Calculate date range based on filter
    query = {"status": {"$in": ["pending", "overdue"]}}
    if date_filter == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        query["follow_up_date"] = {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    elif date_filter == "tomorrow":
        tomorrow = now + timedelta(days=1)
        start_date = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        query["follow_up_date"] = {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    elif date_filter == "this_week":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = (now + timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=999999)
        query["follow_up_date"] = {
            "$gte": start_date.isoformat(),
            "$lte": end_date.isoformat()
        }
    
    followups = await db.followups.find(query, {"_id": 0}).sort("follow_up_date", 1).skip(skip).limit(limit).to_list(limit)
    
    # Add contact details to each follow-up
    result = []
    for followup in followups:
        # Update status if overdue
        if followup['follow_up_date'] < now.isoformat() and followup['status'] != 'overdue':
            followup['status'] = 'overdue'
            await db.followups.update_one({"id": followup['id']}, {"$set": {"status": "overdue"}})
        
        contact = await db.contacts.find_one({"id": followup['contact_id']}, {"_id": 0})
        if contact:
            followup['contact'] = contact
            result.append(followup)
    
    return result

# ============ ACTIVITY LOG ROUTES ============

@api_router.get("/activity-logs", response_model=List[ActivityLog])
async def get_activity_logs(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# ============ MEETING ROUTES ============

@api_router.post("/meetings", response_model=Meeting)
async def create_meeting(
    meeting_data: MeetingCreate,
    current_user: dict = Depends(get_current_user)
):
    meeting = Meeting(
        user_id=current_user['id'],
        user_email=current_user['email'],
        **meeting_data.model_dump()
    )
    await db.meetings.insert_one(meeting.model_dump())
    
    # Get contact details for proper logging
    target_contact = None
    if meeting.attendees and len(meeting.attendees) > 0:
        # Find the first attendee's contact for logging
        first_attendee = meeting.attendees[0]
        if 'phone' in first_attendee:
            target_contact = await db.contacts.find_one({"phone": first_attendee['phone']}, {"_id": 0})
    
    # Use contact phone as target, fallback to meeting title
    log_target = target_contact['phone'] if target_contact else meeting.title
    
    # Create detailed attendee info for better logging
    attendee_info = []
    for attendee in meeting.attendees:
        if 'phone' in attendee:
            attendee_info.append(f"{attendee.get('name', 'Unknown')} ({attendee['phone']})")
        else:
            attendee_info.append(attendee.get('name', 'Unknown'))
    
    attendee_details = ", ".join(attendee_info) if attendee_info else "No attendees"
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Created meeting",
        target=log_target,
        details=f"Meeting: {meeting.title}, Date: {meeting.date} {meeting.time or ''}, Attendees: {attendee_details}"
    )
    
    return meeting

@api_router.get("/meetings", response_model=List[Meeting])
async def get_meetings(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user['id']}
    if status:
        query["status"] = status
    
    meetings = await db.meetings.find(query, {"_id": 0}).sort("date", 1).skip(skip).limit(limit).to_list(limit)
    return meetings

@api_router.get("/meetings/{meeting_id}", response_model=Meeting)
async def get_meeting(
    meeting_id: str,
    current_user: dict = Depends(get_current_user)
):
    meeting = await db.meetings.find_one({"id": meeting_id, "user_id": current_user['id']}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting

class MeetingStatusUpdate(BaseModel):
    status: str

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    attendees: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None

@api_router.put("/meetings/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    meeting_update: MeetingUpdate,
    current_user: dict = Depends(get_current_user)
):
    meeting = await db.meetings.find_one({"id": meeting_id, "user_id": current_user['id']}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Build update data from non-None fields
    update_data = {k: v for k, v in meeting_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    await db.meetings.update_one({"id": meeting_id}, {"$set": update_data})
    
    # Get contact details for proper logging
    target_contact = None
    if meeting.get('attendees') and len(meeting['attendees']) > 0:
        first_attendee = meeting['attendees'][0]
        if 'phone' in first_attendee:
            target_contact = await db.contacts.find_one({"phone": first_attendee['phone']}, {"_id": 0})
    
    # Use contact phone as target, fallback to meeting title
    log_target = target_contact['phone'] if target_contact else meeting['title']
    
    # Create detailed attendee info for better logging
    attendee_info = []
    if meeting.get('attendees'):
        for attendee in meeting['attendees']:
            if 'phone' in attendee:
                attendee_info.append(f"{attendee.get('name', 'Unknown')} ({attendee['phone']})")
            else:
                attendee_info.append(attendee.get('name', 'Unknown'))
    
    attendee_details = ", ".join(attendee_info) if attendee_info else "No attendees"
    
    # Determine action for logging
    action = "Updated meeting"
    details = f"Meeting: {meeting['title']}, Attendees: {attendee_details}"
    
    if "date" in update_data or "time" in update_data:
        action = "Rescheduled meeting"
        old_datetime = f"{meeting.get('date', '')} {meeting.get('time', '')}"
        new_datetime = f"{update_data.get('date', meeting.get('date', ''))} {update_data.get('time', meeting.get('time', ''))}"
        details = f"Meeting: {meeting['title']}, From: {old_datetime.strip()}, To: {new_datetime.strip()}, Attendees: {attendee_details}"
    elif "status" in update_data:
        action = f"Updated meeting status to {update_data['status']}"
        details = f"Meeting: {meeting['title']}, Status: {update_data['status']}, Attendees: {attendee_details}"
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        action,
        target=log_target,
        details=details
    )
    
    return {"message": "Meeting updated successfully"}

@api_router.put("/meetings/{meeting_id}/status")
async def update_meeting_status(
    meeting_id: str,
    status_update: MeetingStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    if status_update.status not in ["scheduled", "completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    meeting = await db.meetings.find_one({"id": meeting_id, "user_id": current_user['id']}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    await db.meetings.update_one({"id": meeting_id}, {"$set": {"status": status_update.status}})
    
    # Get contact details for proper logging
    target_contact = None
    if meeting.get('attendees') and len(meeting['attendees']) > 0:
        first_attendee = meeting['attendees'][0]
        if 'phone' in first_attendee:
            target_contact = await db.contacts.find_one({"phone": first_attendee['phone']}, {"_id": 0})
    
    # Use contact phone as target, fallback to meeting title
    log_target = target_contact['phone'] if target_contact else meeting['title']
    
    # Determine action based on status
    if status_update.status == "completed":
        action = "Completed meeting"
    elif status_update.status == "cancelled":
        action = "Cancelled meeting"
    else:
        action = f"Updated meeting status to {status_update.status}"
    
    # Create detailed attendee info for better logging
    attendee_info = []
    if meeting.get('attendees'):
        for attendee in meeting['attendees']:
            if 'phone' in attendee:
                attendee_info.append(f"{attendee.get('name', 'Unknown')} ({attendee['phone']})")
            else:
                attendee_info.append(attendee.get('name', 'Unknown'))
    
    attendee_details = ", ".join(attendee_info) if attendee_info else "No attendees"
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        action,
        target=log_target,
        details=f"Meeting: {meeting['title']}, Date: {meeting.get('date', '')} {meeting.get('time', '')}, Attendees: {attendee_details}"
    )
    
    return {"message": f"Meeting status updated to {status_update.status}"}

@api_router.delete("/meetings/{meeting_id}")
async def delete_meeting(
    meeting_id: str,
    current_user: dict = Depends(get_current_user)
):
    meeting = await db.meetings.find_one({"id": meeting_id, "user_id": current_user['id']}, {"_id": 0})
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get contact details for proper logging before deletion
    target_contact = None
    if meeting.get('attendees') and len(meeting['attendees']) > 0:
        first_attendee = meeting['attendees'][0]
        if 'phone' in first_attendee:
            target_contact = await db.contacts.find_one({"phone": first_attendee['phone']}, {"_id": 0})
    
    # Use contact phone as target, fallback to meeting title
    log_target = target_contact['phone'] if target_contact else meeting['title']
    
    await db.meetings.delete_one({"id": meeting_id})
    
    # Create detailed attendee info for better logging
    attendee_info = []
    if meeting.get('attendees'):
        for attendee in meeting['attendees']:
            if 'phone' in attendee:
                attendee_info.append(f"{attendee.get('name', 'Unknown')} ({attendee['phone']})")
            else:
                attendee_info.append(attendee.get('name', 'Unknown'))
    
    attendee_details = ", ".join(attendee_info) if attendee_info else "No attendees"
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Deleted meeting",
        target=log_target,
        details=f"Meeting: {meeting['title']}, Date: {meeting.get('date', '')} {meeting.get('time', '')}, Attendees: {attendee_details}"
    )
    
    return {"message": "Meeting deleted successfully"}

# ============ DEMO ROUTES ============

@api_router.post("/demos", response_model=Demo)
async def create_demo(
    demo_data: DemoCreate,
    current_user: dict = Depends(get_current_user)
):
    """Mark a demo as given"""
    contact = await db.contacts.find_one({"id": demo_data.contact_id}, {"_id": 0})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    demo = Demo(
        user_id=current_user['id'],
        user_email=current_user['email'],
        **demo_data.model_dump()
    )
    
    await db.demos.insert_one(demo.model_dump())
    
    # Get shop name for logging
    contact_data = contact.get('data', {})
    shop_name = (
        contact_data.get('shop_name') or 
        contact_data.get('Shop_Name') or 
        contact_data.get('Shop Name') or
        'Unknown Shop'
    )
    
    await log_activity(
        current_user['id'],
        current_user['email'],
        "Demo given",
        target=contact['phone'],
        details=f"Shop: {shop_name}, Given at: {demo.given_at}"
    )
    
    return demo

@api_router.put("/demos/{demo_id}/watched")
async def mark_demo_watched(
    demo_id: str,
    watch_data: DemoWatchUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Mark a demo as watched/checked"""
    demo = await db.demos.find_one({"id": demo_id}, {"_id": 0})
    if not demo:
        raise HTTPException(status_code=404, detail="Demo not found")
    
    if demo['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    watched_at = watch_data.watched_at or datetime.now(timezone.utc).isoformat()
    
    await db.demos.update_one(
        {"id": demo_id},
        {
            "$set": {
                "watched": True,
                "watched_at": watched_at,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Get contact for logging
    contact = await db.contacts.find_one({"id": demo['contact_id']}, {"_id": 0})
    if contact:
        contact_data = contact.get('data', {})
        shop_name = (
            contact_data.get('shop_name') or 
            contact_data.get('Shop_Name') or 
            contact_data.get('Shop Name') or
            'Unknown Shop'
        )
        
        await log_activity(
            current_user['id'],
            current_user['email'],
            "Demo watched",
            target=contact['phone'],
            details=f"Shop: {shop_name}, Watched at: {watched_at}"
        )
    
    return {"message": "Demo marked as watched", "watched_at": watched_at}

@api_router.get("/contacts/{contact_id}/demos", response_model=List[Demo])
async def get_contact_demos(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get demo history for a contact"""
    demos = await db.demos.find(
        {"contact_id": contact_id}, 
        {"_id": 0}
    ).sort("given_at", -1).to_list(None)
    
    return demos

@api_router.get("/demos/report")
async def get_demo_report(
    start: str,
    end: str,
    group_by: str = "day",  # day, week, month
    current_user: dict = Depends(get_current_user)
):
    """Get demo statistics grouped by time period"""
    try:
        start_date = datetime.fromisoformat(start.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(end.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    # MongoDB aggregation pipeline
    if group_by == "day":
        date_format = "%Y-%m-%d"
    elif group_by == "week":
        date_format = "%Y-%U"  # Year-Week
    elif group_by == "month":
        date_format = "%Y-%m"
    else:
        raise HTTPException(status_code=400, detail="Invalid group_by parameter")
    
    pipeline = [
        {
            "$match": {
                "given_at": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": date_format,
                        "date": {"$dateFromString": {"dateString": "$given_at"}}
                    }
                },
                "given": {"$sum": 1},
                "watched": {
                    "$sum": {
                        "$cond": [{"$eq": ["$watched", True]}, 1, 0]
                    }
                }
            }
        },
        {
            "$addFields": {
                "conversion": {
                    "$cond": [
                        {"$gt": ["$given", 0]},
                        {"$divide": ["$watched", "$given"]},
                        0
                    ]
                }
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    result = await db.demos.aggregate(pipeline).to_list(None)
    
    # Format the result
    formatted_result = []
    for item in result:
        formatted_result.append({
            "period": item["_id"],
            "given": item["given"],
            "watched": item["watched"],
            "conversion": round(item["conversion"], 3)
        })
    
    return formatted_result

@api_router.get("/demos/summary")
async def get_demo_summary(
    start: str,
    end: str,
    current_user: dict = Depends(get_current_user)
):
    """Get overall demo statistics for a date range"""
    try:
        start_date = datetime.fromisoformat(start.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(end.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    pipeline = [
        {
            "$match": {
                "given_at": {
                    "$gte": start_date.isoformat(),
                    "$lte": end_date.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "given": {"$sum": 1},
                "watched": {
                    "$sum": {
                        "$cond": [{"$eq": ["$watched", True]}, 1, 0]
                    }
                }
            }
        },
        {
            "$addFields": {
                "conversion": {
                    "$cond": [
                        {"$gt": ["$given", 0]},
                        {"$divide": ["$watched", "$given"]},
                        0
                    ]
                }
            }
        }
    ]
    
    result = await db.demos.aggregate(pipeline).to_list(None)
    
    if not result:
        return {"given": 0, "watched": 0, "conversion": 0}
    
    data = result[0]
    return {
        "given": data["given"],
        "watched": data["watched"],
        "conversion": round(data["conversion"], 3)
    }

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)