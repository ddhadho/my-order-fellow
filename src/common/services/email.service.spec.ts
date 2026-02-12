import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { Resend } from 'resend';

// Mock the Resend class
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn(),
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let resend: Resend;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'email.apiKey') return 'test-api-key';
              if (key === 'email.from') return 'test@example.com';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    resend = (service as any).resend;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send an email successfully', async () => {
      const to = 'recipient@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test HTML</p>';
      const messageId = 'test-message-id';

      (resend.emails.send as jest.Mock).mockResolvedValue({
        data: { id: messageId },
        error: null,
      });

      const result = await service.sendEmail(to, subject, html);

      expect(resend.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to,
        subject,
        html,
      });
      expect(result).toEqual({
        success: true,
        messageId,
      });
    });

    it('should handle email sending failure', async () => {
      const to = 'recipient@example.com';
      const subject = 'Test Subject';
      const html = '<p>Test HTML</p>';
      const errorMessage = 'Failed to send';

      (resend.emails.send as jest.Mock).mockResolvedValue({
        data: null,
        error: new Error(errorMessage),
      });

      const result = await service.sendEmail(to, subject, html);

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });
  });
});
