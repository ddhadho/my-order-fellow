# KYC Testing Guide

## Prerequisites

- Application running: `npm run start:dev`
- Database migrated: `npx prisma migrate dev`
- Swagger docs available at: http://localhost:3000/api/docs
- A registered and email-verified company account.
- An authenticated JWT token for a regular company and an admin company.

---

## Getting JWT Tokens

To test KYC endpoints, you'll need JWT tokens. Follow the [Authentication Testing Guide](AUTH_TESTING.md) to register, verify OTP, and log in to get an `accessToken`.

**Important:** For testing admin-only endpoints, you will need to manually set a company's `role` to `ADMIN` in the database using `npx prisma studio`.

---

## Testing KYC Submission (`POST /kyc/submit`)

This endpoint allows an authenticated company to submit their Know Your Customer (KYC) information.

### Method 1: Using Swagger UI

1. Open http://localhost:3000/api/docs
2. Navigate to **KYC** section
3. Click on **POST /kyc/submit**
4. Click **Authorize** and enter your `Bearer YOUR_JWT_TOKEN_HERE` (from a regular company account)
5. Click **Try it out**
6. Enter request body:
```json
{
  "businessRegistrationNo": "BN-COMPANY-REG-12345",
  "businessAddress": "123 Main Street, Industrial Area, Nairobi",
  "contactPersonName": "Jane Doe",
  "contactPersonPhone": "+254712345678"
}
```
7. Click **Execute**

### Method 2: Using cURL
```bash
curl -X POST http://localhost:3000/api/v1/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_REGULAR_COMPANY_JWT_TOKEN" \
  -d '{
    "businessRegistrationNo": "BN-COMPANY-REG-12345",
    "businessAddress": "123 Main Street, Industrial Area, Nairobi",
    "contactPersonName": "Jane Doe",
    "contactPersonPhone": "+254712345678"
  }'
```

**Expected Response (201 Created):**
```json
{
  "id": "kyc-uuid-here",
  "businessRegistrationNo": "BN-COMPANY-REG-12345",
  "businessAddress": "123 Main Street, Industrial Area, Nairobi",
  "contactPersonName": "Jane Doe",
  "contactPersonPhone": "+254712345678",
  "status": "PENDING",
  "notes": null,
  "companyId": "company-uuid-here",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "updatedAt": "2023-10-27T10:00:00.000Z"
}
```

**Common Errors:**
- `401 Unauthorized`: No JWT token provided or invalid token.
- `400 Bad Request`: Invalid or missing fields in the request body.
- `400 Bad Request`: KYC already submitted (pending or approved).

---

## Testing Getting Pending KYCs (`GET /kyc/pending`)

This endpoint is for **Admin users only** to retrieve all KYC submissions that are in `PENDING` status.

### Method 1: Using Swagger UI

1. Open http://localhost:3000/api/docs
2. Navigate to **KYC** section
3. Click on **GET /kyc/pending**
4. Click **Authorize** and enter your `Bearer YOUR_ADMIN_COMPANY_JWT_TOKEN`
5. Click **Try it out**
6. Click **Execute**

### Method 2: Using cURL
```bash
curl -X GET http://localhost:3000/api/v1/kyc/pending \
  -H "Authorization: Bearer YOUR_ADMIN_COMPANY_JWT_TOKEN"
```

**Expected Response (200 OK):**
```json
[
  {
    "id": "kyc-uuid-1",
    "businessRegistrationNo": "BN-COMPANY-REG-12345",
    "businessAddress": "123 Main Street, Industrial Area, Nairobi",
    "contactPersonName": "Jane Doe",
    "contactPersonPhone": "+254712345678",
    "status": "PENDING",
    "notes": null,
    "companyId": "company-uuid-1",
    "createdAt": "2023-10-27T10:00:00.000Z",
    "updatedAt": "2023-10-27T10:00:00.000Z",
    "company": {
        "id": "company-uuid-1",
        "companyName": "Example Company",
        "businessEmail": "example@company.com"
    }
  },
  {
    "id": "kyc-uuid-2",
    "// ... another pending KYC"
  }
]
```

**Common Errors:**
- `401 Unauthorized`: No JWT token provided or invalid token.
- `403 Forbidden`: User is not an administrator.

---

## Testing KYC Review (`POST /kyc/:kycId/review`)

This endpoint is for **Admin users only** to approve or reject a pending KYC submission.

### Method 1: Using Swagger UI

1. Open http://localhost:3000/api/docs
2. Navigate to **KYC** section
3. Click on **POST /kyc/{kycId}/review**
4. Click **Authorize** and enter your `Bearer YOUR_ADMIN_COMPANY_JWT_TOKEN`
5. Click **Try it out**
6. In `kycId` path parameter, enter the ID of a pending KYC (from the `/kyc/pending` endpoint or database).
7. Enter request body:
   - **To Approve:**
     ```json
     {
       "decision": "APPROVE",
       "notes": "All documents verified and approved."
     }
     ```
   - **To Reject:**
     ```json
     {
       "decision": "REJECT",
       "notes": "Missing business registration certificate. Please re-submit."
     }
     ```
8. Click **Execute**

### Method 2: Using cURL
```bash
# To Approve:
curl -X POST http://localhost:3000/api/v1/kyc/YOUR_KYC_ID_HERE/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_COMPANY_JWT_TOKEN" \
  -d '{
    "decision": "APPROVE",
    "notes": "All documents verified and approved."
  }'

# To Reject:
curl -X POST http://localhost:3000/api/v1/kyc/YOUR_KYC_ID_HERE/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_COMPANY_JWT_TOKEN" \
  -d '{
    "decision": "REJECT",
    "notes": "Missing business registration certificate. Please re-submit."
  }'
```

**Expected Response (201 Created):**
```json
{
  "id": "kyc-uuid-here",
  "businessRegistrationNo": "BN-COMPANY-REG-12345",
  "businessAddress": "123 Main Street, Industrial Area, Nairobi",
  "contactPersonName": "Jane Doe",
  "contactPersonPhone": "+254712345678",
  "status": "APPROVED", // or "REJECTED"
  "notes": "All documents verified and approved.",
  "companyId": "company-uuid-here",
  "createdAt": "2023-10-27T10:00:00.000Z",
  "updatedAt": "2023-10-27T10:00:00.000Z"
}
```

**After Approval:**
- The `kycStatus` of the associated company in the `companies` table will change to `APPROVED`.
- A `webhookSecret` will be generated and stored in the company's record. You can retrieve this using `npx prisma studio`.

**After Rejection:**
- The `kycStatus` of the associated company in the `companies` table will change to `REJECTED`.
- No `webhookSecret` will be generated (or any existing one will be cleared if re-submission is allowed).

**Common Errors:**
- `401 Unauthorized`: No JWT token provided or invalid token.
- `403 Forbidden`: User is not an administrator.
- `400 Bad Request`: Invalid `decision` or `notes` in the request body.
- `404 Not Found`: `kycId` does not exist or is not pending.

---

## Running Automated Tests

To run the automated E2E tests for the KYC module:
```bash
# Run specific E2E test file
npm run test:e2e -- kyc.e2e-spec
```

---

## Troubleshooting

### Issue: "Forbidden resource" when accessing admin endpoints
**Solution:** Ensure the JWT token used belongs to a company account that has its `role` manually set to `ADMIN` in the database.

### Issue: "KYC not found or not pending"
**Solution:** Verify the `kycId` you are using is correct and corresponds to a KYC submission that is currently in `PENDING` status. You can check this using `GET /kyc/pending` (as admin) or `npx prisma studio`.

---

## Clean Up Test Data

```bash
# Delete all KYC records and associated test companies
npx prisma db execute --stdin <<EOF
DELETE FROM "KYC" WHERE "companyId" IN (SELECT id FROM companies WHERE "businessEmail" LIKE '%kyc-e2e%');
DELETE FROM companies WHERE "businessEmail" LIKE '%kyc-e2e%';
EOF

# Or use Prisma Studio
npx prisma studio
# Navigate to KYC table → delete test records
# Navigate to companies table → delete test records with emails containing 'kyc-e2e'
```
