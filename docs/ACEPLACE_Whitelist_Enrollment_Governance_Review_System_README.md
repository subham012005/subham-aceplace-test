# ACEPLACE™ Whitelist Enrollment & Governance Review System

## Overview

The ACEPLACE™ Whitelist Enrollment & Governance Review System introduces a governed onboarding workflow for ACEPLACE™. Instead of allowing unrestricted public access to advanced ACEAGENT creation capabilities, users must first submit a whitelist request for review.

This implementation establishes a controlled approval process between ACEPLACE™ and ACELOGIC™, enabling governance-driven access management while ACELOGIC Licensee, Runtime Enrollment, and Provisioning systems continue development.

---

# 1. Feature Scope

### Included

- Whitelist Request Submission
- Runtime Enrollment Modal
- ACEPLACE → ACELOGIC API Bridge
- Request Storage in ACELOGIC MongoDB
- Governance Review Workflow
- Approve / Deny Actions
- Denial Reason Tracking
- Approved User Whitelist Registry
- Individual Whitelist Status Lookup
- Latest Request Status Lookup
- Admin Review Interface Support
- Cross-Platform Communication

### Not Included

- ACELOGIC Identity Issuance
- Runtime Provisioning
- Sandbox Activation
- Licensee Management
- Tier-Based Feature Unlock Logic
- Automated Runtime Enrollment

These are planned future phases.

---

# 2. User Flow

```text
User Arrives at ACEPLACE
        ↓
Uses Existing Sandbox Features
        ↓
Clicks "Request Whitelist Access"
        ↓
Whitelist Enrollment Modal Opens
        ↓
User Submits Request
        ↓
ACELOGIC Stores Request
        ↓
Status = PENDING_REVIEW
        ↓
Admin Reviews Request
        ↓
Approve or Deny
        ↓
If Approved:
    Added To ACEPLACE Whitelist

If Denied:
    Denial Reason Saved
```

---

# 3. Technical Architecture

```text
ACEPLACE Frontend
        ↓
ACEPLACE Bridge API
        ↓
ACELOGIC Main API
        ↓
MongoDB Atlas
```

### Why Bridge APIs?

ACEPLACE and ACELOGIC use separate systems.

ACEPLACE should not communicate directly with MongoDB or internal ACELOGIC services.

Instead:

```text
Frontend
    ↓
ACEPLACE Server Route
    ↓
ACELOGIC API
    ↓
MongoDB
```

Benefits:

- Separation of Concerns
- Easier Security Management
- Centralized Governance Logic
- Future JWT Support
- Internal API Isolation

---

# 4. Database Collections

## aceplace_whitelist_requests

Stores all submissions.

Contains:

- Pending Requests
- Approved Requests
- Denied Requests
- Review Metadata

Example:

```json
{
  "email": "john@example.com",
  "status": "PENDING_REVIEW"
}
```

---

## aceplace_whitelist

Stores approved users only.

Example:

```json
{
  "email": "john@example.com",
  "assignedTier": "Tier 2 Enterprise Runtime",
  "status": "ACTIVE"
}
```

---

# 5. ACELOGIC APIs

## 5.1 Create Whitelist Request

### Endpoint

```http
POST /api/aceplace/whitelist-request
```

### Request Body

```json
{
  "fullName": "John Smith",
  "company": "Acme Telecom",
  "email": "john@acme.com",
  "useCase": "AI-RAN runtime orchestration",
  "deploymentInterest": "Telecom / AI-RAN",
  "infrastructureTier": "Tier 4 Telecom Infrastructure",
  "providerInterest": [
    "OpenAI",
    "Local Models"
  ],
  "classification": "Telecom"
}
```

Purpose:

Creates a new whitelist request.

---

## 5.2 Get All Whitelist Requests

### Endpoint

```http
GET /api/get/aceplace/whitelist-requests
```

Purpose:

Returns all requests for governance review.

---

## 5.3 Get Individual Whitelist User

### Endpoint

```http
GET /api/aceplace/whitelist/user
```

### Query

```http
?email=user@example.com
```

Example:

```http
/api/aceplace/whitelist/user?email=john@acme.com
```

Purpose:

Checks whether a user exists in the approved whitelist.

---

## 5.4 Get Latest Request By Email

### Endpoint

```http
GET /api/aceplace/whitelist-request/latest
```

### Query

```http
?email=user@example.com
```

Example:

```http
/ api/aceplace/whitelist-request/latest?email=john@acme.com
```

Purpose:

Returns the latest request associated with an email.

Useful when a user has:

```text
Denied Request
        ↓
Reapplied Later
```

Only the latest request is returned.

---

## 5.5 Review Request

### Endpoint

```http
PATCH /api/aceplace/whitelist-request/:id/review
```

### Approve Body

```json
{
  "actionType": "APPROVE",
  "reviewed_by": "Admin",
  "reviewed_by_email": "admin@acelogic.ai"
}
```

### Deny Body

```json
{
  "actionType": "DENY",
  "reviewed_by": "Admin",
  "reviewed_by_email": "admin@acelogic.ai",
  "reason": "Does not meet current whitelist criteria."
}
```

### Approve Behavior

- Status → APPROVED
- Review Metadata Saved
- User Added To aceplace_whitelist
- Assigned Tier Saved

### Deny Behavior

- Status → DENIED
- Reason Saved
- Not Added To Whitelist

---

# 6. ACEPLACE Bridge APIs

## 6.1 Submit Whitelist Request

### Endpoint

```http
POST /api/Aceplace_Whitelist_Access/Request_Whitelist_Access
```

Forwards request to:

```http
POST /api/aceplace/whitelist-request
```

---

## 6.2 Get Latest User Request Status

### Endpoint

```http
GET /api/Aceplace_Whitelist_Access/User_Whitelist_Status
```

Query:

```http
?email=user@example.com
```

Forwards request to:

```http
GET /api/aceplace/whitelist-request/latest
```

---

## 6.3 Get Approved Whitelist User

### Endpoint

```http
GET /api/Aceplace_Whitelist_Access/whitelist_user
```

Query:

```http
?email=user@example.com
```

Forwards request to:

```http
GET /api/aceplace/whitelist/user
```

---

# 7. Changes Made In ACEPLACE

### Frontend

- Runtime Enrollment CTA
- Whitelist Enrollment Modal
- Form Validation
- Submission States
- Approval Detection
- Status Lookup
- Whitelist Visibility Logic

### Server

- Bridge API Routes
- ACELOGIC Integration
- Cross Platform Communication

---

# 8. Changes Made In ACELOGIC

### Backend

- MongoDB Request Storage
- Governance Review APIs
- Approve Workflow
- Deny Workflow
- Whitelist Registry
- Latest Request Lookup
- Individual User Lookup

### Control Plane

- Pending Review Management
- Approve Actions
- Deny Actions
- Review Tracking

---

# 9. Admin Workflow

```text
Open ACELOGIC Control Plane
        ↓
View Pending Requests
        ↓
Open Request Details
        ↓
Review Request Information
        ↓
Approve or Deny
```

### Approve

```text
Approve
    ↓
Status Updated
    ↓
User Added To Whitelist
```

### Deny

```text
Deny
    ↓
Provide Reason
    ↓
Status Updated
```

---

# 10. User Manual

### Step 1

Open ACEPLACE™

### Step 2

Use available sandbox functionality.

### Step 3

Click:

```text
Request Whitelist Access
```

### Step 4

Complete Runtime Enrollment Form.

### Step 5

Submit Request.

### Step 6

Wait For Review.

### Step 7

Receive Approval Decision.

### Step 8

If approved, user becomes part of the ACEPLACE whitelist registry.

---

# 11. Final Implementation Summary

This implementation establishes a governed whitelist onboarding process between ACEPLACE™ and ACELOGIC™.

The architecture intentionally separates:

- User Experience
- Governance Review
- Approval Management
- Whitelist Registry

through a bridge-based integration model.

The system supports:

- Cross-platform communication
- Approval workflows
- Denial workflows
- Review history
- Approved user registry
- Future ACELOGIC runtime integration

while maintaining a controlled enterprise-grade onboarding experience.

---

# Verdict

The ACEPLACE™ Whitelist Enrollment & Governance Review System successfully introduces a secure and governed onboarding workflow that aligns with the platform's positioning around controlled execution, enterprise orchestration, deterministic infrastructure, and sovereign deployment readiness.

The implementation is production-oriented, extensible, and prepared for future integration with ACELOGIC Identity Issuance, Runtime Enrollment, Licensee Management, and Runtime Provisioning systems.
