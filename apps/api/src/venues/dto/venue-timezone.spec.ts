import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVenueDto } from './create-venue.dto';
import { UpdateVenueDto } from './update-venue.dto';

describe('Venue timezone validation', () => {
  it.each([CreateVenueDto, UpdateVenueDto])(
    'rejects invalid timezone in %p',
    async (Dto) => {
      const errors = await validate(
        plainToInstance<UpdateVenueDto, object>(Dto, {
          name: 'Venue',
          slug: 'venue',
          timezone: 'Mars/Phobos',
        }),
      );
      expect(errors.map((error) => error.property)).toContain('timezone');
    },
  );
});
