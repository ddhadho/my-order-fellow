import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

async function retryNotifications() {
  console.log(' Starting notification retry process...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const notificationsService = app.get(NotificationsService);

  try {
    await notificationsService.retryFailedNotifications();
    console.log('\n Notification retry complete');
  } catch (error) {
    console.error(' Error during retry:', error.message);
    process.exit(1);
  }

  await app.close();
}

retryNotifications();