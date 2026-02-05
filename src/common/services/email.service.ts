/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

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
  private transporter: Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('email.smtp.host'),
      port: this.config.get<number>('email.smtp.port'),
      secure: false,
      auth: {
        user: this.config.get<string>('email.smtp.user'),
        pass: this.config.get<string>('email.smtp.password'),
      },
    });
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<SendEmailResult> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const info = await this.transporter.sendMail({
        from: this.config.get<string>('email.from'),
        to,
        subject,
        html,
      });

      console.log('Email sent:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      console.error('Email failed:', error);
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'An unknown error occurred' };
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
}
