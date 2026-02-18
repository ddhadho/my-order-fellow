import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface BaseOrderEmailData {
  externalOrderId: string;
  itemSummary: string;
}

interface TrackingActivatedEmailData extends BaseOrderEmailData {
  deliveryAddress: string;
  currentStatus: string;
}

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('email.apiKey'));
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<SendEmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get<string>('email.from') || '',
        to,
        subject,
        html,
      });

      if (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }

      console.log('Email sent:', data.id);
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Email failed:', error);
      return { success: false, error: errorMessage };
    }
  }

  generateTrackingActivatedEmail(
    orderData: TrackingActivatedEmailData,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .status { background: #4CAF50; color: white; padding: 10px; border-radius: 5px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Tracking Activated</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>Your order <strong>${orderData.externalOrderId}</strong> is now being tracked!</p>
            <p><strong>Items:</strong> ${orderData.itemSummary}</p>
            <p><strong>Delivery Address:</strong> ${orderData.deliveryAddress}</p>
            <div class="status">Current Status: ${orderData.currentStatus}</div>
            <p>You'll receive updates as your order progresses.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateStatusUpdateEmail(
    orderData: BaseOrderEmailData,
    newStatus: string,
    note?: string,
  ): string {
    const statusEmojis: { [key: string]: string } = {
      PENDING: '⏳',
      IN_TRANSIT: '🚚',
      OUT_FOR_DELIVERY: '📦',
      DELIVERED: '✅',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .status { background: #2196F3; color: white; padding: 15px; border-radius: 5px; text-align: center; font-size: 18px; }
          .note { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Status Update</h1>
          </div>
          <div class="content">
            <p>Hi there,</p>
            <p>Your order <strong>${orderData.externalOrderId}</strong> has been updated!</p>
            <div class="status">
              ${statusEmojis[newStatus]} ${newStatus.replace('_', ' ')}
            </div>
            ${
              note
                ? `<div class="note"><strong>Note:</strong> ${note}</div>`
                : ''
            }
            <p><strong>Items:</strong> ${orderData.itemSummary}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateOtpEmail(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FFA726; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; text-align: center; }
          .otp { background: #FFA726; color: white; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email Address</h1>
          </div>
          <div class="content">
            <p>Thanks for registering! Please use the following One-Time Password (OTP) to verify your email address.</p>
            <div class="otp">${otp}</div>
            <p>This OTP will expire in 10 minutes.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendTestEmail(to: string) {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
        <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        </style>
        </head>
        <body>
        <div class="container">
            <div class="header">
            <h1>✅ Email Configuration Test</h1>
            </div>
            <div style="padding: 20px;">
            <p>This is a test email from My Order Fellow.</p>
            <p>If you're reading this, your email configuration is working correctly!</p>
            <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
            </div>
        </div>
        </body>
        </html>
    `;

    return this.sendEmail(to, 'My Order Fellow - Email Test', html);
  }

  generateKycApprovedEmail(companyName: string, webhookSecret: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .secret-box { background: #e0e0e0; padding: 10px; border-radius: 5px; font-family: 'Courier New', Courier, monospace; overflow-wrap: break-word; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>KYC Approved!</h1>
          </div>
          <div class="content">
            <p>Dear ${companyName},</p>
            <p>Congratulations! Your Know Your Customer (KYC) application has been successfully approved.</p>
            <p>Your webhook integration is now active. Please find your webhook secret below:</p>
            <div class="secret-box">
              <strong>Webhook Secret:</strong> ${webhookSecret}
            </div>
            <p>Keep this secret confidential and secure. You will need it to verify the authenticity of webhook payloads sent to your system.</p>
            <p>If you have any questions, please do not hesitate to contact our support team.</p>
            <p>Sincerely,</p>
            <p>The My Order Fellow Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
