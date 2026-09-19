import { Module } from '@nestjs/common';
import { CourtBookController } from './court-book.controller';
import { CourtBookService } from './court-book.service';
import { CourtBookRepository } from './court-book.repository';
import { DateTimeHelper } from '../../helper/date-time.helper';
import { PNRHelper } from '../../helper/pnr.helper';

@Module({
  controllers: [CourtBookController],
  providers: [CourtBookService, CourtBookRepository, DateTimeHelper, PNRHelper],
})
export class CourtBookModule {}
