import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

  findByCodes(codes: string[]) {
    return this.prisma.action.findMany({
      where: { code: { in: codes } },
    });
  }

  findAll() {
    return this.prisma.action.findMany({ orderBy: { code: 'asc' } });
  }
}
