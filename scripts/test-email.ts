import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/common/services/email.service';

async function testEmail() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx ts-node scripts/test-email.ts <email>');
    process.exit(1);
  }

  console.log(`Testing email configuration...`);
  console.log(`Sending test email to: ${email}`);

  const app = await NestFactory.createApplicationContext(AppModule);
  const emailService = app.get(EmailService);

  const result = await emailService.sendTestEmail(email);

  if (result.success) {
    console.log('Test email sent successfully!');
    console.log(`Message ID: ${result.messageId}`);
  } else {
    console.error('Failed to send test email');
    console.error(`Error: ${result.error}`);
  }

  await app.close();
}

testEmail().catch(console.error);