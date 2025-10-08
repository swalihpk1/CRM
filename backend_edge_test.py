#!/usr/bin/env python3
"""
SmartCRM Backend Edge Case Testing
Tests error handling and edge cases
"""

import requests
import json
import uuid

BASE_URL = "https://smartcrm-hub-3.preview.emergentagent.com/api"

class EdgeCaseTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.results = {"passed": 0, "failed": 0, "errors": []}
    
    def log_result(self, test_name, success, message=""):
        if success:
            self.results["passed"] += 1
            print(f"✅ {test_name}: PASSED {message}")
        else:
            self.results["failed"] += 1
            self.results["errors"].append(f"{test_name}: {message}")
            print(f"❌ {test_name}: FAILED - {message}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        url = f"{self.base_url}{endpoint}"
        
        if self.token and headers is None:
            headers = {"Authorization": f"Bearer {self.token}"}
        elif self.token and headers:
            headers["Authorization"] = f"Bearer {self.token}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            
            return response
        except requests.exceptions.RequestException as e:
            return None
    
    def setup_auth(self):
        """Setup authentication for tests"""
        test_email = f"edge_test_{uuid.uuid4().hex[:8]}@example.com"
        data = {"email": test_email, "password": "testpassword123"}
        
        response = self.make_request("POST", "/auth/signup", data)
        if response and response.status_code == 200:
            self.token = response.json()["token"]
            return True
        return False
    
    def test_invalid_auth_token(self):
        """Test with invalid JWT token"""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = requests.get(f"{self.base_url}/auth/me", headers=headers, timeout=30)
        
        if response.status_code == 401:
            self.log_result("Invalid Auth Token", True, "Correctly rejected invalid token")
        else:
            self.log_result("Invalid Auth Token", False, f"Expected 401, got {response.status_code}")
    
    def test_missing_auth_token(self):
        """Test endpoints without auth token"""
        response = requests.get(f"{self.base_url}/contacts", timeout=30)
        
        if response.status_code == 403:
            self.log_result("Missing Auth Token", True, "Correctly rejected missing token")
        else:
            self.log_result("Missing Auth Token", False, f"Expected 403, got {response.status_code}")
    
    def test_duplicate_user_signup(self):
        """Test duplicate user signup"""
        test_email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
        data = {"email": test_email, "password": "testpassword123"}
        
        # First signup
        response1 = self.make_request("POST", "/auth/signup", data)
        # Second signup with same email
        response2 = self.make_request("POST", "/auth/signup", data)
        
        if response1 and response1.status_code == 200 and response2 and response2.status_code == 400:
            self.log_result("Duplicate User Signup", True, "Correctly prevented duplicate signup")
        else:
            self.log_result("Duplicate User Signup", False, f"First: {response1.status_code if response1 else 'None'}, Second: {response2.status_code if response2 else 'None'}")
    
    def test_invalid_login_credentials(self):
        """Test login with wrong credentials"""
        data = {"email": "nonexistent@example.com", "password": "wrongpassword"}
        response = self.make_request("POST", "/auth/login", data)
        
        if response and response.status_code == 401:
            self.log_result("Invalid Login Credentials", True, "Correctly rejected invalid credentials")
        else:
            self.log_result("Invalid Login Credentials", False, f"Expected 401, got {response.status_code if response else 'None'}")
    
    def test_nonexistent_contact(self):
        """Test getting nonexistent contact"""
        fake_id = str(uuid.uuid4())
        response = self.make_request("GET", f"/contacts/{fake_id}")
        
        if response and response.status_code == 404:
            self.log_result("Nonexistent Contact", True, "Correctly returned 404 for missing contact")
        else:
            self.log_result("Nonexistent Contact", False, f"Expected 404, got {response.status_code if response else 'None'}")
    
    def test_invalid_contact_data(self):
        """Test creating contact with invalid data"""
        data = {"phone": "", "status": "InvalidStatus"}  # Empty phone, invalid status
        response = self.make_request("POST", "/contacts", data)
        
        # Should fail due to empty phone or validation
        if response and response.status_code >= 400:
            self.log_result("Invalid Contact Data", True, "Correctly rejected invalid contact data")
        else:
            self.log_result("Invalid Contact Data", False, f"Expected 4xx, got {response.status_code if response else 'None'}")
    
    def test_search_contacts(self):
        """Test contact search functionality"""
        # First create a test contact
        data = {
            "phone": f"+1555{uuid.uuid4().hex[:7]}",
            "status": "Follow-up",
            "data": {"name": "Search Test User", "email": "searchtest@example.com"}
        }
        create_response = self.make_request("POST", "/contacts", data)
        
        if not create_response or create_response.status_code != 200:
            self.log_result("Search Contacts", False, "Failed to create test contact")
            return
        
        # Test search by name
        response = requests.get(f"{self.base_url}/contacts?search=Search Test", 
                              headers={"Authorization": f"Bearer {self.token}"}, timeout=30)
        
        if response and response.status_code == 200:
            results = response.json()
            if len(results) > 0 and any("Search Test" in str(contact.get('data', {})) for contact in results):
                self.log_result("Search Contacts", True, f"Found {len(results)} contacts in search")
            else:
                self.log_result("Search Contacts", False, "Search didn't return expected results")
        else:
            self.log_result("Search Contacts", False, f"Search request failed: {response.status_code if response else 'None'}")
    
    def test_filter_contacts_by_status(self):
        """Test filtering contacts by status"""
        response = requests.get(f"{self.base_url}/contacts?status=Follow-up", 
                              headers={"Authorization": f"Bearer {self.token}"}, timeout=30)
        
        if response and response.status_code == 200:
            results = response.json()
            # All results should have Follow-up status
            all_correct_status = all(contact.get('status') == 'Follow-up' for contact in results)
            if all_correct_status:
                self.log_result("Filter Contacts by Status", True, f"Filtered {len(results)} contacts correctly")
            else:
                self.log_result("Filter Contacts by Status", False, "Some contacts had wrong status")
        else:
            self.log_result("Filter Contacts by Status", False, f"Filter request failed: {response.status_code if response else 'None'}")
    
    def test_pagination(self):
        """Test contact pagination"""
        response = requests.get(f"{self.base_url}/contacts?skip=0&limit=5", 
                              headers={"Authorization": f"Bearer {self.token}"}, timeout=30)
        
        if response and response.status_code == 200:
            results = response.json()
            if len(results) <= 5:  # Should respect limit
                self.log_result("Pagination", True, f"Pagination working, got {len(results)} contacts")
            else:
                self.log_result("Pagination", False, f"Limit not respected, got {len(results)} contacts")
        else:
            self.log_result("Pagination", False, f"Pagination request failed: {response.status_code if response else 'None'}")
    
    def run_edge_tests(self):
        """Run all edge case tests"""
        print(f"🧪 Starting SmartCRM Backend Edge Case Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Setup auth for protected endpoint tests
        if not self.setup_auth():
            print("❌ Failed to setup authentication, skipping protected endpoint tests")
            return False
        
        print("\n🔒 AUTHENTICATION EDGE CASES")
        self.test_invalid_auth_token()
        self.test_missing_auth_token()
        self.test_duplicate_user_signup()
        self.test_invalid_login_credentials()
        
        print("\n👥 CONTACT EDGE CASES")
        self.test_nonexistent_contact()
        self.test_invalid_contact_data()
        self.test_search_contacts()
        self.test_filter_contacts_by_status()
        self.test_pagination()
        
        # Results
        print("\n" + "=" * 60)
        print(f"🏁 EDGE CASE TEST RESULTS")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"📊 Total: {self.results['passed'] + self.results['failed']}")
        
        if self.results['errors']:
            print(f"\n🚨 FAILED TESTS:")
            for error in self.results['errors']:
                print(f"   • {error}")
        
        return self.results['failed'] == 0

if __name__ == "__main__":
    tester = EdgeCaseTester()
    success = tester.run_edge_tests()
    
    if success:
        print(f"\n🎉 All edge case tests passed!")
    else:
        print(f"\n💥 Some edge case tests failed!")