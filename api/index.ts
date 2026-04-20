import { AppModule } from '../src/app.module';
import { VercelServerlessAdapter } from '@vercel/nestjs';

export default VercelServerlessAdapter.create(AppModule, {
  cors: {
    origin: '*',
    credentials: true,
  },
});
