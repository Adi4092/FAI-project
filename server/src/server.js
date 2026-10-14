import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './config/logger.js';

let server;

async function startServer() {
  try {
    await connectDB();

    server = app.listen(env.PORT, () => {
      logger.info(`MedStock Express API running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      logger.info(`CORS configured for origin: ${env.CLIENT_ORIGIN}`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      if (server) {
        server.close(async () => {
          logger.info('HTTP server closed.');
          await disconnectDB();
          process.exit(0);
        });
      } else {
        await disconnectDB();
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
