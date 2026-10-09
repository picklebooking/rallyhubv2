import { Module } from '@nestjs/common';
import { CourtBookController } from './court-book.controller';
import { CourtBookService } from './court-book.service';
import { CourtBookRepository } from './court-book.repository';
import { CourtsModule } from '../courts/courts.module';
import { DateTimeHelper } from '../helper/date-time.helper';
import { OpenPlayTokenHelper } from '../helper/open-play-token.helper';
import { PNRHelper } from '../helper/pnr.helper';

@Module({
  imports: [CourtsModule],
  controllers: [CourtBookController],
  providers: [
    CourtBookService,
    CourtBookRepository,
    DateTimeHelper,
    PNRHelper,
    OpenPlayTokenHelper,
  ],
})
export class CourtBookModule {}
