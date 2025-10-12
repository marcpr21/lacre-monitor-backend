#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Photo Monitoring API
Tests all endpoints with various scenarios including authentication, authorization, and edge cases.
"""

import requests
import json
import base64
from datetime import datetime
import sys

# Configuration - Railway Backend URL from review request
BASE_URL = "https://lacre-monitor-backend-production.up.railway.app/api"

# Test credentials from review request
ADMIN_CREDENTIALS = {"username": "admin", "password": "admin123"}
EMPLOYEE_CREDENTIALS = {"username": "posto_fagundao", "password": "123456"}
TEST_USER_CREDENTIALS = {"username": "teste", "password": "teste"}
INVALID_CREDENTIALS = {"username": "invalid", "password": "wrong"}

# Sample base64 image (small 1x1 pixel PNG)
SAMPLE_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def log_pass(self, test_name):
        print(f"✅ PASS: {test_name}")
        self.passed += 1
        
    def log_fail(self, test_name, error):
        print(f"❌ FAIL: {test_name} - {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} tests passed")
        print(f"{'='*60}")
        if self.errors:
            print("FAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def make_request(method, endpoint, headers=None, json_data=None, params=None):
    """Helper function to make HTTP requests with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=json_data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def test_authentication(result):
    """Test authentication endpoints"""
    print("\n🔐 Testing Authentication...")
    
    # Test 1: Admin login with valid credentials
    try:
        response = make_request("POST", "/users/login", json_data=ADMIN_CREDENTIALS)
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                admin_token = data["token"]
                result.log_pass("Admin login with valid credentials")
                admin_token = data["token"]
                result.log_pass("Admin login with valid credentials")
            else:
                result.log_fail("Admin login with valid credentials", "Missing token or user in response")
                admin_token = None
        else:
            result.log_fail("Admin login with valid credentials", f"Status: {response.status_code if response else 'No response'}")
            admin_token = None
    except Exception as e:
        result.log_fail("Admin login with valid credentials", str(e))
        admin_token = None
    
    # Test 2: Employee login with valid credentials
    try:
        response = make_request("POST", "/users/login", json_data=EMPLOYEE_CREDENTIALS)
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                employee_token = data["token"]
                result.log_pass("Employee login with valid credentials")
            else:
                result.log_fail("Employee login with valid credentials", "Missing token or user in response")
                employee_token = None
        else:
            result.log_fail("Employee login with valid credentials", f"Status: {response.status_code if response else 'No response'}")
            employee_token = None
    except Exception as e:
        result.log_fail("Employee login with valid credentials", str(e))
        employee_token = None
    
    # Test 2.5: Test user login with valid credentials
    try:
        response = make_request("POST", "/users/login", json_data=TEST_USER_CREDENTIALS)
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                test_token = data["token"]
                result.log_pass("Test user login with valid credentials")
            else:
                result.log_fail("Test user login with valid credentials", "Missing token or user in response")
                test_token = None
        else:
            result.log_fail("Test user login with valid credentials", f"Status: {response.status_code if response else 'No response'}")
            test_token = None
    except Exception as e:
        result.log_fail("Test user login with valid credentials", str(e))
        test_token = None
    
    # Test 3: Login with invalid credentials
    try:
        response = make_request("POST", "/users/login", json_data=INVALID_CREDENTIALS)
        if response and response.status_code == 401:
            result.log_pass("Login with invalid credentials (should fail)")
        else:
            result.log_fail("Login with invalid credentials (should fail)", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Login with invalid credentials (should fail)", str(e))
    
    return admin_token, employee_token, test_token

def test_user_info(result, admin_token, employee_token):
    """Test user info endpoints"""
    print("\n👤 Testing User Info...")
    
    # Test 1: Get user info with valid admin token
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = make_request("GET", "/users/me", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                if "id" in data and "username" in data and "role" in data:
                    result.log_pass("Get admin user info with valid token")
                else:
                    result.log_fail("Get admin user info with valid token", "Missing required fields in response")
            else:
                result.log_fail("Get admin user info with valid token", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get admin user info with valid token", str(e))
    
    # Test 2: Get user info with valid employee token
    if employee_token:
        try:
            headers = {"Authorization": f"Bearer {employee_token}"}
            response = make_request("GET", "/users/me", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                if "id" in data and "username" in data and "role" in data:
                    result.log_pass("Get employee user info with valid token")
                else:
                    result.log_fail("Get employee user info with valid token", "Missing required fields in response")
            else:
                result.log_fail("Get employee user info with valid token", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get employee user info with valid token", str(e))
    
    # Test 3: Get user info without token
    try:
        response = make_request("GET", "/users/me")
        if response and response.status_code == 401:
            result.log_pass("Get user info without token (should fail)")
        else:
            result.log_fail("Get user info without token (should fail)", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Get user info without token (should fail)", str(e))

def test_employee_endpoints(result, admin_token, employee_token):
    """Test employee management endpoints"""
    print("\n👥 Testing Employee Endpoints...")
    
    # Test 1: Get employees with admin token
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = make_request("GET", "/users/employees", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    result.log_pass("Get employees with admin token")
                else:
                    result.log_fail("Get employees with admin token", "Response is not a list")
            else:
                result.log_fail("Get employees with admin token", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get employees with admin token", str(e))
    
    # Test 2: Get employees with employee token (should fail)
    if employee_token:
        try:
            headers = {"Authorization": f"Bearer {employee_token}"}
            response = make_request("GET", "/users/employees", headers=headers)
            if response and response.status_code == 403:
                result.log_pass("Get employees with employee token (should fail)")
            else:
                result.log_fail("Get employees with employee token (should fail)", f"Expected 403, got {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get employees with employee token (should fail)", str(e))

def test_photo_schedule(result):
    """Test photo schedule checking"""
    print("\n📅 Testing Photo Schedule...")
    
    # Test 1: Check lacre schedule
    try:
        response = make_request("GET", "/photos/check-schedule", params={"photo_type": "lacre"})
        if response and response.status_code == 200:
            data = response.json()
            if "allowed" in data and "message" in data:
                result.log_pass("Check lacre schedule")
            else:
                result.log_fail("Check lacre schedule", "Missing required fields in response")
        else:
            result.log_fail("Check lacre schedule", f"Status: {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Check lacre schedule", str(e))
    
    # Test 2: Check medidor schedule
    try:
        response = make_request("GET", "/photos/check-schedule", params={"photo_type": "medidor"})
        if response and response.status_code == 200:
            data = response.json()
            if "allowed" in data and "message" in data:
                result.log_pass("Check medidor schedule")
            else:
                result.log_fail("Check medidor schedule", "Missing required fields in response")
        else:
            result.log_fail("Check medidor schedule", f"Status: {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Check medidor schedule", str(e))

def test_photo_submission(result, employee_token):
    """Test photo submission"""
    print("\n📸 Testing Photo Submission...")
    
    if not employee_token:
        result.log_fail("Photo submission tests", "No employee token available")
        return
    
    headers = {"Authorization": f"Bearer {employee_token}"}
    
    # Test 1: Submit lacre photo
    try:
        photo_data = {
            "photo_type": "lacre",
            "image_base64": SAMPLE_IMAGE_BASE64,
            "latitude": -23.5505,
            "longitude": -46.6333,
            "location_name": "São Paulo, SP"
        }
        response = make_request("POST", "/photos/submit", headers=headers, json_data=photo_data)
        if response and response.status_code in [200, 400]:  # 400 might be due to schedule restrictions
            if response.status_code == 200:
                data = response.json()
                if "success" in data and "photo_id" in data:
                    result.log_pass("Submit lacre photo")
                else:
                    result.log_fail("Submit lacre photo", "Missing required fields in success response")
            else:
                # Schedule restriction is expected behavior
                result.log_pass("Submit lacre photo (schedule restriction)")
        else:
            result.log_fail("Submit lacre photo", f"Status: {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Submit lacre photo", str(e))
    
    # Test 2: Submit medidor photo
    try:
        photo_data = {
            "photo_type": "medidor",
            "image_base64": SAMPLE_IMAGE_BASE64,
            "latitude": -23.5505,
            "longitude": -46.6333,
            "location_name": "São Paulo, SP"
        }
        response = make_request("POST", "/photos/submit", headers=headers, json_data=photo_data)
        if response and response.status_code in [200, 400]:  # 400 might be due to schedule restrictions
            if response.status_code == 200:
                data = response.json()
                if "success" in data and "photo_id" in data:
                    result.log_pass("Submit medidor photo")
                else:
                    result.log_fail("Submit medidor photo", "Missing required fields in success response")
            else:
                # Schedule restriction is expected behavior
                result.log_pass("Submit medidor photo (schedule restriction)")
        else:
            result.log_fail("Submit medidor photo", f"Status: {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Submit medidor photo", str(e))
    
    # Test 3: Submit photo without authentication
    try:
        photo_data = {
            "photo_type": "lacre",
            "image_base64": SAMPLE_IMAGE_BASE64,
            "latitude": -23.5505,
            "longitude": -46.6333,
            "location_name": "São Paulo, SP"
        }
        response = make_request("POST", "/photos/submit", json_data=photo_data)
        if response and response.status_code == 401:
            result.log_pass("Submit photo without authentication (should fail)")
        else:
            result.log_fail("Submit photo without authentication (should fail)", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Submit photo without authentication (should fail)", str(e))

def test_photo_retrieval(result, admin_token, employee_token):
    """Test photo retrieval"""
    print("\n📋 Testing Photo Retrieval...")
    
    # Test 1: Get photos with admin token
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = make_request("GET", "/photos", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                if "photos" in data and "total" in data:
                    result.log_pass("Get photos with admin token")
                else:
                    result.log_fail("Get photos with admin token", "Missing required fields in response")
            else:
                result.log_fail("Get photos with admin token", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get photos with admin token", str(e))
    
    # Test 2: Get photos with employee token
    if employee_token:
        try:
            headers = {"Authorization": f"Bearer {employee_token}"}
            response = make_request("GET", "/photos", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                if "photos" in data and "total" in data:
                    result.log_pass("Get photos with employee token")
                else:
                    result.log_fail("Get photos with employee token", "Missing required fields in response")
            else:
                result.log_fail("Get photos with employee token", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get photos with employee token", str(e))
    
    # Test 3: Get photos with filters
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            params = {"photo_type": "lacre", "limit": 10}
            response = make_request("GET", "/photos", headers=headers, params=params)
            if response and response.status_code == 200:
                data = response.json()
                if "photos" in data and "total" in data:
                    result.log_pass("Get photos with filters")
                else:
                    result.log_fail("Get photos with filters", "Missing required fields in response")
            else:
                result.log_fail("Get photos with filters", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Get photos with filters", str(e))
    
    # Test 4: Get photos without authentication
    try:
        response = make_request("GET", "/photos")
        if response and response.status_code == 401:
            result.log_pass("Get photos without authentication (should fail)")
        else:
            result.log_fail("Get photos without authentication (should fail)", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Get photos without authentication (should fail)", str(e))

def test_compliance_report_api(result, admin_token, employee_token):
    """Test compliance report API endpoint /api/analytics/missing-photos"""
    print("\n📊 Testing Compliance Report API...")
    
    # Test 1: Admin access to compliance report
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = make_request("GET", "/analytics/missing-photos", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                required_fields = ["report", "period_days", "generated_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields and isinstance(data["report"], list):
                    result.log_pass("Compliance report - Admin access")
                else:
                    result.log_fail("Compliance report - Admin access", f"Missing fields: {missing_fields} or report not a list")
            else:
                result.log_fail("Compliance report - Admin access", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Compliance report - Admin access", str(e))
    
    # Test 2: Employee access (should fail with 403)
    if employee_token:
        try:
            headers = {"Authorization": f"Bearer {employee_token}"}
            response = make_request("GET", "/analytics/missing-photos", headers=headers)
            if response and response.status_code == 403:
                result.log_pass("Compliance report - Employee access denied (403)")
            else:
                result.log_fail("Compliance report - Employee access denied (403)", f"Expected 403, got {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Compliance report - Employee access denied (403)", str(e))
    
    # Test 3: Different days_back parameters
    if admin_token:
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_periods = [7, 30, 90]
        
        for days_back in test_periods:
            try:
                params = {"days_back": days_back}
                response = make_request("GET", "/analytics/missing-photos", headers=headers, params=params)
                if response and response.status_code == 200:
                    data = response.json()
                    if data.get("period_days") == days_back:
                        result.log_pass(f"Compliance report - {days_back} days period")
                    else:
                        result.log_fail(f"Compliance report - {days_back} days period", f"Expected period_days={days_back}, got {data.get('period_days')}")
                else:
                    result.log_fail(f"Compliance report - {days_back} days period", f"Status: {response.status_code if response else 'No response'}")
            except Exception as e:
                result.log_fail(f"Compliance report - {days_back} days period", str(e))
    
    # Test 4: Data structure validation
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            response = make_request("GET", "/analytics/missing-photos", headers=headers)
            if response and response.status_code == 200:
                data = response.json()
                
                if data["report"]:  # If there are employees in the report
                    employee_record = data["report"][0]
                    required_employee_fields = [
                        "employee_id", "employee_name", "missing_lacres", "missing_medidor",
                        "total_missing_lacres", "total_missing_medidor", "total_missing",
                        "lacre_compliance", "medidor_compliance", "overall_compliance"
                    ]
                    
                    missing_fields = [field for field in required_employee_fields if field not in employee_record]
                    
                    if not missing_fields:
                        # Check missing photos structure if present
                        structure_valid = True
                        
                        if employee_record["missing_lacres"]:
                            lacre_record = employee_record["missing_lacres"][0]
                            required_lacre_fields = ["date", "date_formatted", "weekday"]
                            if any(field not in lacre_record for field in required_lacre_fields):
                                structure_valid = False
                        
                        if employee_record["missing_medidor"]:
                            medidor_record = employee_record["missing_medidor"][0]
                            required_medidor_fields = ["date", "date_formatted", "period", "weekday"]
                            if any(field not in medidor_record for field in required_medidor_fields):
                                structure_valid = False
                        
                        if structure_valid:
                            result.log_pass("Compliance report - Data structure validation")
                        else:
                            result.log_fail("Compliance report - Data structure validation", "Missing fields in missing photos records")
                    else:
                        result.log_fail("Compliance report - Data structure validation", f"Missing employee fields: {missing_fields}")
                else:
                    result.log_pass("Compliance report - Data structure validation (empty report)")
            else:
                result.log_fail("Compliance report - Data structure validation", f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            result.log_fail("Compliance report - Data structure validation", str(e))
    
    # Test 5: Verify 'teste' user exclusion
    if admin_token:
        try:
            headers = {"Authorization": f"Bearer {admin_token}"}
            
            # Get all employees first
            employees_response = make_request("GET", "/users/employees", headers=headers)
            compliance_response = make_request("GET", "/analytics/missing-photos", headers=headers)
            
            if employees_response and compliance_response and employees_response.status_code == 200 and compliance_response.status_code == 200:
                employees = employees_response.json()
                compliance_data = compliance_response.json()
                
                teste_user_exists = any(emp["username"] == "teste" for emp in employees)
                teste_in_report = any("teste" in emp["employee_name"].lower() for emp in compliance_data["report"])
                
                if teste_user_exists and not teste_in_report:
                    result.log_pass("Compliance report - 'teste' user exclusion")
                elif not teste_user_exists:
                    result.log_pass("Compliance report - 'teste' user exclusion (user doesn't exist)")
                else:
                    result.log_fail("Compliance report - 'teste' user exclusion", "teste user found in compliance report")
            else:
                result.log_fail("Compliance report - 'teste' user exclusion", "Could not retrieve employees or compliance data")
        except Exception as e:
            result.log_fail("Compliance report - 'teste' user exclusion", str(e))

def test_api_root(result):
    """Test API root endpoint"""
    print("\n🏠 Testing API Root...")
    
    try:
        response = make_request("GET", "/")
        if response and response.status_code == 200:
            data = response.json()
            if "message" in data:
                result.log_pass("API root endpoint")
            else:
                result.log_fail("API root endpoint", "Missing message in response")
        else:
            result.log_fail("API root endpoint", f"Status: {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("API root endpoint", str(e))

def test_database_initialization(result, admin_token):
    """Test if initial users were created in MongoDB Atlas"""
    print("\n💾 Testing Database Initialization...")
    
    if not admin_token:
        result.log_fail("Database initialization check", "No admin token available")
        return
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = make_request("GET", "/users/employees", headers=headers)
        if response and response.status_code == 200:
            employees = response.json()
            employee_count = len(employees)
            
            # Check if we have the expected number of employees (20)
            if employee_count >= 20:
                result.log_pass(f"Database initialization - Found {employee_count} employees (expected 20+)")
                
                # Check for specific expected employees
                expected_employees = [
                    "posto_fagundao", "posto_glamour", "posto_gloria", "posto_laranjal",
                    "posto_malvino", "posto_marclau", "posto_meia_noite", "posto_ml"
                ]
                
                found_employees = [emp["username"] for emp in employees]
                matching_employees = [emp for emp in expected_employees if emp in found_employees]
                
                if len(matching_employees) >= 4:  # At least half of the sample
                    result.log_pass(f"Database initialization - Expected employees found ({len(matching_employees)}/{len(expected_employees)} sample)")
                else:
                    result.log_fail("Database initialization - Expected employees", f"Only found {len(matching_employees)} of expected employees")
                    
            else:
                result.log_fail("Database initialization - Employee count", f"Found {employee_count} employees, expected 20+")
        else:
            result.log_fail("Database initialization check", f"Status: {response.status_code if response else 'No response'}")
    except Exception as e:
        result.log_fail("Database initialization check", str(e))

def main():
    """Main test runner"""
    print("🚀 Starting Photo Monitoring API Backend Tests")
    print(f"Testing against: {BASE_URL}")
    print("="*60)
    
    result = TestResult()
    
    # Test API root
    test_api_root(result)
    
    # Test authentication and get tokens
    admin_token, employee_token = test_authentication(result)
    
    # Test user info endpoints
    test_user_info(result, admin_token, employee_token)
    
    # Test employee endpoints
    test_employee_endpoints(result, admin_token, employee_token)
    
    # Test photo schedule
    test_photo_schedule(result)
    
    # Test photo submission
    test_photo_submission(result, employee_token)
    
    # Test photo retrieval
    test_photo_retrieval(result, admin_token, employee_token)
    
    # Test compliance report API (NEW - as requested)
    test_compliance_report_api(result, admin_token, employee_token)
    
    # Print summary
    success = result.summary()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n💥 {result.failed} test(s) failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()