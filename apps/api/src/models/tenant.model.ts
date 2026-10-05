export class TenantResponse<T> {
  constructor(
    public success: boolean,
    public message: string,
    public statusCode: number,
    public data?: T,
  ) {}
}
