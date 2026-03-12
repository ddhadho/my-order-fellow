import * as crypto from 'crypto';

export function generateWebhookSignature(
  payload: string,
  secret: string,
): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string,
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
}
