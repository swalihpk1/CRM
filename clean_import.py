# Clean import function
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
        
        # Find which Excel column contains phone numbers (optional)
        phone_column = mapping.get('phone')
        
        # Read Excel file with proper encoding and data type handling
        contents = await file.read()
        # Try different engines and handle encoding issues
        try:
            df = pd.read_excel(io.BytesIO(contents), engine='openpyxl', dtype=str, na_filter=False)
        except:
            try:
                df = pd.read_excel(io.BytesIO(contents), engine='xlrd', dtype=str, na_filter=False)
            except:
                df = pd.read_excel(io.BytesIO(contents), dtype=str, na_filter=False)
        
        # Clean up column names (remove extra spaces, special characters)
        df.columns = df.columns.str.strip()
        
        # Debug: Print column information
        print(f"\n=== IMPORT DEBUG ===")
        print(f"Excel columns found: {list(df.columns)}")
        print(f"Column mapping received: {mapping}")
        print(f"Phone column identified: {phone_column}")
        print(f"DataFrame shape: {df.shape}")
        
        # Replace empty strings and common null representations with actual NaN
        df = df.replace(['', ' ', 'N/A', 'n/a', 'NA', 'na', 'NULL', 'null', 'None', 'none'], pd.NA)
        
        # Remove duplicates based on phone column if it exists, otherwise use all rows
        if phone_column and phone_column in df.columns:
            df = df.drop_duplicates(subset=[phone_column], keep='first')
        
        imported_count = 0
        skipped_count = 0
        
        # Debug: Show first row sample
        if len(df) > 0:
            print(f"First row sample: {dict(df.iloc[0])}")
        
        for index, row in df.iterrows():
            # Collect all data from Excel row
            contact_data = {}
            
            for crm_field, excel_col in mapping.items():
                if excel_col in df.columns:
                    value = row[excel_col]
                    
                    # Handle different data types and clean values
                    if pd.isna(value) or value is None:
                        continue
                    
                    # Convert to string and clean
                    str_value = str(value).strip()
                    
                    # Skip only truly empty or meaningless values
                    if str_value == '' or str_value.lower() in ['nan', 'none', 'null', 'na', 'n/a']:
                        continue
                    
                    # Store the cleaned value
                    try:
                        contact_data[crm_field] = str_value.encode('utf-8', errors='ignore').decode('utf-8')
                    except Exception as e:
                        contact_data[crm_field] = str_value
            
            # Get phone number if available
            phone = None
            if phone_column and phone_column in df.columns:
                phone = str(row[phone_column]) if pd.notna(row[phone_column]) else None
                # Remove phone from contact_data since it's a main field
                contact_data.pop('phone', None)
            
            # If no phone, generate a unique identifier using shop name from contact_data
            if not phone:
                shop_name = contact_data.get('shop_name')
                
                # Create a unique phone using shop name or just index
                if shop_name and shop_name.strip():
                    # Clean shop name for phone generation
                    clean_shop = shop_name.replace(' ', '_').replace('-', '_')[:15]
                    phone = f"{clean_shop}_{imported_count + 1}"
                else:
                    phone = f"contact_{imported_count + 1}"
            
            # Check if contact already exists
            existing = await db.contacts.find_one({"phone": phone})
            if existing:
                skipped_count += 1
                continue
            
            # Handle status field - use status from Excel sheet if available, otherwise default
            status = contact_data.pop('status', 'Follow-up')  # Remove from data and use as main field
            
            print(f"Creating contact: phone={phone}, status={status}, data={contact_data}")
            
            contact = Contact(
                phone=phone,
                status=status,
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
        print(f"Import error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))