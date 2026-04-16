import { registerAs } from "@nestjs/config";

export const databaseConfig = registerAs("database", () => ({
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "kangaroo",
  password: process.env.DATABASE_PASSWORD || "kangaroo_dev_password",
  database: process.env.DATABASE_NAME || "kangaroo_japan",
  synchronize: process.env.DATABASE_SYNC === "true",
  logging: process.env.NODE_ENV === "development",
  migrationsRun: process.env.DATABASE_MIGRATIONS_RUN === "true",
  migrations: [__dirname + "/../database/migrations/*{.ts,.js}"],
  migrationsTableName: "typeorm_migrations",
}));
