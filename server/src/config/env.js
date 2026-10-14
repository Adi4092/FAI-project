import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medstock',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'medstock-access-secret-key-development-minimum-32-chars',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'medstock-refresh-secret-key-development-minimum-32-chars',
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '15m',
  REFRESH_TOKEN_TTL_DAYS: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  AI_SERVICE_TIMEOUT_MS: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '30000', 10),
  BCRYPT_COST: parseInt(process.env.BCRYPT_COST || '12', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
};
