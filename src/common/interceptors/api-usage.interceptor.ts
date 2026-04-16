import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const companyId = request.user?.id;

    return next.handle().pipe(
      tap(() => {
        if (!companyId) return;

        this.prisma.apiUsageLog
          .create({
            data: {
              companyId,
              endpoint: request.path,
              method: request.method,
              statusCode: response.statusCode,
            },
          })
          .catch((err) => console.error('Failed to log API usage:', err));
      }),
    );
  }
}
