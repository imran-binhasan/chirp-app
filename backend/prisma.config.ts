// A config file switches off Prisma's implicit .env loading, and the CLI still
// needs DATABASE_URL — hence the explicit import.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
