import { Forecast } from '../models/Forecast.js';
import { Medicine } from '../models/Medicine.js';
import { aiClient } from './aiClient.js';
import { refreshDailyUsage, getMedicineUsageHistory } from './usageService.js';
import { createNotification } from './notificationService.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';

export async function generateForecastForMedicine({ medicineId, horizonDays = 15, userId = null }) {
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    throw ApiError.notFound('Medicine not found.');
  }

  const validHorizons = [7, 15, 30];
  if (!validHorizons.includes(Number(horizonDays))) {
    throw ApiError.badRequest('Horizon must be 7, 15, or 30 days.');
  }

  // 1. Automatically refresh daily usage from ledger up to yesterday
  await refreshDailyUsage(medicineId);

  // 2. Load usage history for the medicine
  const history = await getMedicineUsageHistory(medicineId);

  // 2. Call FastAPI AI service
  const aiPayload = {
    medicineId: medicine.medicineCode,
    horizonDays: Number(horizonDays),
    history: history.map((h) => ({
      date: h.date,
      unitsDispensed: Number(h.unitsDispensed),
      stockoutObserved: Boolean(h.stockoutObserved)
    })),
    modelPreference: 'auto'
  };

  const aiResult = await aiClient.forecast(aiPayload);

  if (!aiResult || !aiResult.forecast) {
    throw ApiError.internal('Invalid response from AI forecasting service.');
  }

  // 3. Save Forecast record
  const forecastStartDate = aiResult.forecast[0]?.date || new Date().toISOString().split('T')[0];
  const forecastEndDate = aiResult.forecast[aiResult.forecast.length - 1]?.date || '';

  const forecastDoc = await Forecast.create({
    medicineId: medicine._id,
    generatedAt: new Date(),
    generatedBy: userId,
    forecastStartDate,
    forecastEndDate,
    horizonDays: Number(horizonDays),
    modelName: aiResult.modelName,
    modelVersion: aiResult.modelVersion,
    predictedDailyDemand: aiResult.forecast.map((f) => ({
      date: f.date,
      predicted: f.predicted
    })),
    predictedTotalDemand: aiResult.totalPredicted,
    evaluationMetrics: {
      mae: aiResult.metrics?.mae ?? null,
      rmse: aiResult.metrics?.rmse ?? null,
      wape: aiResult.metrics?.wape ?? null,
      baselineMae: aiResult.metrics?.baselineMae ?? null,
      baselineRmse: aiResult.metrics?.baselineRmse ?? null,
      baselineWape: aiResult.metrics?.baselineWape ?? null,
      holdoutDays: aiResult.metrics?.holdoutDays ?? 0
    },
    dataWindow: aiResult.dataWindow || { from: null, to: null, days: 0, maskedDays: 0 },
    provisional: Boolean(aiResult.provisional),
    warnings: aiResult.warnings || [],
    status: 'completed'
  });

  // 4. Create "forecast ready" notification
  await createNotification({
    type: 'forecast_ready',
    severity: 'info',
    title: `Forecast Ready: ${medicine.name}`,
    message: `Generated ${horizonDays}-day demand forecast using ${aiResult.modelName} (${aiResult.modelVersion}).`,
    relatedEntityType: 'Forecast',
    relatedEntityId: forecastDoc._id,
    dedupeKey: `FORECAST_READY:${medicine._id}`
  });

  return forecastDoc;
}

export async function getForecastsByMedicine({ medicineId, page = 1, limit = 20 } = {}) {
  const query = medicineId ? { medicineId } : {};
  const skip = (Math.max(1, page) - 1) * limit;

  const [forecasts, total] = await Promise.all([
    Forecast.find(query).sort({ generatedAt: -1 }).skip(skip).limit(limit).populate('medicineId', 'name medicineCode unit'),
    Forecast.countDocuments(query)
  ]);

  return {
    forecasts,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

export async function getForecastById(id) {
  const forecast = await Forecast.findById(id).populate('medicineId', 'name medicineCode unit');
  if (!forecast) {
    throw ApiError.notFound('Forecast not found.');
  }
  return forecast;
}

export async function getLatestForecastForMedicine(medicineId) {
  return await Forecast.findOne({ medicineId, status: 'completed' }).sort({ generatedAt: -1 });
}
