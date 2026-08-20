# Asset Management API Documentation

## Base URL
```
http://localhost:{port}/api/v1
```

## Authentication
Most endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer {access_token}
```

For login endpoints, a refresh token is set as an HTTP-only cookie:
```
Cookie: refreshToken={token}; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict
```

## Standard Response Format
All endpoints return a standardized JSON response:

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

---

## Module: Authentication

### POST /auth/login
Authenticate user and receive tokens.

**Headers:** None (public endpoint)

**Rate Limiting:** Yes

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "user": {
      "_id": "objectId",
      "name": "string",
      "email": "user@example.com",
      "role": "super_admin|asset_manager|employee",
      "employeeId": "objectId|null",
      "isActive": true
    },
    "accessToken": "jwt_token_string"
  }
}
```

**Cookies:** Sets `refreshToken` as HTTP-only cookie

---

### POST /auth/refresh-token
Refresh access token using refresh token from cookie.

**Headers:** None

**Request Body:** None (uses cookie)

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "new_jwt_token_string"
  }
}
```

**Cookies:** Refreshes `refreshToken` cookie

---

### POST /auth/forgot-password
Request password reset email.

**Headers:** None (public endpoint)

**Rate Limiting:** Yes

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password reset email sent",
  "data": { ... }
}
```

---

### POST /auth/reset-password
Reset password using token from email.

**Headers:** None (public endpoint)

**Rate Limiting:** Yes

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "string (min 8 chars, must contain uppercase, lowercase, and number)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password reset successfully",
  "data": { ... }
}
```

---

### POST /auth/logout
Logout user and clear refresh token cookie.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:** None

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

**Cookies:** Clears `refreshToken` cookie

---

### GET /auth/me
Get current authenticated user details.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:** None

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Current user fetched successfully",
  "data": {
    "_id": "objectId",
    "name": "string",
    "email": "user@example.com",
    "role": "super_admin|asset_manager|employee",
    "employeeId": "objectId|null",
    "isActive": true,
    "createdAt": "ISODate",
    "updatedAt": "ISODate"
  }
}
```

---

## Module: Users

### PATCH /users/me
Update own profile (any authenticated user).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "name": "string (2-100 chars)",
  "email": "valid@email.com"
}
```
*At least one field required*

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Profile updated successfully",
  "data": { ...user_object... }
}
```

---

### PATCH /users/me/password
Change own password (any authenticated user).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8 chars, must contain uppercase, lowercase, and number)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password changed successfully. Please log in again.",
  "data": null
}
```

---

### GET /users
List all users with pagination and filtering.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
page: number (min 1)
limit: number (min 1, max 100)
role: "super_admin|asset_manager|employee"
isActive: boolean
search: string (matches name or email, max 100 chars)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "users": [ ...user_objects... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

---

### GET /users/:id
Get specific user by ID.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User fetched successfully",
  "data": { ...user_object... }
}
```

---

### PATCH /users/:id/role
Update user role.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Request Body:**
```json
{
  "role": "super_admin|asset_manager|employee"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "User role updated successfully",
  "data": { ...user_object... }
}
```

---

## Module: Dashboard

### GET /dashboard/stats
Get dashboard statistics.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Dashboard stats fetched successfully",
  "data": {
    "totalAssets": 100,
    "availableAssets": 50,
    "assignedAssets": 40,
    "underMaintenance": 10,
    "totalEmployees": 75,
    "activeEmployees": 70,
    "totalAssignments": 40,
    "activeAssignments": 35
  }
}
```

---

### GET /dashboard/charts
Get dashboard chart data.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
months: number (1-12, default 6)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Dashboard charts fetched successfully",
  "data": {
    "assetCategoryDistribution": [ ... ],
    "assignmentTrend": [ ... ],
    "maintenanceCostTrend": [ ... ]
  }
}
```

---

### GET /dashboard/kpis
Get dashboard KPIs.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Dashboard KPIs fetched successfully",
  "data": {
    "assetUtilizationRate": 0.85,
    "averageAssignmentDuration": 180,
    "maintenanceCostPerAsset": 500,
    "licenseUtilizationRate": 0.92
  }
}
```

---

## Module: Assets

### GET /assets
List all assets with pagination and filtering.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
page: number (min 1)
limit: number (min 1, max 100)
category: "laptop|desktop|server|networking_device|mobile_device|printer|accessory|software_license"
status: "available|assigned|under_maintenance|in_repair|retired|disposed|lost"
search: string (max 100 chars)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Assets fetched successfully",
  "data": {
    "assets": [ ...asset_objects... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

---

### GET /assets/:id
Get specific asset by ID.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset fetched successfully",
  "data": {
    "_id": "objectId",
    "assetTag": "string",
    "assetKind": "hardware|software_license",
    "category": "string",
    "name": "string",
    "brand": "string",
    "modelName": "string",
    "status": "string",
    "vendor": "string",
    "purchaseDate": "ISODate",
    "purchasePrice": number,
    "warrantyExpiryDate": "ISODate",
    "location": "string",
    "notes": "string",
    "attachments": [ ... ],
    // Hardware-specific fields
    "serialNumber": "string",
    "condition": "new|good|fair|damaged",
    "specifications": { ... },
    // License-specific fields
    "licenseKey": "string",
    "totalSeats": number,
    "seatsAllocated": number,
    "expiryDate": "ISODate",
    // Additional context
    "currentAssignment": { ... }, // for hardware
    "activeSeats": [ ... ] // for licenses
  }
}
```

---

### POST /assets
Create new asset.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body (Hardware):**
```json
{
  "category": "laptop|desktop|server|networking_device|mobile_device|printer|accessory",
  "name": "string (2-150 chars)",
  "brand": "string (max 100 chars)",
  "modelName": "string (max 100 chars)",
  "vendor": "string (max 150 chars)",
  "purchaseDate": "ISODate",
  "purchasePrice": number (min 0),
  "warrantyExpiryDate": "ISODate",
  "location": "string (max 150 chars)",
  "notes": "string (max 1000 chars)",
  "serialNumber": "string (required for hardware)",
  "condition": "new|good|fair|damaged",
  "specifications": { "key": "value" }
}
```

**Request Body (Software License):**
```json
{
  "category": "software_license",
  "name": "string (2-150 chars)",
  "brand": "string (max 100 chars)",
  "vendor": "string (max 150 chars)",
  "purchaseDate": "ISODate",
  "purchasePrice": number (min 0),
  "warrantyExpiryDate": "ISODate",
  "location": "string (max 150 chars)",
  "notes": "string (max 1000 chars)",
  "licenseKey": "string (required for software)",
  "totalSeats": number (min 1, required for software)",
  "expiryDate": "ISODate"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Asset created successfully",
  "data": { ...asset_object... }
}
```

---

### PATCH /assets/:id
Update asset details.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "name": "string (2-150 chars)",
  "brand": "string (max 100 chars)",
  "modelName": "string (max 100 chars)",
  "vendor": "string (max 150 chars)",
  "purchaseDate": "ISODate",
  "purchasePrice": number (min 0),
  "warrantyExpiryDate": "ISODate",
  "location": "string (max 150 chars)",
  "notes": "string (max 1000 chars)",
  "condition": "new|good|fair|damaged",
  "specifications": { "key": "value" }
}
```
*At least one field required. Cannot update category or assetTag.*

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset updated successfully",
  "data": { ...asset_object... }
}
```

---

### PATCH /assets/:id/status
Update asset status.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "status": "available|under_maintenance|in_repair|retired|disposed|lost",
  "reason": "string (max 500 chars)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset status updated successfully",
  "data": { ...asset_object... }
}
```

---

### POST /assets/:id/attachments
Upload attachment to asset.

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```
file: (binary file upload)
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Attachment uploaded successfully",
  "data": { ...asset_object... }
}
```

---

### DELETE /assets/:id/attachments
Delete attachment from asset.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
fileKey: string (required)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Attachment deleted successfully",
  "data": { ...asset_object... }
}
```

---

## Module: Employees

### GET /employees/me
Get own employee profile (for authenticated users with linked employee).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Employee profile fetched successfully",
  "data": {
    "_id": "objectId",
    "employeeCode": "string",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "department": "string",
    "designation": "string",
    "workLocation": "string",
    "employmentType": "full_time|part_time|contract|intern",
    "employmentStatus": "active|on_leave|resigned|terminated",
    "dateOfJoining": "ISODate",
    "dateOfLeaving": "ISODate",
    "reportingManager": "objectId",
    "fullName": "string (virtual)",
    "createdAt": "ISODate",
    "updatedAt": "ISODate"
  }
}
```

---

### GET /employees
List all employees with pagination and filtering.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
page: number (min 1)
limit: number (min 1, max 100)
department: string
employmentStatus: "active|on_leave|resigned|terminated"
employmentType: "full_time|part_time|contract|intern"
search: string (max 100 chars)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Employees fetched successfully",
  "data": {
    "employees": [ ...employee_objects... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

---

### GET /employees/:id
Get specific employee by ID.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Employee fetched successfully",
  "data": { ...employee_object... }
}
```

---

### POST /employees
Create new employee.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Request Body:**
```json
{
  "firstName": "string (2-50 chars)",
  "lastName": "string (2-50 chars)",
  "email": "valid@email.com",
  "phone": "string (max 20 chars)",
  "department": "string (max 100 chars)",
  "designation": "string (max 100 chars)",
  "workLocation": "string (max 100 chars)",
  "employmentType": "full_time|part_time|contract|intern",
  "dateOfJoining": "ISODate",
  "reportingManager": "objectId (24-char hex)"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Employee created successfully",
  "data": { ...employee_object... }
}
```

---

### PATCH /employees/:id
Update employee details.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Request Body:**
```json
{
  "firstName": "string (2-50 chars)",
  "lastName": "string (2-50 chars)",
  "email": "valid@email.com",
  "phone": "string (max 20 chars)",
  "department": "string (max 100 chars)",
  "designation": "string (max 100 chars)",
  "workLocation": "string (max 100 chars)",
  "employmentType": "full_time|part_time|contract|intern",
  "reportingManager": "objectId (24-char hex)"
}
```
*At least one field required*

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Employee updated successfully",
  "data": { ...employee_object... }
}
```

---

### PATCH /employees/:id/employment-status
Update employee employment status.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Request Body:**
```json
{
  "employmentStatus": "active|on_leave|resigned|terminated",
  "dateOfLeaving": "ISODate (required if status is resigned or terminated)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Employment status updated successfully",
  "data": { ...employee_object... }
}
```

---

### POST /employees/:id/grant-access
Grant system access to employee (creates user account).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Request Body:**
```json
{
  "email": "valid@email.com (optional, defaults to employee email)",
  "password": "string (min 8 chars, must contain uppercase, lowercase, and number)",
  "role": "super_admin|asset_manager|employee (default: employee)"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "System access granted successfully",
  "data": { ...user_object... }
}
```

---

### POST /employees/:id/revoke-access
Revoke system access from employee.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Request Body:** None

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "System access revoked successfully",
  "data": { ...employee_object... }
}
```

---

## Module: Asset Assignments

### GET /asset-assignments
List all asset assignments with pagination and filtering.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
page: number (min 1)
limit: number (min 1, max 100)
asset: objectId (24-char hex)
employee: objectId (24-char hex)
assetKind: "hardware|software_license"
status: "active|returned|lost|revoked"
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Assignments fetched successfully",
  "data": {
    "assignments": [ ...assignment_objects... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

---

### POST /asset-assignments
Assign asset to employee (works for both hardware and software).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "asset": "objectId (24-char hex)",
  "employee": "objectId (24-char hex)",
  "expectedReturnDate": "ISODate (hardware-only)",
  "conditionAtAssignment": "new|good|fair|damaged (required for hardware)",
  "remarks": "string (max 500 chars)"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Asset assigned successfully",
  "data": {
    "_id": "objectId",
    "asset": "objectId",
    "assetKind": "hardware|software_license",
    "employee": "objectId",
    "assignedDate": "ISODate",
    "assignedBy": "objectId",
    "remarks": "string",
    // Hardware-specific
    "status": "active|returned|lost",
    "expectedReturnDate": "ISODate",
    "returnedDate": "ISODate",
    "conditionAtAssignment": "string",
    "conditionAtReturn": "string",
    "returnedBy": "objectId",
    "returnRemarks": "string",
    // License-specific
    "revokedDate": "ISODate",
    "revokedBy": "objectId",
    "revokeRemarks": "string"
  }
}
```

---

### PATCH /asset-assignments/:id/return
Return hardware asset.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "conditionAtReturn": "new|good|fair|damaged",
  "returnRemarks": "string (max 500 chars)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset returned successfully",
  "data": { ...assignment_object... }
}
```

---

### PATCH /asset-assignments/:id/report-lost
Report hardware asset as lost.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "remarks": "string (max 500 chars)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset reported lost",
  "data": { ...assignment_object... }
}
```

---

### PATCH /asset-assignments/:id/revoke
Revoke license seat.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "revokeRemarks": "string (max 500 chars)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "License seat revoked successfully",
  "data": { ...assignment_object... }
}
```

---

### GET /asset-assignments/asset/:assetId/history
Get assignment history for a specific asset.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset assignment history fetched successfully",
  "data": [ ...assignment_objects... ]
}
```

---

### GET /asset-assignments/employee/:employeeId
Get active assignments for a specific employee.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Employee assignments fetched successfully",
  "data": [ ...assignment_objects... ]
}
```

---

## Module: Maintenance

### GET /maintenance
List all maintenance records with pagination and filtering.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
page: number (min 1)
limit: number (min 1, max 100)
asset: objectId (24-char hex)
type: "maintenance|repair"
status: "open|completed|cancelled"
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Maintenance records fetched successfully",
  "data": {
    "records": [ ...maintenance_objects... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

---

### POST /maintenance
Open new maintenance record.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "asset": "objectId (24-char hex)",
  "type": "maintenance|repair",
  "description": "string (5-1000 chars)",
  "vendor": "string (max 150 chars)",
  "cost": number (min 0),
  "scheduledDate": "ISODate"
}
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Maintenance record opened successfully",
  "data": {
    "_id": "objectId",
    "asset": "objectId",
    "type": "maintenance|repair",
    "status": "open",
    "description": "string",
    "vendor": "string",
    "cost": number,
    "scheduledDate": "ISODate",
    "startedDate": "ISODate",
    "completedDate": "ISODate",
    "resolvedNotes": "string",
    "createdBy": "objectId",
    "createdAt": "ISODate",
    "updatedAt": "ISODate"
  }
}
```

---

### GET /maintenance/:id
Get specific maintenance record by ID.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Maintenance record fetched successfully",
  "data": { ...maintenance_object... }
}
```

---

### PATCH /maintenance/:id/complete
Complete maintenance record.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "resolvedNotes": "string (max 1000 chars)",
  "cost": number (min 0)
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Maintenance record completed",
  "data": { ...maintenance_object... }
}
```

---

### PATCH /maintenance/:id/cancel
Cancel maintenance record.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Request Body:**
```json
{
  "resolvedNotes": "string (max 1000 chars)"
}
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Maintenance record cancelled",
  "data": { ...maintenance_object... }
}
```

---

### GET /maintenance/asset/:assetId/history
Get maintenance history for a specific asset.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Asset maintenance history fetched successfully",
  "data": [ ...maintenance_objects... ]
}
```

---

## Module: Reports

### GET /reports/download
Download report in various formats.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
type: "asset_inventory|asset_assignments|maintenance_log|employee_assets"
format: "csv|xlsx|pdf"
status: string (optional)
category: "laptop|desktop|server|networking_device|mobile_device|printer|accessory|software_license"
startDate: ISODate
endDate: ISODate (must be >= startDate)
```

**Response:** Binary file stream (CSV, XLSX, or PDF)

**Response Headers:**
```
Content-Type: application/csv|application/vnd.openxmlformats-officedocument.spreadsheetml.sheet|application/pdf
Content-Disposition: attachment; filename="report_name.ext"
```

---

## Module: Files

### POST /files/upload
Upload file to storage.

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
folder: string (default: "general")
```

**Request Body:**
```
file: (binary file upload)
```

**Response (201):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileKey": "string",
    "url": "string",
    "originalName": "string",
    "mimeType": "string",
    "size": number
  }
}
```

---

### DELETE /files
Delete file from storage.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
fileKey: string (required, URL-encoded if needed)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "File deleted successfully",
  "data": null
}
```

---

### GET /files/signed-url
Generate signed URL for file access.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN, ASSET_MANAGER

**Query Parameters:**
```
fileKey: string (required, URL-encoded if needed)
expires: number (seconds, max 86400, default 3600)
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Signed URL generated",
  "data": {
    "url": "string (presigned URL)",
    "expiresInSeconds": number
  }
}
```

---

## Module: Audit Logs

### GET /audit-logs
List audit logs with pagination and filtering.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Query Parameters:**
```
page: number (min 1)
limit: number (min 1, max 100)
action: "USER_REGISTERED|USER_LOGIN_SUCCESS|USER_LOGIN_FAILED|USER_LOGOUT|USER_PASSWORD_CHANGED|USER_CREATED_BY_ADMIN|USER_PROFILE_UPDATED|USER_ROLE_CHANGED|USER_STATUS_CHANGED|USER_LOGGED_IN|USER_PASSWORD_RESET|EMPLOYEE_CREATED|EMPLOYEE_UPDATED|EMPLOYEE_STATUS_CHANGED|USER_ACCESS_GRANTED|USER_ACCESS_REVOKED|ASSET_CREATED|ASSET_UPDATED|ASSET_STATUS_CHANGED|ASSET_ASSIGNED|ASSET_RETURNED|LICENSE_SEAT_ALLOCATED|LICENSE_SEAT_REVOKED|MAINTENANCE_STARTED|MAINTENANCE_COMPLETED|MAINTENANCE_CANCELLED|REPORT_DOWNLOADED"
entityType: string (e.g., "User", "Asset", "Employee")
entityId: objectId (24-char hex)
actorId: objectId (24-char hex)
status: "SUCCESS|FAILURE"
dateFrom: ISODate
dateTo: ISODate
```

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Audit logs fetched successfully",
  "data": {
    "logs": [ ...audit_log_objects... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

**Audit Log Object:**
```json
{
  "_id": "objectId",
  "actor": {
    "id": "objectId",
    "name": "string",
    "email": "string",
    "role": "string"
  },
  "action": "string",
  "status": "SUCCESS|FAILURE",
  "entityType": "string",
  "entityId": "objectId",
  "description": "string",
  "changes": {
    "before": { ... },
    "after": { ... }
  },
  "metadata": {
    "ipAddress": "string",
    "userAgent": "string"
  },
  "createdAt": "ISODate"
}
```

---

### GET /audit-logs/:entityType/:entityId
Get audit history for a specific entity.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Authorization:** SUPER_ADMIN only

**Response (200):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Entity history fetched successfully",
  "data": [ ...audit_log_objects... ]
}
```

---

## Health Check

### GET /health
Check API health status.

**Headers:** None

**Response (200):**
```json
{
  "status": "ok",
  "message": "Asset Management API is running",
  "environment": "development|production|test"
}
```

---

### GET /
Root endpoint.

**Headers:** None

**Response (200):**
```json
{
  "status": "ok",
  "message": "Asset Management API is running",
  "environment": "development|production|test"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "statusCode": 400|401|403|404|500,
  "success": false,
  "message": "Error message describing what went wrong",
  "errors": [ ... ] // Optional validation errors
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (authorization required)
- `404` - Not Found
- `500` - Internal Server Error

---

## User Roles

### SUPER_ADMIN
- Full access to all modules
- Can manage users (create, update roles)
- Can manage employees (create, update, offboard)
- Can grant/revoke system access
- Can view audit logs

### ASSET_MANAGER
- Can manage assets (create, update, change status)
- Can manage asset assignments
- Can manage maintenance records
- Can view employees (read-only)
- Can generate reports
- Can manage files
- Can view dashboard

### EMPLOYEE
- Can view own employee profile
- Can update own profile
- Can change own password
- Can authenticate (login, logout, refresh token)

---

## Enums Reference

### AssetCategory
- `laptop`
- `desktop`
- `server`
- `networking_device`
- `mobile_device`
- `printer`
- `accessory`
- `software_license`

### AssetStatus
- `available`
- `assigned`
- `under_maintenance`
- `in_repair`
- `retired`
- `disposed`
- `lost`

### AssetCondition
- `new`
- `good`
- `fair`
- `damaged`

### UserRole
- `super_admin`
- `asset_manager`
- `employee`

### EmploymentType
- `full_time`
- `part_time`
- `contract`
- `intern`

### EmploymentStatus
- `active`
- `on_leave`
- `resigned`
- `terminated`

### HardwareAssignmentStatus
- `active`
- `returned`
- `lost`

### LicenseAssignmentStatus
- `active`
- `revoked`

### MaintenanceType
- `maintenance`
- `repair`

### MaintenanceStatus
- `open`
- `completed`
- `cancelled`

### ReportType
- `asset_inventory`
- `asset_assignments`
- `maintenance_log`
- `employee_assets`

### ReportFormat
- `csv`
- `xlsx`
- `pdf`

---

## Notes

1. **ObjectId Format**: All MongoDB ObjectId references should be 24-character hexadecimal strings.

2. **Date Format**: All dates should be in ISO 8601 format (e.g., `2024-01-15T10:30:00.000Z`).

3. **Pagination**: Most list endpoints support pagination with `page` and `limit` query parameters.

4. **Rate Limiting**: Authentication endpoints (`/login`, `/forgot-password`, `/reset-password`) have rate limiting applied.

5. **File Uploads**: File upload endpoints require `multipart/form-data` content type.

6. **Audit Trail**: All sensitive operations are logged in the audit log module (SUPER_ADMIN only access).

7. **Asset Kinds**: Assets are divided into two kinds - `hardware` (physical devices) and `software_license` (software licenses). Each kind has specific fields and behaviors.

8. **Assignment Types**: Asset assignments work differently for hardware (one holder at a time) vs licenses (multiple concurrent seats up to totalSeats limit).

9. **Status Transitions**: Asset status changes follow a state machine - not all transitions are allowed. See `ASSET_STATUS_TRANSITIONS` in the code for valid transitions.

10. **Immutability**: Certain fields like `assetTag`, `category`, and `employeeCode` are immutable and cannot be updated after creation.
