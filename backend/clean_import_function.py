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
        
        # Find which Excel column contains phone numbers
        phone_column = mapping.get('phone')
        print(f"Phone column from mapping: {phone_column}")
        
        # Read Excel file with proper encoding and data type handling
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
        
        # Debug information
        print(f"\n=== IMPORT DEBUG ===")
        print(f"Excel columns found: {list(df.columns)}")
        print(f"Column mapping received: {mapping}")
        print(f"Phone column identified: {phone_column}")
        print(f"DataFrame shape: {df.shape}")
        
        # Show first row sample
        if len(df) > 0:
            print(f"First row sample: {dict(df.iloc[0])}")
        
        # Replace empty values with NaN
        df = df.replace(['', ' ', 'N/A', 'n/a', 'NA', 'na', 'NULL', 'null', 'None', 'none'], pd.NA)
        
        # Remove duplicates if phone column exists
        if phone_column and phone_column in df.columns:
            df = df.drop_duplicates(subset=[phone_column], keep='first')
        
        imported_count = 0
        skipped_count = 0
        
        for index, row in df.iterrows():
            # Collect all data from Excel row
            contact_data = {}
            
            for crm_field, excel_col in mapping.items():
                if excel_col in df.columns:
                    value = row[excel_col]
                    
                    # Skip empty or null values
                    if pd.isna(value) or value is None:
                        continue
                    
                    # Clean the value
                    str_value = str(value).strip()
                    if str_value == '' or str_value.lower() in ['nan', 'none', 'null', 'na', 'n/a']:
                        continue
                    
                    # Store the cleaned value
                    try:
                        contact_data[crm_field] = str_value.encode('utf-8', errors='ignore').decode('utf-8')
                    except:
                        contact_data[crm_field] = str_value
            
            # Get phone number
            phone = None
            if phone_column and phone_column in df.columns:
                phone_value = row[phone_column]
                if pd.notna(phone_value):
                    phone = str(phone_value).strip()
                # Remove phone from contact_data since it's a main field
                contact_data.pop('phone', None)
            
            # Generate phone if not available
            if not phone:
                shop_name = contact_data.get('shop_name')
                if shop_name and shop_name.strip():
                    clean_shop = shop_name.replace(' ', '_').replace('-', '_')[:15]
                    phone = f"{clean_shop}_{imported_count + 1}"
                else:
                    phone = f"contact_{imported_count + 1}"
            
            # Check for duplicates
            existing = await db.contacts.find_one({"phone": phone})
            if existing:
                skipped_count += 1
                continue
            
            # Skip if no data
            if not contact_data:
                skipped_count += 1
                continue
            
            # Handle status - use from Excel or default
            status = contact_data.pop('status', 'Follow-up')
            
            print(f"Creating contact: phone={phone}, status={status}, data={contact_data}")
            
            # Create contact
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
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))