import { SmsService } from './sms.service';
import { ConfigService } from '@nestjs/config';

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      'sms.apiKey': 'test-api-key',
      'sms.username': 'sandbox',
      'sms.senderId': 'MyOrderFellow',
    };
    return config[key];
  }),
} as unknown as ConfigService;

// Mock AfricasTalking to avoid real API calls
jest.mock('africastalking', () => {
  return jest.fn(() => ({
    SMS: {
      send: jest.fn().mockResolvedValue({
        SMSMessageData: {
          Recipients: [
            {
              number: '+254712345678',
              status: 'Success',
              cost: 'KES 0.8000',
              messageId: 'msg-123',
            },
          ],
        },
      }),
    },
  }));
});

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(() => {
    service = new SmsService(mockConfigService);
  });

  // ─── normalizePhoneNumber ─────────────────────────────────────────────────

  describe('normalizePhoneNumber', () => {
    it('should return null for empty string', () => {
      expect(service.normalizePhoneNumber('')).toBeNull();
    });

    it('should return null for invalid number', () => {
      expect(service.normalizePhoneNumber('123')).toBeNull();
      expect(service.normalizePhoneNumber('abcdefghij')).toBeNull();
    });

    it('should return E.164 format unchanged', () => {
      expect(service.normalizePhoneNumber('+254712345678')).toBe(
        '+254712345678',
      );
    });

    it('should normalize 2547XX format to E.164', () => {
      expect(service.normalizePhoneNumber('254712345678')).toBe(
        '+254712345678',
      );
    });

    it('should normalize Kenyan 07XX format to E.164', () => {
      expect(service.normalizePhoneNumber('0712345678')).toBe('+254712345678');
    });

    it('should normalize Kenyan 01XX format to E.164', () => {
      expect(service.normalizePhoneNumber('0112345678')).toBe('+254112345678');
    });

    it('should strip spaces and hyphens before normalizing', () => {
      expect(service.normalizePhoneNumber('0712 345 678')).toBe(
        '+254712345678',
      );
      expect(service.normalizePhoneNumber('0712-345-678')).toBe(
        '+254712345678',
      );
    });

    it('should return null for numbers with wrong length', () => {
      expect(service.normalizePhoneNumber('071234567')).toBeNull(); // 9 digits
      expect(service.normalizePhoneNumber('07123456789')).toBeNull(); // 11 digits
    });
  });

  // ─── isValidKenyanNumber ──────────────────────────────────────────────────

  describe('isValidKenyanNumber', () => {
    it('should return true for valid Kenyan Safaricom number', () => {
      expect(service.isValidKenyanNumber('0712345678')).toBe(true);
      expect(service.isValidKenyanNumber('+254712345678')).toBe(true);
    });

    it('should return true for valid Kenyan Airtel number', () => {
      expect(service.isValidKenyanNumber('0112345678')).toBe(true);
    });

    it('should return false for invalid numbers', () => {
      expect(service.isValidKenyanNumber('123')).toBe(false);
      expect(service.isValidKenyanNumber('')).toBe(false);
    });

    it('should return false for non-Kenyan numbers', () => {
      expect(service.isValidKenyanNumber('+1234567890')).toBe(false);
    });
  });

  // ─── generateTrackingActivatedSms ────────────────────────────────────────

  describe('generateTrackingActivatedSms', () => {
    it('should include order ID in message', () => {
      const msg = service.generateTrackingActivatedSms('ORD-123', 'iPhone 15');
      expect(msg).toContain('ORD-123');
    });

    it('should include item summary in message', () => {
      const msg = service.generateTrackingActivatedSms('ORD-123', 'iPhone 15');
      expect(msg).toContain('iPhone 15');
    });

    it('should truncate long item summaries', () => {
      const longSummary = 'A'.repeat(100);
      const msg = service.generateTrackingActivatedSms('ORD-123', longSummary);
      expect(msg).toContain('...');
    });

    it('should not truncate short item summaries', () => {
      const msg = service.generateTrackingActivatedSms('ORD-123', 'iPhone 15');
      expect(msg).not.toContain('...');
    });

    it('should include sender name', () => {
      const msg = service.generateTrackingActivatedSms('ORD-123', 'iPhone 15');
      expect(msg).toContain('MyOrderFellow');
    });
  });

  // ─── generateStatusUpdateSms ──────────────────────────────────────────────

  describe('generateStatusUpdateSms', () => {
    it('should include order ID', () => {
      const msg = service.generateStatusUpdateSms('ORD-123', 'IN_TRANSIT');
      expect(msg).toContain('ORD-123');
    });

    it('should convert status to human readable label', () => {
      const msg = service.generateStatusUpdateSms('ORD-123', 'IN_TRANSIT');
      expect(msg).toContain('In Transit');
    });

    it('should include note when provided', () => {
      const msg = service.generateStatusUpdateSms(
        'ORD-123',
        'IN_TRANSIT',
        'Left Nairobi warehouse',
      );
      expect(msg).toContain('Left Nairobi warehouse');
    });

    it('should handle DELIVERED status', () => {
      const msg = service.generateStatusUpdateSms('ORD-123', 'DELIVERED');
      expect(msg).toContain('Delivered');
    });

    it('should handle OUT_FOR_DELIVERY status', () => {
      const msg = service.generateStatusUpdateSms(
        'ORD-123',
        'OUT_FOR_DELIVERY',
      );
      expect(msg).toContain('Out for Delivery');
    });

    it('should keep message under 160 chars when possible', () => {
      const msg = service.generateStatusUpdateSms('ORD-123', 'IN_TRANSIT');
      expect(msg.length).toBeLessThanOrEqual(160);
    });

    it('should handle unknown status gracefully', () => {
      const msg = service.generateStatusUpdateSms('ORD-123', 'CUSTOM_STATUS');
      expect(msg).toContain('CUSTOM_STATUS');
    });
  });

  // ─── generateOtpSms ──────────────────────────────────────────────────────

  describe('generateOtpSms', () => {
    it('should include the OTP in the message', () => {
      const msg = service.generateOtpSms('123456');
      expect(msg).toContain('123456');
    });

    it('should include default expiry of 10 minutes', () => {
      const msg = service.generateOtpSms('123456');
      expect(msg).toContain('10 minutes');
    });

    it('should use custom expiry when provided', () => {
      const msg = service.generateOtpSms('123456', 5);
      expect(msg).toContain('5 minutes');
    });

    it('should warn not to share the code', () => {
      const msg = service.generateOtpSms('123456');
      expect(msg).toContain('Do not share');
    });
  });

  // ─── getSmsSegmentCount ───────────────────────────────────────────────────

  describe('getSmsSegmentCount', () => {
    it('should return 1 for messages under 160 chars', () => {
      expect(service.getSmsSegmentCount('Hello')).toBe(1);
      expect(service.getSmsSegmentCount('A'.repeat(160))).toBe(1);
    });

    it('should return 2 for messages between 161 and 306 chars', () => {
      expect(service.getSmsSegmentCount('A'.repeat(161))).toBe(2);
      expect(service.getSmsSegmentCount('A'.repeat(306))).toBe(2);
    });

    it('should return 3 for messages between 307 and 459 chars', () => {
      expect(service.getSmsSegmentCount('A'.repeat(307))).toBe(3);
    });
  });

  // ─── sendSms ─────────────────────────────────────────────────────────────

  describe('sendSms', () => {
    it('should return success for valid number', async () => {
      const result = await service.sendSms('0712345678', 'Test message');
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
    });

    it('should return failure for invalid number', async () => {
      const result = await service.sendSms('123', 'Test message');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });
  });
});
