import { Module } from '@nestjs/common';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import { OpenPlayController } from './open-play.controller';
import { OpenPlayRepository } from './open-play.repository';
import { OpenPlayService } from './open-play.service';

@Module({
  controllers: [OpenPlayController],
  providers: [OpenPlayService, OpenPlayRepository, OpenPlayTokenHelper],
})
export class OpenPlayModule {}
