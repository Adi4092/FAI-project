import * as reportService from '../services/reportService.js';
import { successResponse } from '../utils/apiResponse.js';

function sendReport(res, report, fileName) {
  if (res.req.query.format === 'csv') {
    const csv = reportService.jsonToCsv(report.headers, report.tableData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    return res.status(200).send(csv);
  }
  return successResponse(res, report);
}

export async function getConsumptionReport(req, res, next) {
  try {
    const report = await reportService.getConsumptionReport(req.query);
    return sendReport(res, report, 'consumption-trends');
  } catch (error) {
    next(error);
  }
}

export async function getStockMovementsReport(req, res, next) {
  try {
    const report = await reportService.getStockMovementsReport(req.query);
    return sendReport(res, report, 'stock-movements-summary');
  } catch (error) {
    next(error);
  }
}

export async function getWastageReport(req, res, next) {
  try {
    const report = await reportService.getWastageReport(req.query);
    return sendReport(res, report, 'realized-wastage');
  } catch (error) {
    next(error);
  }
}

export async function getExpiryExposureReport(req, res, next) {
  try {
    const report = await reportService.getExpiryExposureReport(req.query);
    return sendReport(res, report, 'projected-expiry-exposure');
  } catch (error) {
    next(error);
  }
}

export async function getStockoutsReport(req, res, next) {
  try {
    const report = await reportService.getStockoutsReport(req.query);
    return sendReport(res, report, 'stockout-incidents');
  } catch (error) {
    next(error);
  }
}

export async function getPurchasesReport(req, res, next) {
  try {
    const report = await reportService.getPurchasesReport(req.query);
    return sendReport(res, report, 'purchase-history');
  } catch (error) {
    next(error);
  }
}

export async function getValuationReport(req, res, next) {
  try {
    const report = await reportService.getValuationReport(req.query);
    return sendReport(res, report, 'stock-valuation');
  } catch (error) {
    next(error);
  }
}

export async function getForecastPerformanceReport(req, res, next) {
  try {
    const report = await reportService.getForecastPerformanceReport(req.query);
    return sendReport(res, report, 'forecast-performance');
  } catch (error) {
    next(error);
  }
}

export async function getReordersReport(req, res, next) {
  try {
    const report = await reportService.getReordersReport(req.query);
    return sendReport(res, report, 'reorder-recommendations');
  } catch (error) {
    next(error);
  }
}
