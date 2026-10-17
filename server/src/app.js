import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

import authRoutes from './routes/authRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import stockMovementRoutes from './routes/stockMovementRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import userRoutes from './routes/userRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import forecastRoutes from './routes/forecastRoutes.js';
import expiryRoutes from './routes/expiryRoutes.js';
import stockoutRoutes from './routes/stockoutRoutes.js';
import reorderRoutes from './routes/reorderRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const app = express();

// Security headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-skip-csrf']
  })
);

// Logging
if (!env.isTest) {
  app.use(morgan('dev'));
}

// Body and cookie parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global Rate Limiter
app.use(globalLimiter);

// Double-submit CSRF Protection
app.use(csrfProtection);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/expiry-risk', expiryRoutes);
app.use('/api/stockout-predictions', stockoutRoutes);
app.use('/api/reorders', reorderRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'medstock-express-api' });
});

// 404 and Error Handling
app.use(notFound);
app.use(errorHandler);

export default app;
