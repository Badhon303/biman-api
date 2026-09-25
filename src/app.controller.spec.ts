import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  const appService = {
    health: jest
      .fn()
      .mockResolvedValue({ status: 'ok', database: 'connected' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();
    controller = module.get<AppController>(AppController);
  });

  it('returns API health', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
  });
});
