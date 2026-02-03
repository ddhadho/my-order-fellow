import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Company } from '@prisma/client';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Company => {
    const request = ctx.switchToHttp().getRequest<{ user: Company }>();
    return request.user;
  },
);
