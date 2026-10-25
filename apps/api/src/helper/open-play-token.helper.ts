import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** 24 random bytes -> 32 base64url chars (192 bits). */
const TOKEN_BYTES = 24;

@Injectable()
export class OpenPlayTokenHelper {
  /**
   * Generates a non-guessable Open Play join token.
   *
   * Unlike `PNRHelper`, there is no regenerate-until-unique loop: at 192
   * bits a collision is not a practical concern, and
   * `CourtBooking.openPlayJoinToken @unique` is the DB backstop.
   *
   * @returns {string} A 32-character base64url token.
   */
  public generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }
}
