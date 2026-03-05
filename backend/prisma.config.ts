import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  datasource: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL,
  },
});
