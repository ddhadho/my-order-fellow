# Notification Testing Guide

This guide explains how to test email notifications in My Order Fellow.

## Prerequisites

Before testing notifications:
1. Resend API Key
2. Test email address to receive notifications
3. Environment variables configured

---

## Email Configuration

### Resend

**Step 1: Get your Resend API Key**
1. Sign up/Log in to Resend: https://resend.com/
2. Go to API Keys and create a new key.

**Step 2: Update .env**
```bash
RESEND_API_KEY=re_YOUR_RESEND_API_KEY
RESEND_FROM_EMAIL=onboarding@yourdomain.com
```

**Important Resend Notes:**
- Ensure your sending domain is verified in Resend.
- Resend offers a generous free tier for development.

---

## Testing Email Configuration

### Method 1: Using Test Script
```bash
# Test email sending
npx ts-node scripts/test-email.ts your-email@example.com
```

**Expected output:**
```
Testing email configuration...
Sending test email to: your-email@example.com
Test email sent successfully!
Message ID: email_xxxxxxxxxxxxxxxxxxxx
```

**If it fails:**
```
Failed to send test email
Error: [RESEND_API_KEY_INVALID] The API key is invalid or has expired.
```

→ Check RESEND_API_KEY and your verified domain in Resend.

### Method 2: Check Email in Inbox

1. Run the test script
2. Check your inbox (may take 1-2 minutes)
3. Check spam folder if not in inbox
4. Email subject: "My Order Fellow - Email Test"

---

## Testing Notification Flow

### Full End-to-End Test

**Step 1: Start the Application**
```bash
npm run start:dev
```

**Step 2: Create an Order via Webhook**
```bash
# Get your webhook secret first
npx ts-node scripts/get-webhook-secret.ts your-company@example.com

# Send order webhook
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "externalOrderId": "TEST-001",
    "customerEmail": "customer@example.com",
    "customerPhone": "+254712345678",
    "itemSummary": "2x iPhone 15 Pro, 1x AirPods",
    "deliveryAddress": "123 Test Street, Nairobi"
  }'
```

**Step 3: Check Customer Email**
Customer should receive:
- **Subject:** Order TEST-001 - Tracking Activated
- **Content:** Order details with current status (PENDING)

**Step 4: Update Order Status**
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_WEBHOOK_SECRET" \
  -d '{
    "externalOrderId": "TEST-001",
    "newStatus": "IN_TRANSIT",
    "note": "Package departed from warehouse"
  }'
```

**Step 5: Check Customer Email Again**
Customer should receive:
- **Subject:** Order TEST-001 - Status Update: IN_TRANSIT
- **Content:** Status update with note

---

## Verifying Notifications in Database

### Using Prisma Studio
```bash
npx prisma studio
```

Navigate to `notifications` table and verify:
- Notification records created
- Status is "SENT" (not "FAILED")
- `sentAt` timestamp populated
- No error messages

### Using SQL Query
```bash
npx prisma db execute --stdin <<EOF
SELECT 
  n.type,
  n.recipient,
  n.status,
  n.sent_at,
  n.failed_at,
  n.error_msg,
  o.external_order_id
FROM notifications n
JOIN orders o ON n.order_id = o.id
ORDER BY n.created_at DESC
LIMIT 10;
EOF
```

---

## Testing Multiple Status Updates

Simulate full order lifecycle:
```bash
#!/bin/bash
WEBHOOK_SECRET="your-webhook-secret"
ORDER_ID="LIFECYCLE-$(date +%s)"

# 1. Create order
echo "Creating order..."
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"customerEmail\":\"test@example.com\",\"itemSummary\":\"Test\",\"deliveryAddress\":\"Test\"}"

sleep 2

# 2. In Transit
echo "Updating to IN_TRANSIT..."
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"newStatus\":\"IN_TRANSIT\",\"note\":\"Shipped from warehouse\"}"

sleep 2

# 3. Out for Delivery
echo "Updating to OUT_FOR_DELIVERY..."
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"newStatus\":\"OUT_FOR_DELIVERY\",\"note\":\"Out for delivery\"}"

sleep 2

# 4. Delivered
echo "Updating to DELIVERED..."
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"newStatus\":\"DELIVERED\",\"note\":\"Successfully delivered\"}"

echo "Complete! Check email for 4 notifications"
```

Customer should receive **4 emails total**:
1. Tracking Activated (PENDING)
2. Status Update (IN_TRANSIT)
3. Status Update (OUT_FOR_DELIVERY)
4. Status Update (DELIVERED)

---

## Testing Failed Notifications

### Simulate Email Failure

1. **Temporarily break SMTP config:**
```bash
# In .env, change to invalid password
SMTP_PASSWORD=wrong-password
```

2. **Send order webhook** (notification will fail)

3. **Check database:**
```sql
SELECT * FROM notifications WHERE status = 'FAILED';
```

Should show:
- `status`: FAILED
- `failedAt`: timestamp
- `errorMsg`: "Invalid login: 535..."

4. **Fix SMTP config**

5. **Retry failed notifications:**
```typescript
// In your application code or create a script
await notificationsService.retryFailedNotifications();
```

---

## Monitoring Email Delivery

### Check Server Logs
```bash
# Watch logs in real-time
npm run start:dev

# Look for these logs:
# Email sent: email_xxxxxxxxxxxxxxxxxxxx
# Email failed: Error message
```

### Email Status Indicators

**Success:**
```
Email sent: email_xxxxxxxxxxxxxxxxxxxx
```

**Failure:**
```
Email failed: [RESEND_API_KEY_INVALID] The API key is invalid or has expired.
Email failed: [RESEND_DOMAIN_NOT_VERIFIED] The sending domain is not verified.
Email failed: [RESEND_RATE_LIMIT_EXCEEDED] Rate limit exceeded.
```

---

## Troubleshooting

### Issue: "Email failed: [RESEND_API_KEY_INVALID]"

**Cause:** Invalid or expired Resend API key.

**Solutions:**
- Verify `RESEND_API_KEY` in your `.env` file.
- Ensure the API key is active and correctly copied from the Resend dashboard.

### Issue: "Email failed: [RESEND_DOMAIN_NOT_VERIFIED]"

**Cause:** The domain used in `RESEND_FROM_EMAIL` is not verified in Resend.

**Solutions:**
- Go to your Resend dashboard -> Domains.
- Add and verify your sending domain.
- Ensure `RESEND_FROM_EMAIL` matches a verified sender or domain.

### Issue: "Email failed: [RESEND_RATE_LIMIT_EXCEEDED]"

**Cause:** You have exceeded Resend's sending rate limits.

**Solutions:**
- Check Resend's rate limit documentation for your plan.
- Implement back-off or queueing mechanisms for high-volume sending.

### Issue: "Emails not being sent"

**Check:**
1. **Environment variables loaded:**
```bash
echo $RESEND_API_KEY
echo $RESEND_FROM_EMAIL
```

2. **Application logs:**
```bash
# Look for notification triggers
npm run start:dev | grep "Email"
```

3. **Database notifications table:**
```sql
SELECT status, error_msg FROM notifications ORDER BY created_at DESC LIMIT 5;
```

4. **Test email directly:**
```bash
npx ts-node scripts/test-email.ts test@example.com
```

### Issue: Duplicate notifications

**Cause:** Webhook retries triggering multiple emails

**Solution:** Already handled by idempotency in webhooks - duplicate orders won't create duplicate notifications

---

## Best Practices

### Development
- Use Resend's test API key during development.
- Don't use production email addresses.
- Test with your own email first.

### Production
- Use Resend or a similar transactional email service.
- Monitor notification failure rate.
- Set up retry mechanism for failed emails.
- Configure proper SPF/DKIM records in Resend and your DNS.
- Use company domain in `RESEND_FROM_EMAIL`.
- Implement rate limiting if needed.

### Email Content
- Keep subject lines clear and concise
- Include order ID in subject
- Make emails mobile-friendly
- Add unsubscribe option (future feature)
- Include support contact information

---

## Email Template Preview

You can preview email templates without sending:
```typescript
import { EmailService } from './src/common/services/email.service';

const emailService = new EmailService(configService);

const mockOrder = {
  externalOrderId: 'ORD-PREVIEW',
  itemSummary: 'Sample Product',
  deliveryAddress: 'Sample Address',
  currentStatus: 'PENDING',
};

// Generate HTML
const html = emailService.generateTrackingActivatedEmail(mockOrder);

// Save to file for preview
fs.writeFileSync('email-preview.html', html);
// Open email-preview.html in browser
```

---

## Notification Metrics

Track notification performance:
```sql
-- Total notifications sent
SELECT COUNT(*) FROM notifications;

-- Success rate
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM notifications), 2) as percentage
FROM notifications
GROUP BY status;

-- Failed notifications with errors
SELECT 
  error_msg,
  COUNT(*) as count
FROM notifications
WHERE status = 'FAILED'
GROUP BY error_msg
ORDER BY count DESC;

-- Average delivery time
SELECT 
  AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_seconds
FROM notifications
WHERE status = 'SENT';
```

---

## Next Steps

After successful notification testing:
1. Test with real e-commerce orders
2. Monitor email delivery rates
3. Set up automated retry for failures
4. Configure production email service
5. Add email analytics tracking
6. Implement notification preferences (future)

---

## Support

**Common Commands:**
```bash
# Test email configuration
npx ts-node scripts/test-email.ts <email>

# Get webhook secret
npx ts-node scripts/get-webhook-secret.ts <company-email>

# View notifications
npx prisma studio

# Check logs
npm run start:dev | grep "Email"
```

**Resources:**
- Resend Documentation: https://resend.com/docs/