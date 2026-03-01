import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "packages/api/prisma/schema.prisma",
  datasource: {
    // Use environment variable with fallback for Docker build time
    // The actual DATABASE_URL will be provided at runtime
    url: env("DATABASE_URL") ?? "postgresql://dummy:dummy@localhost:5432/dummy",
  },
});
