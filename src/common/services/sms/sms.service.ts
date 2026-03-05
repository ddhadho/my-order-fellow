import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import AfricasTalking from 'africastalking';

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  cost?: string;
  error?: string;
}

export interface SmsRecipientResult {
  number: string;
  status: string;
  cost: string;
  messageId: string;
}

@Injectable()
export class SmsService {
  private at: ReturnType<typeof AfricasTalking>;
  private sms: any;

  constructor(private config: ConfigService) {
    this.at = AfricasTalking({
      apiKey: this.config.get<string>('sms.apiKey') || '',
      username: this.config.get<string>('sms.username') || '',
    });
    this.sms = this.at.SMS;
  }

  async sendSms(to: string, message: string): Promise<SendSmsResult> {
    try {
      const normalized = this.normalizePhoneNumber(to);
      if (!normalized) {
        return { success: false, error: `Invalid phone number: ${to}` };
      }

      const response = await this.sms.send({
        to: [normalized],
        message,
        from: this.config.get<string>('sms.senderId') || 'MyOrderFellow',
      });

      const recipient: SmsRecipientResult =
        response.SMSMessageData.Recipients[0];

      if (recipient.status === 'Success') {
        return {
          success: true,
          messageId: recipient.messageId,
          cost: recipient.cost,
        };
      }

      return { success: false, error: recipient.status };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('SMS failed:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Normalize a phone number to E.164 format.
   * Handles Kenyan numbers: 07XX, 01XX, +2547XX, 2547XX
   * Returns null if the number is invalid.
   */
  normalizePhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Strip all non-digit characters except leading +
    const cleaned = phone.replace(/[\s\-().]/g, '');

    // Already in E.164 format
    if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;

    // International format without +
    if (/^254\d{9}$/.test(cleaned)) return `+${cleaned}`;

    // Kenyan local format: 07XX or 01XX (10 digits)
    if (/^0[17]\d{8}$/.test(cleaned)) {
      return `+254${cleaned.substring(1)}`;
    }

    return null;
  }

  /**
   * Generate SMS message for tracking activated event.
   */
  generateTrackingActivatedSms(
    externalOrderId: string,
    itemSummary: string,
  ): string {
    const truncated =
      itemSummary.length > 50
        ? `${itemSummary.substring(0, 47)}...`
        : itemSummary;
    return `MyOrderFellow: Your order ${externalOrderId} is now being tracked! Items: ${truncated}. You'll receive updates as your order progresses.`;
  }

  /**
   * Generate SMS message for order status update.
   */
  generateStatusUpdateSms(
    externalOrderId: string,
    newStatus: string,
    note?: string,
  ): string {
    const statusLabels: Record<string, string> = {
      PENDING: 'Pending',
      IN_TRANSIT: 'In Transit',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED: 'Delivered',
    };

    const label = statusLabels[newStatus] ?? newStatus;
    const base = `MyOrderFellow: Order ${externalOrderId} update - ${label}.`;
    const suffix = note ? ` ${note}` : ' Track your order for more details.';

    // SMS limit: 160 chars per segment — keep under 160
    const full = `${base}${suffix}`;
    return full.length <= 160 ? full : `${base} Track your order for details.`;
  }

  /**
   * Generate SMS message for OTP verification.
   */
  generateOtpSms(otp: string, expiryMinutes = 10): string {
    return `MyOrderFellow: Your verification code is ${otp}. It expires in ${expiryMinutes} minutes. Do not share this code.`;
  }

  /**
   * Validate that a message fits within SMS segment limits.
   * Returns the number of segments the message will use.
   */
  getSmsSegmentCount(message: string): number {
    const length = message.length;
    if (length <= 160) return 1;
    if (length <= 306) return 2;
    return Math.ceil(length / 153);
  }

  /**
   * Check if a phone number is a valid Kenyan number.
   */
  isValidKenyanNumber(phone: string): boolean {
    const normalized = this.normalizePhoneNumber(phone);
    if (!normalized) return false;
    return /^\+2547\d{8}$/.test(normalized) || /^\+2541\d{8}$/.test(normalized);
  }
}
