# Notification Testing Guide

This guide explains how to test email notifications in My Order Fellow.

## Prerequisites

Before testing notifications:
1. ✅ SMTP server credentials (Gmail, SendGrid, Mailgun, etc.)
2. ✅ Environment variables configured
3. ✅ Phase 3 (Webhooks) completed
4. ✅ Test email address to receive notifications

---

## Email Configuration

### Option 1: Gmail (Development/Testing)

**Step 1: Enable App Passwords**
1. Go to Google Account settings
2. Security → 2-Step Verification (enable if not enabled)
3. Security → App passwords
4. Generate new app password for "Mail"
5. Copy the 16-character password

**Step 2: Update .env**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
EMAIL_FROM=noreply@myorderfellow.com
```

**Important Gmail Notes:**
- Use App Password, NOT your regular Gmail password
- Enable 2-Factor Authentication first
- Gmail may block first few emails - check spam folder
- Daily sending limit: ~500 emails

### Option 2: SendGrid (Production)
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### Option 3: Mailtrap (Testing Only)
```bash
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-password
EMAIL_FROM=test@example.com
```

**Mailtrap advantages:**
- Catches all emails (won't actually send to customers)
- Perfect for development/testing
- Web interface to view emails
- Free tier available

---

## Testing Email Configuration

### Method 1: Using Test Script
```bash
# Test email sending
npx ts-node scripts/test-email.ts your-email@example.com
```

**Expected output:**
```
📧 Testing email configuration...
📬 Sending test email to: your-email@example.com
✅ Test email sent successfully!
📨 Message ID: <1234567890@smtp.gmail.com>
```

**If it fails:**
```
❌ Failed to send test email
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

→ Check SMTP credentials in .env

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
echo "📦 Creating order..."
curl -X POST http://localhost:3000/api/v1/webhooks/order-received \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"customerEmail\":\"test@example.com\",\"itemSummary\":\"Test\",\"deliveryAddress\":\"Test\"}"

sleep 2

# 2. In Transit
echo "🚚 Updating to IN_TRANSIT..."
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"newStatus\":\"IN_TRANSIT\",\"note\":\"Shipped from warehouse\"}"

sleep 2

# 3. Out for Delivery
echo "📦 Updating to OUT_FOR_DELIVERY..."
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"newStatus\":\"OUT_FOR_DELIVERY\",\"note\":\"Out for delivery\"}"

sleep 2

# 4. Delivered
echo "✅ Updating to DELIVERED..."
curl -X POST http://localhost:3000/api/v1/webhooks/status-update \
  -H "X-Webhook-Secret: $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"externalOrderId\":\"$ORDER_ID\",\"newStatus\":\"DELIVERED\",\"note\":\"Successfully delivered\"}"

echo "✅ Complete! Check email for 4 notifications"
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
# ✅ Email sent: <message-id>
# ❌ Email failed: Error message
```

### Email Status Indicators

**Success:**
```
📧 Email sent: <1234567890@smtp.gmail.com>
```

**Failure:**
```
❌ Email failed: Invalid login
❌ Email failed: Connection timeout
❌ Email failed: Recipient address rejected
```

---

## Troubleshooting

### Issue: "Invalid login: 535-5.7.8"

**Cause:** Incorrect SMTP credentials

**Solutions:**
- Verify SMTP_USER is correct email
- Use App Password (not regular password) for Gmail
- Check 2FA is enabled for Gmail
- Regenerate App Password

### Issue: "Connection timeout"

**Cause:** Network/firewall blocking SMTP port

**Solutions:**
- Check SMTP_PORT (587 for TLS, 465 for SSL)
- Try port 587 if 465 fails
- Check firewall settings
- Try different SMTP provider

### Issue: Emails going to spam

**Solutions:**
- Use proper EMAIL_FROM domain
- Set up SPF/DKIM records (production)
- Use authenticated SMTP service
- Ask recipients to whitelist sender

### Issue: "Emails not being sent"

**Check:**
1. **Environment variables loaded:**
```bash
echo $SMTP_HOST
echo $SMTP_USER
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

4. **Test SMTP directly:**
```bash
npx ts-node scripts/test-email.ts test@example.com
```

### Issue: Duplicate notifications

**Cause:** Webhook retries triggering multiple emails

**Solution:** Already handled by idempotency in webhooks - duplicate orders won't create duplicate notifications

---

## Best Practices

### Development
- ✅ Use Mailtrap to catch all test emails
- ✅ Don't use production email addresses
- ✅ Test with your own email first

### Production
- ✅ Use dedicated email service (SendGrid, AWS SES)
- ✅ Monitor notification failure rate
- ✅ Set up retry mechanism for failed emails
- ✅ Configure proper SPF/DKIM records
- ✅ Use company domain in EMAIL_FROM
- ✅ Implement rate limiting if needed

### Email Content
- ✅ Keep subject lines clear and concise
- ✅ Include order ID in subject
- ✅ Make emails mobile-friendly
- ✅ Add unsubscribe option (future feature)
- ✅ Include support contact information

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
1. ✅ Test with real e-commerce orders
2. ✅ Monitor email delivery rates
3. ✅ Set up automated retry for failures
4. ✅ Configure production email service
5. ✅ Add email analytics tracking
6. ✅ Implement notification preferences (future)

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
- Gmail App Passwords: https://support.google.com/accounts/answer/185833
- SendGrid Setup: https://sendgrid.com/docs/
- Mailtrap: https://mailtrap.io/