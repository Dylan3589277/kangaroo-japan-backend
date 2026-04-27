import { registerAs } from "@nestjs/config";

function parseDatabaseUrl(url: string | undefined): {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean | { rejectUnauthorized: boolean } | undefined;
} {
  if (!url) {
    return {
      host: process.env.DATABASE_HOST || "localhost",
      port: parseInt(process.env.DATABASE_PORT || "5432", 10),
      username: process.env.DATABASE_USER || "kangaroo",
      password: process.env.DATABASE_PASSWORD || "kangaroo_dev_password",
      database: process.env.DATABASE_NAME || "kangaroo_japan",
      ssl: undefined,
    };
  }
  
  // 检测是否需要 SSL
  const needsSsl = url.includes("sslmode=") || url.includes("ssl=");
  const sslMode = url.match(/sslmode=([^&\s]+)/)?.[1] || "prefer";
  
  // Parse postgresql://user:***@host:port/database (with optional query params)
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (match) {
    let sslConfig: boolean | { rejectUnauthorized: boolean } | undefined = undefined;
    if (needsSsl) {
      sslConfig = (sslMode === "require" || sslMode === "verify-full")
        ? { rejectUnauthorized: false }
        : true;
    }
    return {
      host: match[3],
      port: parseInt(match[4], 10),
      username: match[1],
      password: match[2],
      database: match[5],
      ssl: sslConfig,
    };
  }
  
  return {
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    username: process.env.DATABASE_USER || "kangaroo",
    password: process.env.DATABASE_PASSWORD || "kangaroo_dev_password",
    database: process.env.DATABASE_NAME || "kangaroo_japan",
    ssl: undefined,
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
    ssl: db.ssl,
    synchronize: process.env.DATABASE_SYNC === "true",
    logging: process.env.NODE_ENV === "development",
    migrationsRun: process.env.DATABASE_MIGRATIONS_RUN === "true",
    migrations: [__dirname + "/../database/migrations/*{.ts,.js}"],
    migrationsTableName: "typeorm_migrations",
  };
});
