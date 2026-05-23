import { ConflictException } from '@nestjs/common';
import { MinioController } from './minio.controller';

describe('MinioController quota enforcement', () => {
  const file = {
    originalname: 'avatar.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('file'),
  } as any;

  function createController() {
    const minioService = {
      uploadFile: jest.fn().mockResolvedValue({
        objectKey: 'tenants/1/users/avatar.png',
        url: '/files/avatar.png',
        etag: 'etag',
      }),
      uploadFiles: jest.fn().mockResolvedValue([
        {
          objectKey: 'tenants/1/users/avatar.png',
          url: '/files/avatar.png',
          etag: 'etag',
        },
      ]),
    };
    const prisma = {
      requireTenantId: jest.fn().mockReturnValue(1),
      withTenantData: jest.fn((data) => ({ ...data, tenantId: 1 })),
      withTenantCreateManyData: jest.fn((data) => data.map((item: Record<string, unknown>) => ({ ...item, tenantId: 1 }))),
      uploadRecord: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const quota = {
      assertCanUploadBytes: jest.fn().mockResolvedValue(undefined),
    };

    return {
      controller: new MinioController(minioService as any, prisma as any, quota as any),
      minioService,
      prisma,
      quota,
    };
  }

  it('checks storage quota before uploading a single file', async () => {
    const { controller, quota, minioService } = createController();

    await controller.uploadFile(file, 'users', { user: { userId: 1 } });

    expect(quota.assertCanUploadBytes).toHaveBeenCalledWith(1024);
    expect(minioService.uploadFile).toHaveBeenCalled();
  });

  it('rejects upload before object storage writes when storage quota is exceeded', async () => {
    const { controller, quota, minioService } = createController();
    quota.assertCanUploadBytes.mockRejectedValueOnce(new ConflictException('租户存储空间不足'));

    await expect(controller.uploadFile(file, 'users', { user: { userId: 1 } })).rejects.toBeInstanceOf(ConflictException);
    expect(minioService.uploadFile).not.toHaveBeenCalled();
  });

  it('checks the aggregate size before uploading multiple files', async () => {
    const { controller, quota } = createController();

    await controller.uploadFiles([file, { ...file, size: 2048 }], 'users', { user: { userId: 1 } });

    expect(quota.assertCanUploadBytes).toHaveBeenCalledWith(3072);
  });
});
