import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getWebhookSecret(email: string) {
  const company = await prisma.company.findUnique({
    where: { businessEmail: email },
    select: {
      companyName: true,
      webhookSecret: true,
      isWebhookActive: true,
      kycStatus: true,
    },
  });

  if (!company) {
    console.error('Company not found');
    return;
  }

  console.log('\n Company Information:');
  console.log(`Company: ${company.companyName}`);
  console.log(`KYC Status: ${company.kycStatus}`);
  console.log(`Webhook Active: ${company.isWebhookActive}`);
  console.log(
    `\n Webhook Secret:\n${company.webhookSecret || 'Not generated yet'}\n`,
  );

  await prisma.$disconnect();
}

// Usage: npx ts-node scripts/get-webhook-secret.ts your-email@example.com
const email = process.argv[2];
if (!email) {
  console.error('Usage: npx ts-node scripts/get-webhook-secret.ts <email>');
  process.exit(1);
}

getWebhookSecret(email);
