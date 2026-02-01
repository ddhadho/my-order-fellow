# Order Query Endpoints Testing Guide

## Prerequisites

- ✅ Application running: `npm run start:dev`
- ✅ JWT token from login (for protected endpoints)
- ✅ At least one order created via webhooks

---

## Getting a JWT Token
```bash
# Login to get JWT
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "businessEmail": "your-company@example.com",
    "password": "YourPassword123!"
  }'

# Save the accessToken from response
export JWT_TOKEN="your-jwt-token-here"
```

---

## Testing Order Endpoints

### 1. List All Orders (Paginated)
```bash
curl -X GET "http://localhost:3000/api/v1/orders?page=1&limit=20" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "externalOrderId": "ORD-12345",
      "customerEmail": "customer@example.com",
      "itemSummary": "2x iPhone 15 Pro",
      "deliveryAddress": "123 Main St, Nairobi",
      "currentStatus": "IN_TRANSIT",
      "createdAt": "2024-02-01T10:00:00Z",
      "statusHistory": [
        {
          "status": "IN_TRANSIT",
          "timestamp": "2024-02-01T12:00:00Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### 2. Get Order Statistics
```bash
curl -X GET http://localhost:3000/api/v1/orders/stats \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**
```json
{
  "total": 100,
  "byStatus": {
    "PENDING": {
      "count": 20,
      "percentage": "20.00"
    },
    "IN_TRANSIT": {
      "count": 30,
      "percentage": "30.00"
    },
    "OUT_FOR_DELIVERY": {
      "count": 15,
      "percentage": "15.00"
    },
    "DELIVERED": {
      "count": 35,
      "percentage": "35.00"
    }
  }
}
```

### 3. Search Orders

**Search by Order ID:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/search?externalOrderId=ORD-123" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Search by Customer Email:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/search?customerEmail=customer@example.com" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Search by Status:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/search?status=PENDING" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Combine Multiple Filters:**
```bash
curl -X GET "http://localhost:3000/api/v1/orders/search?status=PENDING&customerEmail=john" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  },
  "filters": {
    "externalOrderId": null,
    "customerEmail": "john",
    "status": "PENDING"
  }
}
```

### 4. Get Order by ID
```bash
curl -X GET http://localhost:3000/api/v1/orders/ORDER_UUID_HERE \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "companyId": "company-uuid",
  "externalOrderId": "ORD-12345",
  "customerEmail": "customer@example.com",
  "customerPhone": "+254712345678",
  "itemSummary": "2x iPhone 15 Pro",
  "deliveryAddress": "123 Main St, Nairobi",
  "currentStatus": "DELIVERED",
  "createdAt": "2024-02-01T10:00:00Z",
  "updatedAt": "2024-02-05T15:30:00Z",
  "statusHistory": [
    {
      "id": "history-1",
      "status": "PENDING",
      "note": "Order received",
      "timestamp": "2024-02-01T10:00:00Z"
    },
    {
      "id": "history-2",
      "status": "IN_TRANSIT",
      "note": "Shipped from warehouse",
      "timestamp": "2024-02-02T09:00:00Z"
    },
    {
      "id": "history-3",
      "status": "OUT_FOR_DELIVERY",
      "note": "Out for delivery",
      "timestamp": "2024-02-05T08:00:00Z"
    },
    {
      "id": "history-4",
      "status": "DELIVERED",
      "note": "Successfully delivered",
      "timestamp": "2024-02-05T15:30:00Z"
    }
  ],
  "notifications": [
    {
      "id": "notif-1",
      "type": "TRACKING_ACTIVATED",
      "recipient": "customer@example.com",
      "status": "SENT",
      "sentAt": "2024-02-01T10:01:00Z",
      "createdAt": "2024-02-01T10:01:00Z"
    },
    {
      "id": "notif-2",
      "type": "STATUS_UPDATE",
      "recipient": "customer@example.com",
      "status": "SENT",
      "sentAt": "2024-02-02T09:01:00Z",
      "createdAt": "2024-02-02T09:01:00Z"
    }
  ]
}
```

### 5. Public Order Tracking (No Auth Required)
```bash
curl -X GET "http://localhost:3000/api/v1/orders/track/customer@example.com/ORD-12345"
```

**Response:**
```json
{
  "orderId": "ORD-12345",
  "currentStatus": "DELIVERED",
  "itemSummary": "2x iPhone 15 Pro",
  "deliveryAddress": "123 Main St, Nairobi",
  "merchant": "Test E-commerce",
  "createdAt": "2024-02-01T10:00:00Z",
  "timeline": [
    {
      "status": "DELIVERED",
      "note": "Successfully delivered",
      "timestamp": "2024-02-05T15:30:00Z"
    },
    {
      "status": "OUT_FOR_DELIVERY",
      "note": "Out for delivery",
      "timestamp": "2024-02-05T08:00:00Z"
    },
    {
      "status": "IN_TRANSIT",
      "note": "Shipped from warehouse",
      "timestamp": "2024-02-02T09:00:00Z"
    },
    {
      "status": "PENDING",
      "note": "Order received",
      "timestamp": "2024-02-01T10:00:00Z"
    }
  ]
}
```

---

## Testing with Swagger UI

1. Open http://localhost:3000/api/docs
2. Click **Authorize** button
3. Enter your JWT token
4. Navigate to **Orders** section
5. Try each endpoint with **Try it out**

---

## Common Use Cases

### Dashboard Overview

Get statistics for company dashboard:
```bash
# Get total orders
curl -X GET http://localhost:3000/api/v1/orders/stats \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get recent orders
curl -X GET "http://localhost:3000/api/v1/orders?page=1&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Customer Support

Search for customer's orders:
```bash
# By email
curl -X GET "http://localhost:3000/api/v1/orders/search?customerEmail=customer@example.com" \
  -H "Authorization: Bearer $JWT_TOKEN"

# By order ID
curl -X GET "http://localhost:3000/api/v1/orders/search?externalOrderId=ORD-12345" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Order Details for Investigation

Get full order history:
```bash
curl -X GET http://localhost:3000/api/v1/orders/ORDER_UUID \
  -H "Authorization: Bearer $JWT_TOKEN" | jq
```

### Customer Self-Service Tracking

Share this link with customers:
```
http://localhost:3000/api/v1/orders/track/{customer-email}/{order-id}
```

Example:
```
http://localhost:3000/api/v1/orders/track/john@example.com/ORD-12345
```

---

## Running Automated Tests
```bash
# All order tests
npm run test -- orders

# Unit tests only
npm run test -- orders.service.spec

# E2E tests only
npm run test:e2e -- orders.e2e-spec

# With coverage
npm run test:cov -- orders
```

---

## Troubleshooting

### Issue: "Unauthorized" on protected endpoints
**Solution:** Ensure you're sending valid JWT token:
```bash
# Check token format
echo $JWT_TOKEN

# Should start with: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Issue: Empty results
**Solution:** Create orders via webhooks first:
```bash
# Send test order
npx ts-node scripts/send-test-webhook.ts
```

### Issue: "Order not found" on public tracking
**Solution:** Verify email and order ID match exactly:
```sql
SELECT external_order_id, customer_email 
FROM orders 
LIMIT 5;
```

---

## Query Parameters Reference

### List Orders (`GET /orders`)
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

### Search Orders (`GET /orders/search`)
- `externalOrderId` (string, optional): Filter by order ID (partial match)
- `customerEmail` (string, optional): Filter by customer email (partial match)
- `status` (enum, optional): Filter by status (PENDING | IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED)
- `page` (number, optional): Page number
- `limit` (number, optional): Items per page

---

## Next Steps

After testing order endpoints:
1. ✅ Build frontend dashboard using these APIs
2. ✅ Create customer tracking page
3. ✅ Add export functionality (CSV/PDF)
4. ✅ Implement advanced analytics