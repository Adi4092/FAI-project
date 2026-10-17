import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

/**
 * Normalizes and executes requests to the FastAPI AI service using native Node fetch.
 * Returns 503 AI_SERVICE_UNAVAILABLE with user-friendly message and zero stack traces
 * if the AI service is down or unreachable.
 */
async function callAiService(endpoint, options = {}) {
  const url = `${env.AI_SERVICE_URL.replace(/\/+$/, '')}${endpoint}`;
  const timeoutMs = env.AI_SERVICE_TIMEOUT_MS || 30000;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const detail = errData?.detail;

      if (typeof detail === 'object' && detail !== null) {
        throw new ApiError(
          response.status,
          detail.code || 'AI_SERVICE_ERROR',
          detail.message || 'AI service error',
          detail.details || []
        );
      }

      if (typeof detail === 'string') {
        throw new ApiError(response.status, 'AI_SERVICE_ERROR', detail);
      }

      throw new ApiError(
        response.status,
        'AI_SERVICE_ERROR',
        `The AI service returned status: ${response.status}`
      );
    }

    return await response.json();
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }

    logger.error(`[aiClient] Connection error calling ${endpoint}:`, err.message || err);

    // Network failure, connection refused, or timeout
    throw ApiError.serviceUnavailable(
      'The AI forecasting service is currently offline or unreachable. Please ensure the AI service is running on port 8000.',
      'AI_SERVICE_UNAVAILABLE'
    );
  }
}

export const aiClient = {
  /**
   * Health check
   */
  async checkHealth() {
    return await callAiService('/health', { method: 'GET' });
  },

  /**
   * Model metadata
   */
  async getModelInfo() {
    return await callAiService('/model-info', { method: 'GET' });
  },

  /**
   * Generates demand forecast
   */
  async forecast(payload) {
    return await callAiService('/forecast', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Chronological evaluation
   */
  async evaluate(payload) {
    return await callAiService('/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Explicit model retraining
   */
  async train(payload) {
    return await callAiService('/train', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Expiry risk simulation
   */
  async simulateExpiryRisk(payload) {
    return await callAiService('/expiry-risk', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
