import { Injectable } from "@nestjs/common";
import { CommonConstants } from "../constants/common.constant";

@Injectable()
export class DateTimeHelper {

  /**
   * Adds a specified number of hours to a given date.
   *
   * @param    {number} durationInHours  The duration in hours to be added.
   * @param    {string} dateString       The date string to be converted.
   * @returns  {Date}                    The new date after adding the duration.
   */
  public addHoursToCurrentDateTime(
    durationInHours: number,
    dateString: string,
  ): Date {
    const newDuration = durationInHours * CommonConstants.HOURS_TO_MS;
    const newDateMS = new Date(dateString).getTime() + newDuration;

    return new Date(newDateMS);
  }
}
