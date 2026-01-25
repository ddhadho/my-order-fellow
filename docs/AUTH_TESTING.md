# Authentication Testing Guide

## Prerequisites

- Application running: `npm run start:dev`
- Database migrated: `npx prisma migrate dev`
- Swagger docs available at: http://localhost:3000/api/docs

---

## Testing Registration

### Method 1: Using Swagger UI

1. Open http://localhost:3000/api/docs
2. Navigate to **Authentication** section
3. Click on **POST /auth/register**
4. Click **Try it out**
5. Enter request body:
```json
{
  "companyName": "Test E-commerce",
  "businessEmail": "test@ecommerce.com",
  "password": "SecurePass123!"
}
```
6. Click **Execute**
7. Check response - should return `companyId`

### Method 2: Using cURL
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test E-commerce",
    "businessEmail": "test@ecommerce.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
```json
{
  "message": "Registration successful. Please verify your email.",
  "companyId": "uuid-here"
}
```

**Common Errors:**
- `409 Conflict`: Email already registered
- `400 Bad Request`: Weak password or invalid email format

---

## Testing OTP Verification

### Get OTP from Database
```bash
# Using Prisma Studio
npx prisma studio
# Navigate to companies table → find your email → copy emailOtp

# Or using CLI
npx prisma db execute --stdin <<EOF
SELECT email_otp FROM companies WHERE business_email = 'test@ecommerce.com';
EOF
```

### Verify OTP
```bash
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "businessEmail": "test@ecommerce.com",
    "otp": "123456"
  }'
```

**Expected Response:**
```json
{
  "message": "Email verified successfully"
}
```

---

## Testing Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "businessEmail": "test@ecommerce.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "company": {
    "id": "uuid-here",
    "companyName": "Test E-commerce",
    "email": "test@ecommerce.com",
    "kycStatus": "PENDING"
  }
}

**Save the JWT token** - you'll need it for authenticated requests!

---

## Testing Protected Endpoints

Use the JWT token from login:
```bash
# Example: Submit KYC (requires JWT)
curl -X POST http://localhost:3000/api/v1/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "businessRegistrationNo": "BN123456",
    "businessAddress": "123 Business St",
    "contactPersonName": "John Doe",
    "contactPersonPhone": "+254712345678"
  }'
```

---

## Running Automated Tests
```bash
# Unit tests only
npm run test -- auth.service.spec

# E2E tests only
npm run test:e2e -- auth.e2e-spec

# All auth tests
npm run test -- auth

# With coverage
npm run test:cov -- auth
```

---

## Common Test Scenarios

### 1. Duplicate Email
```bash
# Register once
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test","businessEmail":"duplicate@test.com","password":"SecurePass123!"}'

# Try again with same email
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test2","businessEmail":"duplicate@test.com","password":"SecurePass123!"}'

# Expected: 409 Conflict
```

### 2. Invalid Password
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test","businessEmail":"test@test.com","password":"weak"}'

# Expected: 400 Bad Request - Password too weak
```

### 3. Login Before Verification
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test","businessEmail":"unverified@test.com","password":"SecurePass123!"}'

# Try to login without verifying
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"businessEmail":"unverified@test.com","password":"SecurePass123!"}'

# Expected: 401 Unauthorized - Please verify your email first
```

### 4. Wrong Password
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"businessEmail":"test@test.com","password":"WrongPassword123!"}'

# Expected: 401 Unauthorized - Invalid credentials
```

### 5. Expired OTP
```bash
# Manually expire OTP in database
npx prisma db execute --stdin <<EOF
UPDATE companies 
SET email_otp_expires_at = NOW() - INTERVAL '1 hour'
WHERE business_email = 'test@test.com';
EOF

# Try to verify
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"businessEmail":"test@test.com","otp":"123456"}'

# Expected: 401 Unauthorized - OTP expired
```

---

## Troubleshooting

### Issue: "Email already registered"
**Solution:** Use a different email or delete the existing company:
```sql
DELETE FROM companies WHERE business_email = 'test@test.com';
```

### Issue: Can't find OTP
**Solution:** Check database:
```bash
npx prisma studio
# Or
npx prisma db execute --stdin <<EOF
SELECT business_email, email_otp, email_otp_expires_at 
FROM companies 
WHERE business_email = 'your-email@test.com';
EOF
```

### Issue: JWT token expired
**Solution:** Login again to get a new token. Tokens expire after 7 days by default.

### Issue: Tests failing
**Solution:**
1. Check database is running: `docker-compose ps`
2. Run migrations: `npx prisma migrate dev`
3. Clear test data: See "Clean Up Test Data" below

---

## Clean Up Test Data
```bash
# Delete all test companies
npx prisma db execute --stdin <<EOF
DELETE FROM companies WHERE business_email LIKE '%test%' OR business_email LIKE '%e2e%';
EOF

# Or use Prisma Studio
npx prisma studio
# Navigate to companies → delete test records
```

---

## Password Requirements

Passwords must meet these criteria:
- ✅ Minimum 8 characters
- ✅ At least 1 uppercase letter
- ✅ At least 1 lowercase letter
- ✅ At least 1 number
- ✅ At least 1 special character (@$!%*?&)

**Valid Examples:**
- `SecurePass123!`
- `MyP@ssw0rd`
- `Test1234!`

**Invalid Examples:**
- `password` (no uppercase, number, special char)
- `Pass123` (no special char, too short)
- `PASSWORD!` (no lowercase, no number)

---

## JWT Token Structure

Decoded JWT payload:
```json
{
  "sub": "company-uuid",
  "email": "test@ecommerce.com",
  "iat": 1234567890,
  "exp": 1234567890
}
```

You can decode JWT tokens at: https://jwt.io

---

## Next Steps

After successful authentication:
1. ✅ Submit KYC information
2. ✅ Wait for admin approval
3. ✅ Receive webhook credentials
4. ✅ Start sending orders via webhooks