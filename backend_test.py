#!/usr/bin/env python3
"""
SmartCRM Backend API Testing Suite
Tests all backend endpoints according to test_result.md requirements
"""

import requests
import json
import io
import pandas as pd
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys

# Base URL from frontend/.env
BASE_URL = "https://smartcrm-hub-3.preview.emergentagent.com/api"

class SmartCRMTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.user_email = None
        self.test_contact_id = None
        self.test_followup_id = None
        self.results = {
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    def log_result(self, test_name, success, message=""):
        if success:
            self.results["passed"] += 1
            print(f"✅ {test_name}: PASSED {message}")
        else:
            self.results["failed"] += 1
            self.results["errors"].append(f"{test_name}: {message}")
            print(f"❌ {test_name}: FAILED - {message}")
    
    def make_request(self, method, endpoint, data=None, files=None, headers=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        
        # Add auth header if token exists
        if self.token and headers is None:
            headers = {"Authorization": f"Bearer {self.token}"}
        elif self.token and headers:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                if files:
                    response = requests.post(url, data=data, files=files, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error for {method} {url}: {str(e)}")
            return None
    
    def test_auth_signup(self):
        """Test user signup"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "testpassword123"
        
        data = {
            "email": test_email,
            "password": test_password
        }
        
        response = self.make_request("POST", "/auth/signup", data)
        
        if response is None:
            self.log_result("Auth Signup", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "token" in result and "user" in result:
                self.token = result["token"]
                self.user_id = result["user"]["id"]
                self.user_email = result["user"]["email"]
                self.log_result("Auth Signup", True, f"User created: {test_email}")
                return True
            else:
                self.log_result("Auth Signup", False, "Missing token or user in response")
                return False
        else:
            self.log_result("Auth Signup", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_auth_login(self):
        """Test user login with existing credentials"""
        if not self.user_email:
            self.log_result("Auth Login", False, "No user email from signup")
            return False
        
        data = {
            "email": self.user_email,
            "password": "testpassword123"
        }
        
        response = self.make_request("POST", "/auth/login", data)
        
        if response is None:
            self.log_result("Auth Login", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "token" in result:
                self.token = result["token"]  # Update token
                self.log_result("Auth Login", True, "Login successful")
                return True
            else:
                self.log_result("Auth Login", False, "Missing token in response")
                return False
        else:
            self.log_result("Auth Login", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_auth_me(self):
        """Test get current user"""
        if not self.token:
            self.log_result("Auth Me", False, "No token available")
            return False
        
        response = self.make_request("GET", "/auth/me")
        
        if response is None:
            self.log_result("Auth Me", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "id" in result and "email" in result:
                self.log_result("Auth Me", True, f"User info retrieved: {result['email']}")
                return True
            else:
                self.log_result("Auth Me", False, "Missing user info in response")
                return False
        else:
            self.log_result("Auth Me", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_contacts_count(self):
        """Test contact statistics"""
        if not self.token:
            self.log_result("Contacts Count", False, "No token available")
            return False
        
        response = self.make_request("GET", "/contacts/count")
        
        if response is None:
            self.log_result("Contacts Count", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "total" in result and "by_status" in result:
                self.log_result("Contacts Count", True, f"Total contacts: {result['total']}")
                return True
            else:
                self.log_result("Contacts Count", False, "Missing count data in response")
                return False
        else:
            self.log_result("Contacts Count", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_create_contact(self):
        """Test creating a contact"""
        if not self.token:
            self.log_result("Create Contact", False, "No token available")
            return False
        
        data = {
            "phone": f"+1555{uuid.uuid4().hex[:7]}",
            "status": "Follow-up",
            "data": {
                "name": "John Smith",
                "email": "john.smith@example.com",
                "company": "Tech Corp"
            }
        }
        
        response = self.make_request("POST", "/contacts", data)
        
        if response is None:
            self.log_result("Create Contact", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "id" in result and "phone" in result:
                self.test_contact_id = result["id"]
                self.log_result("Create Contact", True, f"Contact created: {result['phone']}")
                return True
            else:
                self.log_result("Create Contact", False, "Missing contact data in response")
                return False
        else:
            self.log_result("Create Contact", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_get_contacts(self):
        """Test getting contacts list"""
        if not self.token:
            self.log_result("Get Contacts", False, "No token available")
            return False
        
        response = self.make_request("GET", "/contacts")
        
        if response is None:
            self.log_result("Get Contacts", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_result("Get Contacts", True, f"Retrieved {len(result)} contacts")
                return True
            else:
                self.log_result("Get Contacts", False, "Response is not a list")
                return False
        else:
            self.log_result("Get Contacts", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_get_contact_by_id(self):
        """Test getting specific contact"""
        if not self.token or not self.test_contact_id:
            self.log_result("Get Contact By ID", False, "No token or contact ID available")
            return False
        
        response = self.make_request("GET", f"/contacts/{self.test_contact_id}")
        
        if response is None:
            self.log_result("Get Contact By ID", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "id" in result and result["id"] == self.test_contact_id:
                self.log_result("Get Contact By ID", True, f"Contact retrieved: {result['phone']}")
                return True
            else:
                self.log_result("Get Contact By ID", False, "Contact ID mismatch")
                return False
        else:
            self.log_result("Get Contact By ID", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_update_contact(self):
        """Test updating a contact"""
        if not self.token or not self.test_contact_id:
            self.log_result("Update Contact", False, "No token or contact ID available")
            return False
        
        data = {
            "status": "Interested",
            "data": {
                "name": "John Smith Updated",
                "email": "john.updated@example.com",
                "company": "Updated Tech Corp"
            }
        }
        
        response = self.make_request("PUT", f"/contacts/{self.test_contact_id}", data)
        
        if response is None:
            self.log_result("Update Contact", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "status" in result and result["status"] == "Interested":
                self.log_result("Update Contact", True, "Contact updated successfully")
                return True
            else:
                self.log_result("Update Contact", False, "Status not updated correctly")
                return False
        else:
            self.log_result("Update Contact", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_log_call(self):
        """Test logging a call"""
        if not self.token or not self.test_contact_id:
            self.log_result("Log Call", False, "No token or contact ID available")
            return False
        
        response = self.make_request("POST", f"/contacts/{self.test_contact_id}/call")
        
        if response is None:
            self.log_result("Log Call", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "message" in result and "call_time" in result:
                self.log_result("Log Call", True, f"Call logged at {result['call_time']}")
                return True
            else:
                self.log_result("Log Call", False, "Missing call log data")
                return False
        else:
            self.log_result("Log Call", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_excel_preview(self):
        """Test Excel file preview"""
        if not self.token:
            self.log_result("Excel Preview", False, "No token available")
            return False
        
        # Create a test Excel file
        test_data = {
            'Phone': ['+15551234567', '+15551234568', '+15551234569'],
            'Name': ['Alice Johnson', 'Bob Wilson', 'Carol Davis'],
            'Email': ['alice@example.com', 'bob@example.com', 'carol@example.com'],
            'Company': ['ABC Corp', 'XYZ Ltd', 'Tech Solutions']
        }
        
        df = pd.DataFrame(test_data)
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)
        
        files = {'file': ('test_contacts.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        # Note: For file upload, we need to handle headers differently
        headers = {"Authorization": f"Bearer {self.token}"}
        response = self.make_request("POST", "/contacts/preview", files=files, headers=headers)
        
        if response is None:
            self.log_result("Excel Preview", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "columns" in result and "sample_data" in result:
                self.log_result("Excel Preview", True, f"Columns: {result['columns']}")
                return True
            else:
                self.log_result("Excel Preview", False, "Missing preview data")
                return False
        else:
            self.log_result("Excel Preview", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_excel_import(self):
        """Test Excel file import"""
        if not self.token:
            self.log_result("Excel Import", False, "No token available")
            return False
        
        # Create a test Excel file with unique phone numbers
        test_data = {
            'Phone': [f'+1555{uuid.uuid4().hex[:7]}', f'+1555{uuid.uuid4().hex[:7]}'],
            'Name': ['Import Test 1', 'Import Test 2'],
            'Email': ['import1@example.com', 'import2@example.com'],
            'Company': ['Import Corp 1', 'Import Corp 2']
        }
        
        df = pd.DataFrame(test_data)
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False)
        excel_buffer.seek(0)
        
        # Column mapping - the key should be the Excel column name, value should be the field name
        column_mapping = {
            'phone': 'Phone',  # This maps the 'phone' field to the 'Phone' Excel column
            'name': 'Name',
            'email': 'Email', 
            'company': 'Company'
        }
        
        files = {'file': ('import_contacts.xlsx', excel_buffer.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        data = {'column_mapping': json.dumps(column_mapping)}
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = self.make_request("POST", "/contacts/import", data=data, files=files, headers=headers)
        
        if response is None:
            self.log_result("Excel Import", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "imported" in result and "skipped" in result:
                self.log_result("Excel Import", True, f"Imported: {result['imported']}, Skipped: {result['skipped']}")
                return True
            else:
                self.log_result("Excel Import", False, "Missing import statistics")
                return False
        else:
            self.log_result("Excel Import", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_create_note(self):
        """Test creating a note"""
        if not self.token or not self.test_contact_id:
            self.log_result("Create Note", False, "No token or contact ID available")
            return False
        
        data = {
            "contact_id": self.test_contact_id,
            "content": "This is a test note for the contact."
        }
        
        response = self.make_request("POST", "/notes", data)
        
        if response is None:
            self.log_result("Create Note", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "id" in result and "content" in result:
                self.log_result("Create Note", True, "Note created successfully")
                return True
            else:
                self.log_result("Create Note", False, "Missing note data")
                return False
        else:
            self.log_result("Create Note", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_get_contact_notes(self):
        """Test getting notes for a contact"""
        if not self.token or not self.test_contact_id:
            self.log_result("Get Contact Notes", False, "No token or contact ID available")
            return False
        
        response = self.make_request("GET", f"/notes/contact/{self.test_contact_id}")
        
        if response is None:
            self.log_result("Get Contact Notes", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_result("Get Contact Notes", True, f"Retrieved {len(result)} notes")
                return True
            else:
                self.log_result("Get Contact Notes", False, "Response is not a list")
                return False
        else:
            self.log_result("Get Contact Notes", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_create_followup(self):
        """Test creating a follow-up"""
        if not self.token or not self.test_contact_id:
            self.log_result("Create Follow-up", False, "No token or contact ID available")
            return False
        
        # Schedule follow-up for tomorrow
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        
        data = {
            "contact_id": self.test_contact_id,
            "follow_up_date": tomorrow,
            "notes": "Test follow-up reminder"
        }
        
        response = self.make_request("POST", "/followups", data)
        
        if response is None:
            self.log_result("Create Follow-up", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "id" in result and "follow_up_date" in result:
                self.test_followup_id = result["id"]
                self.log_result("Create Follow-up", True, f"Follow-up scheduled for {result['follow_up_date']}")
                return True
            else:
                self.log_result("Create Follow-up", False, "Missing follow-up data")
                return False
        else:
            self.log_result("Create Follow-up", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_get_followups(self):
        """Test getting follow-ups"""
        if not self.token:
            self.log_result("Get Follow-ups", False, "No token available")
            return False
        
        response = self.make_request("GET", "/followups")
        
        if response is None:
            self.log_result("Get Follow-ups", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_result("Get Follow-ups", True, f"Retrieved {len(result)} follow-ups")
                return True
            else:
                self.log_result("Get Follow-ups", False, "Response is not a list")
                return False
        else:
            self.log_result("Get Follow-ups", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_get_upcoming_followups(self):
        """Test getting upcoming follow-ups"""
        if not self.token:
            self.log_result("Get Upcoming Follow-ups", False, "No token available")
            return False
        
        response = self.make_request("GET", "/followups/upcoming")
        
        if response is None:
            self.log_result("Get Upcoming Follow-ups", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "overdue" in result and "upcoming" in result:
                self.log_result("Get Upcoming Follow-ups", True, f"Overdue: {len(result['overdue'])}, Upcoming: {len(result['upcoming'])}")
                return True
            else:
                self.log_result("Get Upcoming Follow-ups", False, "Missing follow-up categories")
                return False
        else:
            self.log_result("Get Upcoming Follow-ups", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_complete_followup(self):
        """Test completing a follow-up"""
        if not self.token or not self.test_followup_id:
            self.log_result("Complete Follow-up", False, "No token or follow-up ID available")
            return False
        
        response = self.make_request("PUT", f"/followups/{self.test_followup_id}/complete")
        
        if response is None:
            self.log_result("Complete Follow-up", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_result("Complete Follow-up", True, "Follow-up completed successfully")
                return True
            else:
                self.log_result("Complete Follow-up", False, "Missing completion message")
                return False
        else:
            self.log_result("Complete Follow-up", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_get_activity_logs(self):
        """Test getting activity logs"""
        if not self.token:
            self.log_result("Get Activity Logs", False, "No token available")
            return False
        
        response = self.make_request("GET", "/activity-logs")
        
        if response is None:
            self.log_result("Get Activity Logs", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_result("Get Activity Logs", True, f"Retrieved {len(result)} activity logs")
                return True
            else:
                self.log_result("Get Activity Logs", False, "Response is not a list")
                return False
        else:
            self.log_result("Get Activity Logs", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def test_duplicate_contact_prevention(self):
        """Test duplicate contact prevention"""
        if not self.token or not self.test_contact_id:
            self.log_result("Duplicate Prevention", False, "No token or contact ID available")
            return False
        
        # Get the phone number from the existing contact
        response = self.make_request("GET", f"/contacts/{self.test_contact_id}")
        if response is None or response.status_code != 200:
            self.log_result("Duplicate Prevention", False, "Could not get existing contact")
            return False
        
        existing_contact = response.json()
        phone = existing_contact["phone"]
        
        # Try to create another contact with the same phone
        data = {
            "phone": phone,
            "status": "Follow-up",
            "data": {
                "name": "Duplicate Test",
                "email": "duplicate@example.com"
            }
        }
        
        response = self.make_request("POST", "/contacts", data)
        
        if response is None:
            self.log_result("Duplicate Prevention", False, "Request failed")
            return False
        
        if response.status_code == 400:
            self.log_result("Duplicate Prevention", True, "Duplicate contact correctly rejected")
            return True
        else:
            self.log_result("Duplicate Prevention", False, f"Expected 400, got {response.status_code}")
            return False
    
    def test_delete_contact(self):
        """Test deleting a contact (cleanup)"""
        if not self.token or not self.test_contact_id:
            self.log_result("Delete Contact", False, "No token or contact ID available")
            return False
        
        response = self.make_request("DELETE", f"/contacts/{self.test_contact_id}")
        
        if response is None:
            self.log_result("Delete Contact", False, "Request failed")
            return False
        
        if response.status_code == 200:
            result = response.json()
            if "message" in result:
                self.log_result("Delete Contact", True, "Contact deleted successfully")
                return True
            else:
                self.log_result("Delete Contact", False, "Missing deletion message")
                return False
        else:
            self.log_result("Delete Contact", False, f"Status {response.status_code}: {response.text}")
            return False
    
    def run_all_tests(self):
        """Run all tests in the correct order"""
        print(f"🚀 Starting SmartCRM Backend API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests (must be first)
        print("\n🔐 AUTHENTICATION TESTS")
        self.test_auth_signup()
        self.test_auth_login()
        self.test_auth_me()
        
        # Contact statistics
        print("\n📊 CONTACT STATISTICS TESTS")
        self.test_contacts_count()
        
        # Contact management tests
        print("\n👥 CONTACT MANAGEMENT TESTS")
        self.test_create_contact()
        self.test_get_contacts()
        self.test_get_contact_by_id()
        self.test_update_contact()
        self.test_log_call()
        self.test_duplicate_contact_prevention()
        
        # Excel import tests
        print("\n📋 EXCEL IMPORT TESTS")
        self.test_excel_preview()
        self.test_excel_import()
        
        # Notes tests
        print("\n📝 NOTES SYSTEM TESTS")
        self.test_create_note()
        self.test_get_contact_notes()
        
        # Follow-up tests
        print("\n⏰ FOLLOW-UP SYSTEM TESTS")
        self.test_create_followup()
        self.test_get_followups()
        self.test_get_upcoming_followups()
        self.test_complete_followup()
        
        # Activity logs
        print("\n📋 ACTIVITY LOGS TESTS")
        self.test_get_activity_logs()
        
        # Cleanup
        print("\n🧹 CLEANUP TESTS")
        self.test_delete_contact()
        
        # Final results
        print("\n" + "=" * 60)
        print(f"🏁 TEST RESULTS SUMMARY")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"📊 Total: {self.results['passed'] + self.results['failed']}")
        
        if self.results['errors']:
            print(f"\n🚨 FAILED TESTS:")
            for error in self.results['errors']:
                print(f"   • {error}")
        
        return self.results['failed'] == 0

if __name__ == "__main__":
    tester = SmartCRMTester()
    success = tester.run_all_tests()
    
    if success:
        print(f"\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n💥 Some tests failed!")
        sys.exit(1)