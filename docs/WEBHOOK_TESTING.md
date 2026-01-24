# Webhook Testing Guide

This guide explains how to test the webhook endpoints for My Order Fellow.

## Prerequisites

Before testing webhooks, ensure you have:
1. Completed Phase 1 (Authentication)
2. Completed Phase 2 (KYC - generates webhook secret)
3. At least one company with **APPROVED** KYC status
4. Retrieved the webhook secret from the database

---

## Getting Your Webhook Secret

### Method 1: Using the Helper Script (Recommended)
```bash
# Get webhook secret by email
npx ts-node scripts/get-webhook-secret.ts your-email@example.com
```

**Output:**
```
📋 Company Information:
Company: Test Corp
KYC Status: APPROVED
Webhook Active: true

🔑 Webhook Secret:
abc123def456...
```

### Method 2: Using Prisma Studio
```bash
# Open Prisma Studio
npx prisma studio

# Navigate to:
# - Tables -> companies
# - Find your company
# - Copy the 'webhookSecret' field
```

### Method 3: Direct Database Query
```bash
npx prisma db execute --stdin <<EOF
SELECT 
  company_name,
  business_email,
  webhook_secret,
  is_webhook_active,
  kyc_status
FROM companies
WHERE kyc_status = 'APPROVED';
EOF
```

---

## Testing with Mock Webhook Sender

### Step 1: Update the Test Script

Edit `scripts/send-test-webhook.ts` and replace the webhook secret:
```typescript
const WEBHOOK_SECRET = 'paste-your-webhook-secret-here';
```

### Step 2: Run the Test
```bash
# Start your API
npm run start:dev

# In another terminal, run the mock sender
npx ts-node scripts/send-test-webhook.ts
```

### Expected Output
```
🚀 Starting webhook test...

📦 Sending new order webhook...
✅ Order webhook sent successfully:
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "trackingStatus": "PENDING",
  "message": "Order received and tracking activated"
}

🔄 Sending status update webhook...
✅ Status update sent successfully:
{
  "success": true,
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "previousStatus": "PENDING",
  "newStatus": "IN_TRANSIT",
  "message": "Status updated successfully"
}

✅ Full order lifecycle simulated successfully!
```

---

## Manual Testing with cURL

### 1. Create New Order
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "externalOrderId": "ORD-12345",
    "customerEmail": "customer@example.com",
    "customerPhone": "+254712345678",
    "itemSummary": "2x iPhone 15 Pro, 1x AirPods Pro",
    "deliveryAddress": "123 Main Street, Nairobi, Kenya",
    "initialStatus": "PENDING"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "orderId": "uuid-here",
  "trackingStatus": "PENDING",
  "message": "Order received and tracking activated"
}
```

### 2. Update Order Status
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "externalOrderId": "ORD-12345",
    "newStatus": "IN_TRANSIT",
    "note": "Package departed from Nairobi warehouse"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "orderId": "uuid-here",
  "previousStatus": "PENDING",
  "newStatus": "IN_TRANSIT",
  "message": "Status updated successfully"
}
```

### 3. Test Full Order Lifecycle
```bash
# 1. Create order
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"externalOrderId":"ORD-001","customerEmail":"test@example.com","itemSummary":"Test Item","deliveryAddress":"Test Address"}'

# 2. Update to IN_TRANSIT
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"externalOrderId":"ORD-001","newStatus":"IN_TRANSIT","note":"Shipped"}'

# 3. Update to OUT_FOR_DELIVERY
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"externalOrderId":"ORD-001","newStatus":"OUT_FOR_DELIVERY","note":"Out for delivery"}'

# 4. Update to DELIVERED
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"externalOrderId":"ORD-001","newStatus":"DELIVERED","note":"Delivered successfully"}'
```

---

## Testing with Swagger UI

1. Open Swagger docs: http://localhost:3000/api/docs
2. Click **Authorize** button (top right)
3. In the **webhook-secret** section, enter your webhook secret
4. Click **Authorize**, then **Close**
5. Navigate to **Webhooks** section
6. Click **Try it out** on any endpoint
7. Edit the request body
8. Click **Execute**

---

## Testing Idempotency

Send the same order twice:
```bash
# First request - creates order
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"externalOrderId":"ORD-999","customerEmail":"test@example.com","itemSummary":"Test","deliveryAddress":"Test"}'

# Second request - returns existing order (idempotent)
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -d '{"externalOrderId":"ORD-999","customerEmail":"test@example.com","itemSummary":"Test","deliveryAddress":"Test"}'
```

Both should return the same `orderId` - this prevents duplicate orders from webhook retries.

---

## Testing Rate Limiting

The webhooks have rate limits:
- **Order Received**: 100 requests per minute
- **Status Update**: 200 requests per minute

Test rate limiting:
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
    -H "X-Webhook-Secret: YOUR_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"externalOrderId\":\"ORD-$i\",\"customerEmail\":\"test@example.com\",\"itemSummary\":\"Item $i\",\"deliveryAddress\":\"Address $i\"}"
done
```

**Expected:** Request 101 returns `429 Too Many Requests`

---

## Error Scenarios

### 1. Missing Webhook Secret
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -d '{"externalOrderId":"ORD-001","customerEmail":"test@example.com","itemSummary":"Test","deliveryAddress":"Test"}'
```
**Response:** `401 Unauthorized - Missing X-Webhook-Secret header`

### 2. Invalid Webhook Secret
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: invalid-secret" \
  -d '{"externalOrderId":"ORD-001","customerEmail":"test@example.com","itemSummary":"Test","deliveryAddress":"Test"}'
```
**Response:** `401 Unauthorized - Invalid webhook credentials`

### 3. Invalid Email Format
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"externalOrderId":"ORD-001","customerEmail":"not-an-email","itemSummary":"Test","deliveryAddress":"Test"}'
```
**Response:** `400 Bad Request - Validation failed`

### 4. Order Not Found (Status Update)
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"externalOrderId":"NONEXISTENT","newStatus":"IN_TRANSIT"}'
```
**Response:** `409 Conflict - Order NONEXISTENT not found`

---

## Verifying in Database

After creating orders, verify in the database:
```bash
# Open Prisma Studio
npx prisma studio

# Check tables:
# - orders: See created orders
# - status_history: See status change timeline
```

Or query directly:
```bash
npx prisma db execute --stdin <<EOF
SELECT 
  o.external_order_id,
  o.customer_email,
  o.current_status,
  o.created_at,
  COUNT(sh.id) as status_changes
FROM orders o
LEFT JOIN status_history sh ON o.id = sh.order_id
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 10;
EOF
```

---

## Common Issues

### Issue: "Invalid webhook credentials"
**Solution:** 
- Verify company KYC is APPROVED
- Check `is_webhook_active` is true
- Ensure webhook secret matches exactly (no extra spaces)

### Issue: "Order already exists"
**Solution:** This is normal idempotency behavior. Use a different `externalOrderId` for new orders.

### Issue: Rate limit errors
**Solution:** Wait 60 seconds or increase limits in `src/modules/webhooks/webhooks.controller.ts`:
```typescript
@Throttle({ default: { limit: 200, ttl: 60000 } }) // Increase limit
```

### Issue: Validation errors
**Solution:** Check required fields:
- `externalOrderId` (required, max 100 chars)
- `customerEmail` (required, valid email)
- `itemSummary` (required, max 500 chars)
- `deliveryAddress` (required, max 500 chars)

---

## Integration Examples

### Node.js/JavaScript
```javascript
const axios = require('axios');

async function sendOrder(orderData) {
  const response = await axios.post(
    'http://localhost:3000/api/v1/webhooks/order-received',
    orderData,
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET,
      },
    }
  );
  return response.data;
}

sendOrder({
  externalOrderId: 'ORD-12345',
  customerEmail: 'customer@example.com',
  itemSummary: 'Product Name',
  deliveryAddress: 'Customer Address',
});
```

### Python
```python
import requests

def send_order(order_data):
    response = requests.post(
        'http://localhost:3000/api/v1/webhooks/order-received',
        json=order_data,
        headers={
            'Content-Type': 'application/json',
            'X-Webhook-Secret': 'your-webhook-secret'
        }
    )
    return response.json()

send_order({
    'externalOrderId': 'ORD-12345',
    'customerEmail': 'customer@example.com',
    'itemSummary': 'Product Name',
    'deliveryAddress': 'Customer Address'
})
```

---

## Next Steps

After successful webhook testing:
1. ✅ Verify orders appear in database
2. ✅ Check status history is created
3. ✅ Test with your actual e-commerce platform
4. ✅ Move to Phase 5 (Notifications) to send emails to customers

---

## Support

If you encounter issues:
1. Check API logs: `npm run start:dev` console output
2. Check database: `npx prisma studio`
3. Review Swagger docs: http://localhost:3000/api/docs
4. Check this guide's troubleshooting section