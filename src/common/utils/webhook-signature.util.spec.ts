import {
  generateWebhookSignature,
  verifyWebhookSignature,
} from './webhook-signature.util';

describe('WebhookSignatureUtil', () => {
  const secret = 'test-secret';
  const payload = '{"orderId":"123","status":"PENDING"}';

  describe('generateWebhookSignature', () => {
    it('should generate a 64 char hex string', () => {
      const signature = generateWebhookSignature(payload, secret);
      expect(typeof signature).toBe('string');
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent signatures for same input', () => {
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, secret);
      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature('different payload', secret);
      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const sig1 = generateWebhookSignature(payload, secret);
      const sig2 = generateWebhookSignature(payload, 'different-secret');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature', () => {
      const signature = generateWebhookSignature(payload, secret);
      expect(verifyWebhookSignature(payload, secret, signature)).toBe(true);
    });

    it('should return false for tampered payload', () => {
      const signature = generateWebhookSignature(payload, secret);
      expect(
        verifyWebhookSignature('tampered payload', secret, signature),
      ).toBe(false);
    });

    it('should return false for wrong secret', () => {
      const signature = generateWebhookSignature(payload, secret);
      expect(verifyWebhookSignature(payload, 'wrong-secret', signature)).toBe(
        false,
      );
    });

    it('should return false for invalid signature same length', () => {
      // Must be 64 chars to avoid timingSafeEqual length mismatch error
      const fakeSignature = 'a'.repeat(64);
      expect(verifyWebhookSignature(payload, secret, fakeSignature)).toBe(
        false,
      );
    });
  });
});
