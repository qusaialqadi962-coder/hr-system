import 'dotenv/config';
import crypto from 'crypto';

const DEV_JWT = 'afaq-dev-secret-change-in-production';
const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (isProduction) {
    throw new Error(
      'JWT_SECRET is required in production (use at least 32 random characters)'
    );
  }
  return DEV_JWT;
}

function resolveDbDriver() {
  const driver = (process.env.DB_DRIVER || 'postgres').toLowerCase();
  if (isProduction && driver === 'json') {
    throw new Error('DB_DRIVER=json is not allowed in production');
  }
  return driver;
}

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 3001,
  jwtSecret: resolveJwtSecret(),
  dbDriver: resolveDbDriver(),
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://afaq:afaq123@localhost:5432/afaq',
  corsOrigin: process.env.CORS_ORIGIN?.trim() || '',
  trustProxy: process.env.TRUST_PROXY === 'true' || isProduction,
  mssql: {
    server: process.env.MSSQL_SERVER || 'localhost',
    database: process.env.MSSQL_DATABASE || 'afaq',
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || 'YourStrong!Passw0rd',
    port: Number(process.env.MSSQL_PORT) || 1433,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_CERT !== 'false',
    },
  },
};

export function generateSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}
