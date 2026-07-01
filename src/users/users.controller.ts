import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isNotificationSettingInput } from './users.service';
import { UsersService } from './users.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('diagnoses')
  getMyDiagnoses(@CurrentUser() user: { id: string }) {
    return this.usersService.getMyDiagnoses(user.id);
  }

  @Get('notification-settings')
  getNotificationSettings(@CurrentUser() user: { id: string }) {
    return this.usersService.getNotificationSettings(user.id);
  }

  @Patch('notification-settings')
  @ApiBody({
    schema: { example: { diagnosisAlert: true, weeklyReport: false } },
  })
  updateNotificationSettings(
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    if (!isNotificationSettingInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }

    return this.usersService.updateNotificationSettings(user.id, body);
  }
}
