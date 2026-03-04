import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Company } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const company: Company = request.user; // Assuming JwtAuthGuard has attached the user/company to the request

    if (!company || company.role !== Role.ADMIN) {
      throw new ForbiddenException('Access denied. Admin privileges required.');
    }

    return true;
  }
}
