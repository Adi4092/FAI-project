import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Setting } from '../models/Setting.js';
import { ApiError } from '../utils/ApiError.js';
import { successResponse } from '../utils/apiResponse.js';
import { logAudit } from '../services/auditService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getSettings(req, res, next) {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    return successResponse(res, settings.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }

    const beforeState = settings.toJSON();
    const updatable = [
      'expiryWarningDays',
      'expiryBands',
      'defaultForecastHorizon',
      'serviceLevelZ',
      'targetCoverageDays',
      'minHistoryDaysRandomForest',
      'minHistoryDaysBaseline',
      'riskThresholds',
      'notificationPrefs',
      'currency',
      'aiRetrainMinNewDays'
    ];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();

    await logAudit({
      actorId: req.user.id,
      action: 'SYSTEM_SETTINGS_UPDATE',
      entityType: 'Setting',
      entityId: settings._id,
      beforeState,
      afterState: settings.toJSON(),
      reason: 'Admin updated system settings',
      ip: req.ip
    });

    return successResponse(res, settings.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function getTemplate(req, res, next) {
  try {
    const { name } = req.params;
    const allowed = ['medicines', 'batches', 'daily_usage'];

    if (!allowed.includes(name)) {
      throw ApiError.notFound(`Template '${name}' not found.`);
    }

    const templatePath = path.resolve(__dirname, `../../../../data/templates/${name}.csv`);
    if (!fs.existsSync(templatePath)) {
      throw ApiError.notFound(`Template file for '${name}' does not exist.`);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-template.csv"`);
    fs.createReadStream(templatePath).pipe(res);
  } catch (error) {
    next(error);
  }
}
