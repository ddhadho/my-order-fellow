import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('email.smtp.host'),
      port: this.config.get('email.smtp.port'),
      secure: false,
      auth: {
        user: this.config.get('email.smtp.user'),
        pass: this.config.get('email.smtp.password'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.get('email.from'),
        to,
        subject,
        html,
      });

      console.log('📧 Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email failed:', error);
      return { success: false, error: error.message };
    }
  }

  generateTrackingActivatedEmail(orderData: any) {
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

  generateStatusUpdateEmail(orderData: any, newStatus: string, note?: string) {
    const statusEmojis = {
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
            ${note ? `<div class="note"><strong>Note:</strong> ${note}</div>` : ''}
            <p><strong>Items:</strong> ${orderData.itemSummary}</p>
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
