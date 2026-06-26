import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'afaq-dev-secret-change-in-production',
  dbDriver: (process.env.DB_DRIVER || 'postgres').toLowerCase(),
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://afaq:afaq123@localhost:5432/afaq',
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
