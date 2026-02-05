// This script simulates an e-commerce platform sending webhooks to your API

import axios from 'axios';

const API_URL = 'http://localhost:3000/api/v1/webhooks';

// You'll get this secret after a company is KYC approved
const WEBHOOK_SECRET =
  '4524f415d5945076ca9d8c98d3866e86379fd28356b593a291b6e81bbd9aadd5';

async function sendOrderWebhook(externalOrderId: string) {
  try {
    console.log('Sending new order webhook...');

    const response = await axios.post(
      `${API_URL}/order-received`,
      {
        externalOrderId,
        customerEmail: 'customer@example.com',
        customerPhone: '+254712345678',
        itemSummary: '2x iPhone 15 Pro, 1x AirPods Pro',
        deliveryAddress: '123 Main Street, Nairobi, Kenya',
        initialStatus: 'PENDING',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
      },
    );

    console.log('Order webhook sent successfully:');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Error sending order webhook:');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function sendStatusUpdateWebhook(
  externalOrderId: string,
  status: string,
  note: string,
) {
  try {
    console.log(`\nSending status update webhook (${status})...`);

    const response = await axios.post(
      `${API_URL}/status-update`,
      {
        externalOrderId,
        newStatus: status,
        note,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
      },
    );

    console.log('Status update sent successfully:');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('Error sending status update:');
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function simulateOrderLifecycle() {
  try {
    // Generate a unique order ID that will be used throughout
    const externalOrderId = `ORD-${Date.now()}`;
    console.log(`Testing with order ID: ${externalOrderId}\n`);

    // 1. Create order
    await sendOrderWebhook(externalOrderId);

    // Wait 2 seconds
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 2. Update to IN_TRANSIT
    await sendStatusUpdateWebhook(
      externalOrderId,
      'IN_TRANSIT',
      'Package departed from Nairobi warehouse',
    );

    // Wait 2 seconds
    console.log('\n Waiting 2 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Update to OUT_FOR_DELIVERY
    await sendStatusUpdateWebhook(
      externalOrderId,
      'OUT_FOR_DELIVERY',
      'Out for delivery in Nairobi area',
    );

    // Wait 2 seconds
    console.log('\n Waiting 2 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 4. Update to DELIVERED
    await sendStatusUpdateWebhook(
      externalOrderId,
      'DELIVERED',
      'Package delivered successfully',
    );

    console.log('\n Full order lifecycle simulated successfully!');
    console.log(
      ` Order ${externalOrderId} went through: PENDING → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`,
    );
  } catch (error) {
    console.error('\n Error in lifecycle simulation');
    process.exit(1);
  }
}

// Run the test
console.log(' Starting webhook test...\n');
simulateOrderLifecycle();

// To run this script:
// 1. npm install axios
// 2. Add this to package.json scripts: "test:webhook": "ts-node scripts/send-test-webhook.ts"
// 3. Replace WEBHOOK_SECRET with actual secret from your database
// 4. Run: npm run test:webhook or npx ts-node scripts/send-test-webhook.ts
