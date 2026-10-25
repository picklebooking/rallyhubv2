import { jest } from '@jest/globals';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import { OpenPlayController } from './open-play.controller';
import type { OpenPlayService } from './open-play.service';

const session = { user: { id: 'u-1' } } as unknown as UserSession;

describe('OpenPlayController', () => {
  let service: jest.Mocked<OpenPlayService>;
  let controller: OpenPlayController;

  beforeEach(() => {
    service = {
      list: jest.fn(),
      getByToken: jest.fn(),
      joinByToken: jest.fn(),
      joinPublic: jest.fn(),
      leave: jest.fn(),
      cancel: jest.fn(),
      enable: jest.fn(),
      setVisibility: jest.fn(),
      getManageView: jest.fn(),
    } as unknown as jest.Mocked<OpenPlayService>;
    controller = new OpenPlayController(service);
  });

  it('list forwards the query', async () => {
    await controller.list({ page: 2 });
    expect(service.list).toHaveBeenCalledWith({ page: 2 });
  });

  // Better Auth sets request.session to null (not undefined) when signed out.
  it('getByToken forwards null when signed out', async () => {
    await controller.getByToken('tok', null);
    expect(service.getByToken).toHaveBeenCalledWith('tok', null);
  });

  it('getByToken forwards the viewer id when signed in', async () => {
    await controller.getByToken('tok', session);
    expect(service.getByToken).toHaveBeenCalledWith('tok', 'u-1');
  });

  it.each([
    ['joinByToken', ['tok'], ['tok', 'u-1']],
    ['joinPublic', ['b-1'], ['b-1', 'u-1']],
    ['leave', ['b-1'], ['b-1', 'u-1']],
    ['cancel', ['b-1'], ['b-1', 'u-1']],
    ['getManageView', ['b-1'], ['b-1', 'u-1']],
  ] as const)(
    '%s forwards the session user id',
    async (method, args, expected) => {
      await (controller[method] as (...a: unknown[]) => Promise<unknown>)(
        ...args,
        session,
      );
      expect(service[method]).toHaveBeenCalledWith(...expected);
    },
  );

  it('enable and setVisibility forward the body', async () => {
    await controller.enable('b-1', { capacity: 6 }, session);
    expect(service.enable).toHaveBeenCalledWith('b-1', 'u-1', { capacity: 6 });
    await controller.setVisibility('b-1', { isPublic: true }, session);
    expect(service.setVisibility).toHaveBeenCalledWith('b-1', 'u-1', {
      isPublic: true,
    });
  });
});
