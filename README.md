# My Order Fellow - SaaS Order Tracking Platform

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)

A production-ready SaaS platform that helps e-commerce companies provide real-time order tracking updates to their customers through automated webhook integration and email notifications.

** API Documentation:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [API Endpoints](#-api-endpoints)
- [Usage Examples](#-usage-examples)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Contributing](#-contributing)

---

## Features

### Core Functionality
- **JWT Authentication** - Secure company registration with email OTP verification
- **KYC Verification** - Admin approval workflow for business verification
- **Webhook Integration** - Secure webhook endpoints for order intake and status updates
- **Real-time Notifications** - Automated email notifications to customers
- **Order Tracking** - Public tracking page for customers (no authentication required)
- **Order Management** - Complete CRUD operations with search and filtering

### Security Features
- Password hashing with bcrypt
- JWT token-based authentication
- Webhook secret authentication
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention with Prisma ORM

### Developer Features
- Auto-generated Swagger API documentation
- Comprehensive test coverage (Unit + E2E)
- Database migrations with Prisma
- Request/response logging
- Production-ready error handling

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | NestJS (Node.js) |
| **Language** | TypeScript |
| **Database** | PostgreSQL 15 |
| **ORM** | Prisma 7 |
| **Authentication** | JWT + Passport |
| **Validation** | class-validator, class-transformer |
| **Email** | Nodemailer |
| **Documentation** | Swagger/OpenAPI |
| **Testing** | Jest |
| **Rate Limiting** | @nestjs/throttler |

---

## Architecture

### System Overview

```
┌─────────────────┐         ┌──────────────────┐
│  E-commerce     │         │  My Order Fellow │
│  Platform       │────────▶│  API             │
│  (Client)       │ Webhook │                  │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  Notification   │
                            │  Service        │
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  End Customer   │
                            │  (Email)        │
                            └─────────────────┘
```

### Database Schema

```sql
Companies (B2B Clients)
├── Authentication (email, password, OTP)
├── KYC Information
└── Webhook Credentials

Orders
├── Company relationship
├── Customer information
├── Status History (audit trail)
└── Notifications (email log)
```

### Key Design Patterns
- **Modular Architecture** - Organized by feature domains
- **Dependency Injection** - Loose coupling, easy testing
- **Repository Pattern** - Data access abstraction with Prisma
- **Event-Driven** - Webhooks trigger notifications asynchronously
- **Idempotency** - Duplicate webhook requests handled safely

---

## Getting Started

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 15+ ([Download](https://www.postgresql.org/download/))
- npm or yarn
- Git

### Installation

#### Option 1: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-username/my-order-fellow.git
cd my-order-fellow

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Start PostgreSQL
# Make sure PostgreSQL is running on localhost:5432

# 5. Run database migrations
npx prisma migrate dev
npx prisma generate

# 6. Start the development server
npm run start:dev

# 7. Open your browser
# API: http://localhost:3000
# Swagger Docs: http://localhost:3000/api/docs
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/my_order_fellow?schema=public"

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRATION=7d

# Email Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
EMAIL_FROM=noreply@myorderfellow.com

# Webhook Security
WEBHOOK_SECRET_SALT=your-webhook-salt-change-this-min-32-chars

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

** Note:** For Gmail, you need to:
1. Enable 2-Factor Authentication
2. Generate an App Password ([Guide](https://support.google.com/accounts/answer/185833))
3. Use the App Password in `SMTP_PASSWORD`

### Quick Test

```bash
# Test the API
curl http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company",
    "businessEmail": "test@example.com",
    "password": "SecurePass123!"
  }'

# Expected: 201 Created with companyId
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new company | ❌ |
| POST | `/api/v1/auth/verify-otp` | Verify email with OTP | ❌ |
| POST | `/api/v1/auth/login` | Login and get JWT token | ❌ |

### KYC (Know Your Customer)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/kyc/submit` | Submit KYC information | JWT |
| GET | `/api/v1/kyc/pending` | Get pending KYC (Admin) | JWT |
| POST | `/api/v1/kyc/:id/review` | Approve/Reject KYC (Admin) | JWT |

### Webhooks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/webhooks/order-received` | Receive new order | Webhook Secret |
| POST | `/api/v1/webhooks/status-update` | Update order status | Webhook Secret |

### Orders

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/orders` | List all orders (paginated) | JWT |
| GET | `/api/v1/orders/stats` | Get order statistics | JWT |
| GET | `/api/v1/orders/search` | Search orders with filters | JWT |
| GET | `/api/v1/orders/:id` | Get order details | JWT |
| GET | `/api/v1/orders/track/:email/:orderId` | Track order (public) | ❌ |

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/notifications/:orderId` | Get notification history | JWT |
| POST | `/api/v1/notifications/retry` | Retry failed notifications | JWT |

---

## Usage Examples

### 1. Complete Registration Flow

```bash
# Step 1: Register company
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme E-commerce",
    "businessEmail": "contact@acme.com",
    "password": "SecurePass123!"
  }'

# Response: { "message": "Registration successful...", "companyId": "uuid" }

# Step 2: Check email for OTP (or database in development)
# Get OTP from console logs or: npx prisma studio

# Step 3: Verify OTP
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "businessEmail": "contact@acme.com",
    "otp": "123456"
  }'

# Step 4: Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "businessEmail": "contact@acme.com",
    "password": "SecurePass123!"
  }'

# Response: { "accessToken": "eyJhbG...", "company": {...} }
# Save this token!
```

### 2. Submit and Approve KYC

```bash
# Submit KYC
export JWT_TOKEN="your-jwt-token-from-login"

curl -X POST http://localhost:3000/api/v1/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "businessRegistrationNo": "BN123456789",
    "businessAddress": "123 Business St, Nairobi, Kenya",
    "contactPersonName": "John Doe",
    "contactPersonPhone": "+254712345678"
  }'

# Admin approves (get kycId from response or database)
curl -X POST http://localhost:3000/api/v1/kyc/KYC_ID/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "decision": "APPROVE",
    "notes": "All documents verified"
  }'

# Check console logs for webhook secret
```

### 3. Send Order via Webhook

```bash
# Use webhook secret from KYC approval
export WEBHOOK_SECRET="your-webhook-secret"

# Send order
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "externalOrderId": "ORD-12345",
    "customerEmail": "customer@example.com",
    "customerPhone": "+254712345678",
    "itemSummary": "2x iPhone 15 Pro, 1x AirPods Pro",
    "deliveryAddress": "456 Customer Ave, Nairobi, Kenya"
  }'

# Customer receives tracking activation email!
```

### 4. Update Order Status

```bash
# Update to IN_TRANSIT
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -d '{
    "externalOrderId": "ORD-12345",
    "newStatus": "IN_TRANSIT",
    "note": "Package departed from Nairobi warehouse"
  }'

# Customer receives status update email!
```

### 5. Query Orders

```bash
# List all orders
curl http://localhost:3000/api/v1/orders?page=1&limit=20 \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get statistics
curl http://localhost:3000/api/v1/orders/stats \
  -H "Authorization: Bearer $JWT_TOKEN"

# Search by customer email
curl "http://localhost:3000/api/v1/orders/search?customerEmail=customer@example.com" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### 6. Public Order Tracking (No Auth)

```bash
# Customer tracks their order
curl http://localhost:3000/api/v1/orders/track/customer@example.com/ORD-12345
```

---

## Testing

### Run Tests

```bash
# All tests
npm run test

# Unit tests only
npm run test:watch

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Specific module tests
npm run test:auth        # Auth tests
npm run test:webhooks    # Webhook tests
npm run test:orders      # Order tests
```

### Test Coverage

```
PASS  src/modules/auth/auth.service.spec.ts
PASS  src/modules/webhooks/webhooks.service.spec.ts
PASS  src/modules/orders/orders.service.spec.ts
PASS  test/auth.e2e-spec.ts
PASS  test/webhooks.e2e-spec.ts
PASS  test/orders.e2e-spec.ts

Test Suites: 6 passed, 6 total
Tests:       67 passed, 67 total
Coverage:    92% statements, 89% branches
```

### Testing Tools & Scripts

```bash
# Test email configuration
npm run email:test your-email@example.com

# Send test webhooks
npm run webhook:test

# Get webhook secret
npm run webhook:secret your-company@example.com

# Retry failed notifications
npm run notifications:retry
```

---

## Project Structure

```
my-order-fellow/
├── src/
│   ├── modules/
│   │   ├── auth/                 # Authentication module
│   │   │   ├── dto/              # Data transfer objects
│   │   │   ├── strategies/       # JWT strategy
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── kyc/                  # KYC verification module
│   │   ├── webhooks/             # Webhook endpoints
│   │   ├── orders/               # Order management
│   │   └── notifications/        # Email notifications
│   ├── common/
│   │   ├── guards/               # Auth guards
│   │   ├── decorators/           # Custom decorators
│   │   ├── filters/              # Exception filters
│   │   ├── interceptors/         # Request/response interceptors
│   │   ├── pipes/                # Validation pipes
│   │   └── services/             # Shared services (email)
│   ├── prisma/
│   │   ├── prisma.service.ts     # Prisma client service
│   │   └── prisma.module.ts
│   ├── config/
│   │   └── configuration.ts      # App configuration
│   ├── app.module.ts             # Root module
│   └── main.ts                   # Application entry point
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
├── test/
│   ├── auth.e2e-spec.ts         # Auth E2E tests
│   ├── webhooks.e2e-spec.ts     # Webhook E2E tests
│   └── orders.e2e-spec.ts       # Order E2E tests
├── scripts/
│   ├── send-test-webhook.ts     # Test webhook sender
│   ├── test-email.ts            # Email configuration test
│   └── get-webhook-secret.ts    # Retrieve webhook secrets
├── docs/
│   ├── AUTH_TESTING.md          # Authentication testing guide
│   ├── WEBHOOK_TESTING.md       # Webhook testing guide
│   ├── NOTIFICATION_TESTING.md  # Notification testing guide
│   └── ORDERS_TESTING.md        # Order endpoints testing guide
├── postman/
│   ├── My-Order-Fellow.postman_collection.json
│   └── My-Order-Fellow.postman_environment.json
├── .env.example                  # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── nest-cli.json
└── README.md
```

---

## Documentation

### API Documentation

- **Swagger UI:** [https://my-order-fellow.onrender.com/api/docs](https://my-order-fellow.onrender.com/api/docs)

### Testing Guides

- [Authentication Testing Guide](docs/AUTH_TESTING.md)
- [Webhook Testing Guide](docs/WEBHOOK_TESTING.md)
- [Notification Testing Guide](docs/NOTIFICATION_TESTING.md)
- [Order Endpoints Testing Guide](docs/ORDERS_TESTING.md)

### Development Guides

```bash
# Database management
npx prisma studio              # Visual database browser
npx prisma migrate dev         # Create new migration
npx prisma migrate deploy      # Deploy migrations (production)
npx prisma generate            # Generate Prisma client

# Useful commands
npm run start:dev              # Development with hot-reload
npm run start:debug            # Development with debugging
npm run start:prod             # Production mode
npm run build                  # Build for production
npm run format                 # Format code with Prettier
npm run lint                   # Lint code with ESLint
```

---

## Key Features Explained

### 1. Webhook Integration

**How it works:**
1. E-commerce company integrates our webhook endpoints
2. When customer places order → company sends webhook to us
3. We store order and activate tracking
4. We send confirmation email to customer
5. Company sends status updates → we notify customer

**Security:**
- Webhook secret authentication
- Rate limiting (100 orders/min, 200 updates/min)
- Idempotency (duplicate requests handled safely)
- Signature verification (optional)

### 2. Email Notifications

**Triggers:**
- Order tracking activated (when order received)
- Status changed (PENDING → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED)

**Features:**
- Professional HTML email templates
- Mobile-responsive design
- Delivery tracking and retry mechanism
- Failed notification logging

### 3. Order Tracking

**Public Tracking:**
- Customers track orders with just email + order ID
- No authentication required
- Shows complete order timeline
- Merchant information included

### 4. Security Features

- Password hashing with bcrypt (10 rounds)
- JWT tokens with configurable expiration
- Email OTP verification (6 digits, 10-minute expiry)
- Webhook secret authentication
- Rate limiting on all endpoints
- Input validation with class-validator
- SQL injection prevention (Prisma ORM)

---

## Troubleshooting

### Common Issues

**Issue: Database connection fails**
```bash
# Check PostgreSQL is running
docker ps  # or
sudo systemctl status postgresql

# Test connection
npx prisma db push
```

**Issue: Emails not sending**
```bash
# Test email configuration
npm run email:test your-email@example.com

# For Gmail: Use App Password, not regular password
# Enable 2FA first, then generate App Password
```

**Issue: Webhook returns 401 Unauthorized**
```bash
# Get your webhook secret
npm run webhook:secret your-company@example.com

# Verify secret in X-Webhook-Secret header
```

**Issue: Tests failing**
```bash
# Clean test database
npx prisma migrate reset

# Regenerate Prisma client
npx prisma generate

# Run tests again
npm run test
```

---

## 🗺 Roadmap

### Completed
- Authentication with JWT
- KYC verification workflow
- Webhook integration
- Email notifications
- Order management APIs
- Public order tracking
- Comprehensive testing
- API documentation

### Planned
- SMS notifications
- Dashboard frontend (Vue)


