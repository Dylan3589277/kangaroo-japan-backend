import { registerAs } from "@nestjs/config";

function parseDatabaseUrl(url: string | undefined): {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
} {
  if (!url) {
    return {
      host: process.env.DATABASE_HOST || "localhost",
      port: parseInt(process.env.DATABASE_PORT || "5432", 10),
      username: process.env.DATABASE_USER || "kangaroo",
      password: process.env.DATABASE_PASSWORD || "kangaroo_dev_password",
      database: process.env.DATABASE_NAME || "kangaroo_japan",
    };
  }
  
  // Parse postgresql://user:password@host:port/database
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (match) {
    return {
      host: match[3],
      port: parseInt(match[4], 10),
      username: match[1],
      password: match[2],
      database: match[5],
    };
  }
  
  return {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    username: process.env.DATABASE_USER || "kangaroo",
    password: process.env.DATABASE_PASSWORD || "kangaroo_dev_password",
    database: process.env.DATABASE_NAME || "kangaroo_japan",
  };
}

export const databaseConfig = registerAs("database", () => {
  const db = parseDatabaseUrl(process.env.DATABASE_URL);
  
  return {
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    synchronize: process.env.DATABASE_SYNC === "true",
    logging: process.env.NODE_ENV === "development",
    migrationsRun: process.env.DATABASE_MIGRATIONS_RUN === "true",
    migrations: [__dirname + "/../database/migrations/*{.ts,.js}"],
    migrationsTableName: "typeorm_migrations",
  };
});
