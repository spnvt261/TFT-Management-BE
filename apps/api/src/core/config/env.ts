import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_HOST: z.string().default("0.0.0.0"),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  DEFAULT_GROUP_CODE: z.string().default("TFT_FRIENDS"),

  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_NAME: z.string().default("tft_history"),
  DB_ADMIN_DATABASE: z.string().default("postgres"),
  DB_SSL: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DB_BOOTSTRAP_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),

  FLYWAY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  FLYWAY_COMMAND: z.string().default("flyway"),
  FLYWAY_LOCATIONS: z.string().optional(),

  JWT_SECRET: z.string().default("tft2-internal-jwt-secret"),
  JWT_EXPIRES_IN: z.string().default("24h")
});

const parsed = envSchema.parse(process.env);

export const env = {
  nodeEnv: parsed.NODE_ENV,
  app: {
    host: parsed.APP_HOST,
    port: parsed.APP_PORT,
    logLevel: parsed.LOG_LEVEL
  },
  defaultGroupCode: parsed.DEFAULT_GROUP_CODE,
  db: {
    host: parsed.DB_HOST,
    port: parsed.DB_PORT,
    user: parsed.DB_USER,
    password: parsed.DB_PASSWORD,
    database: parsed.DB_NAME,
    adminDatabase: parsed.DB_ADMIN_DATABASE,
    ssl: parsed.DB_SSL,
    bootstrapEnabled: parsed.DB_BOOTSTRAP_ENABLED
  },
  flyway: {
    enabled: parsed.FLYWAY_ENABLED,
    command: parsed.FLYWAY_COMMAND,
    locations: parsed.FLYWAY_LOCATIONS
  },
  auth: {
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN
  }
};

export type AppEnv = typeof env;
