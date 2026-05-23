import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  beforeEach(() => {
    process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5432/platform_template_test';
    process.env.MINIO_SKIP_INIT = 'true';
    process.env.NODE_ENV = 'test';
  });

  it('compiles without undefined module imports', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await moduleRef.close();
  });
});
