export class MainRoute {
  public static readonly API_VERSIONS = {
    VERSION_ONE: '1',
  };

  public static readonly MAIN_ROUTE = {
    BOOKING: 'booking',
    TENANT: 'tenant',
    OPEN_PLAY: 'open-play',
    TENANT_MEMBER: 'tenant-member',
  };

  public static readonly SUB_ROUTE = {
    CREATE_BOOKING: 'create-booking',
    CREATE: 'create',
    FIND: 'find',
    FIND_ALL: 'findAll',
    DELETE: 'delete',
    PATCH: 'patch',
  };

  public static readonly ID = 'id';
  public static readonly TENANT_ID = 'tenantId';
  public static readonly STATUS = 'status';
}
