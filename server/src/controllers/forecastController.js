import {
  generateForecastForMedicine,
  getForecastsByMedicine,
  getForecastById
} from '../services/forecastService.js';
import { refreshDailyUsage, getMedicineUsageHistory } from '../services/usageService.js';
import { aiClient } from '../services/aiClient.js';
import { successResponse } from '../utils/apiResponse.js';

export async function generate(req, res, next) {
  try {
    const { medicineId, horizonDays } = req.body;
    const forecast = await generateForecastForMedicine({
      medicineId,
      horizonDays: horizonDays || 15,
      userId: req.user?.id || null
    });
    return successResponse(res, forecast, 201);
  } catch (error) {
    next(error);
  }
}

export async function list(req, res, next) {
  try {
    const { medicineId, page, limit } = req.query;
    const { forecasts, meta } = await getForecastsByMedicine({
      medicineId,
      page: page || 1,
      limit: limit || 20
    });
    return successResponse(res, forecasts, 200, meta);
  } catch (error) {
    next(error);
  }
}

export async function getById(req, res, next) {
  try {
    const forecast = await getForecastById(req.params.id);
    return successResponse(res, forecast);
  } catch (error) {
    next(error);
  }
}

export async function getUsage(req, res, next) {
  try {
    const { medicineId } = req.params;
    const { from, to } = req.query;
    const history = await getMedicineUsageHistory(medicineId, from, to);
    return successResponse(res, history);
  } catch (error) {
    next(error);
  }
}

export async function refreshUsage(req, res, next) {
  try {
    const result = await refreshDailyUsage();
    return successResponse(res, {
      message: 'Daily usage aggregation refreshed successfully from ledger movements.',
      recordsUpdated: result.updatedCount
    });
  } catch (error) {
    next(error);
  }
}

export async function retrain(req, res, next) {
  try {
    const result = await aiClient.train({
      history: req.body?.history || [],
      versionNote: req.body?.versionNote || 'Retrained via Express API'
    });
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function getModelInfo(req, res, next) {
  try {
    const info = await aiClient.getModelInfo();
    return successResponse(res, info);
  } catch (error) {
    next(error);
  }
}

export async function getHealth(req, res, next) {
  try {
    const health = await aiClient.checkHealth();
    return successResponse(res, health);
  } catch (error) {
    next(error);
  }
}
