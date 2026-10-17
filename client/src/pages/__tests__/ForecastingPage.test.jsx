import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ForecastingPage from '../ForecastingPage';
import { medicineService } from '../../services/medicineService';
import { forecastService } from '../../services/forecastService';

// Mock Recharts for jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />
}));

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin' } })
}));

// Mock services
vi.mock('../../services/medicineService', () => ({
  medicineService: {
    getMedicines: vi.fn()
  }
}));

vi.mock('../../services/forecastService', () => ({
  forecastService: {
    getForecasts: vi.fn(),
    getUsageHistory: vi.fn(),
    generateForecast: vi.fn(),
    refreshUsage: vi.fn(),
    retrainModel: vi.fn()
  }
}));

describe('ForecastingPage — Forecast History and Navigation', () => {
  const mockMedicines = [
    { _id: 'med-001', id: 'med-001', medicineCode: 'MED-001', name: 'Amoxicillin 500mg', unit: 'capsules' },
    { _id: 'med-002', id: 'med-002', medicineCode: 'MED-002', name: 'Paracetamol 650mg', unit: 'tablets' }
  ];

  const mockUsage = [
    { date: '2026-10-01', unitsDispensed: 12, stockoutObserved: false },
    { date: '2026-10-02', unitsDispensed: 15, stockoutObserved: false }
  ];

  const latestForecast = {
    _id: 'fc-latest-123',
    medicineId: 'med-001',
    generatedAt: '2026-10-15T10:00:00.000Z',
    forecastStartDate: '2026-10-15',
    forecastEndDate: '2026-10-30',
    horizonDays: 15,
    modelName: 'random_forest',
    modelVersion: 'rf-2026.10.1',
    predictedTotalDemand: 180,
    provisional: false,
    predictedDailyDemand: [
      { date: '2026-10-15', predicted: 12 },
      { date: '2026-10-16', predicted: 12 }
    ],
    evaluationMetrics: { mae: 1.2, rmse: 1.8, wape: 0.08, holdoutDays: 15 },
    dataWindow: { from: '2026-07-01', to: '2026-10-14', days: 105, maskedDays: 2 },
    warnings: []
  };

  const savedForecast = {
    _id: 'fc-saved-456',
    medicineId: 'med-001',
    generatedAt: '2026-10-01T08:30:00.000Z',
    forecastStartDate: '2026-10-01',
    forecastEndDate: '2026-10-08',
    horizonDays: 7,
    modelName: 'moving_average_baseline',
    modelVersion: 'baseline-7d',
    predictedTotalDemand: 70,
    provisional: true,
    predictedDailyDemand: [
      { date: '2026-10-01', predicted: 10 },
      { date: '2026-10-02', predicted: 10 }
    ],
    evaluationMetrics: { mae: 2.5, rmse: 3.1, wape: 0.15, holdoutDays: 7 },
    dataWindow: { from: '2026-07-01', to: '2026-09-30', days: 91, maskedDays: 0 },
    warnings: ['Provisional baseline used']
  };

  beforeEach(() => {
    vi.clearAllMocks();
    medicineService.getMedicines.mockResolvedValue({ data: mockMedicines });
    forecastService.getUsageHistory.mockResolvedValue({ data: mockUsage });
  });

  it('renders Forecast History table with newest first, fields, and Provisional badge', async () => {
    forecastService.getForecasts.mockResolvedValue({ data: [latestForecast, savedForecast] });

    render(<ForecastingPage />);

    // Wait for history table to render
    const historyTable = await screen.findByTestId('forecast-history-table');
    expect(historyTable).toBeInTheDocument();

    // Check rows exist
    expect(screen.getByTestId('forecast-history-row-fc-latest-123')).toBeInTheDocument();
    expect(screen.getByTestId('forecast-history-row-fc-saved-456')).toBeInTheDocument();

    // Check fields for newest row
    expect(screen.getByText('15 days')).toBeInTheDocument();
    expect(screen.getAllByText('180 capsules').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2026-10-15 → 2026-10-30')).toBeInTheDocument();
    expect(screen.getByText('Full Model')).toBeInTheDocument();

    // Check fields for saved provisional row
    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('70 capsules')).toBeInTheDocument();
    expect(screen.getByText('2026-10-01 → 2026-10-08')).toBeInTheDocument();
    expect(screen.getByText('Provisional')).toBeInTheDocument();

    // Latest row should be highlighted by default
    const latestRow = screen.getByTestId('forecast-history-row-fc-latest-123');
    expect(latestRow.className).toContain('border-l-brand');
  });

  it('clicking a saved forecast row switches view, updates demand & metrics, shows saved banner, and returns via Back to latest', async () => {
    forecastService.getForecasts.mockResolvedValue({ data: [latestForecast, savedForecast] });

    render(<ForecastingPage />);

    await screen.findByTestId('forecast-history-table');

    // Initially, latest forecast is active (180 capsules)
    expect(screen.getAllByText('180 capsules').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('viewing-saved-banner')).not.toBeInTheDocument();

    // Click the older saved forecast row
    const savedRow = screen.getByTestId('forecast-history-row-fc-saved-456');
    fireEvent.click(savedRow);

    // Saved banner should appear with "Viewing saved forecast from"
    const banner = await screen.findByTestId('viewing-saved-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Viewing saved forecast from');

    // Saved row is now highlighted
    expect(savedRow.className).toContain('border-l-brand');

    // The active demand display now shows saved forecast's demand (70 capsules) in top card and history table
    expect(screen.getAllByText('70 capsules').length).toBe(2);
    expect(screen.getByText('Provisional Baseline')).toBeInTheDocument();

    // AI service was NOT called again to load saved forecast
    expect(forecastService.generateForecast).not.toHaveBeenCalled();

    // Click "Back to latest" button
    const backBtn = screen.getByTestId('back-to-latest-button');
    fireEvent.click(backBtn);

    // Banner disappears and latest forecast (180 capsules) is restored
    expect(screen.queryByTestId('viewing-saved-banner')).not.toBeInTheDocument();
    const latestRow = screen.getByTestId('forecast-history-row-fc-latest-123');
    expect(latestRow.className).toContain('border-l-brand');
  });

  it('displays empty state when no saved forecasts exist for medicine', async () => {
    forecastService.getForecasts.mockResolvedValue({ data: [] });

    render(<ForecastingPage />);

    const emptyMsg = await screen.findByTestId('forecast-history-empty');
    expect(emptyMsg).toBeInTheDocument();
    expect(emptyMsg.textContent).toBe('No saved forecasts for this medicine yet');
  });

  it('displays error state with retry button when forecast history fetch fails', async () => {
    forecastService.getForecasts.mockRejectedValue(new Error('Network connection timeout'));

    render(<ForecastingPage />);

    const errorContainer = await screen.findByTestId('forecast-history-error');
    expect(errorContainer).toBeInTheDocument();
    expect(errorContainer.textContent).toContain('Network connection timeout');

    // Clicking retry attempts fetch again
    forecastService.getForecasts.mockResolvedValue({ data: [latestForecast] });
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    const table = await screen.findByTestId('forecast-history-table');
    expect(table).toBeInTheDocument();
  });

  it('refreshes history list when generate new forecast succeeds', async () => {
    forecastService.getForecasts.mockResolvedValueOnce({ data: [savedForecast] });

    render(<ForecastingPage />);
    await screen.findByTestId('forecast-history-table');

    // Mock generate API response and subsequent history refresh
    forecastService.generateForecast.mockResolvedValue({ data: latestForecast });
    forecastService.getForecasts.mockResolvedValueOnce({ data: [latestForecast, savedForecast] });

    const genBtn = screen.getByRole('button', { name: /generate forecast/i });
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(forecastService.generateForecast).toHaveBeenCalledWith('med-001', 15);
      // History was refreshed
      expect(forecastService.getForecasts).toHaveBeenCalledTimes(2);
    });

    // Newest is now active and highlighted
    const latestRow = await screen.findByTestId('forecast-history-row-fc-latest-123');
    expect(latestRow.className).toContain('border-l-brand');
  });

  it('shows clear warning when last history date is more than 1 day before generation date and marks past forecast dates', async () => {
    // Forecast generated 2026-10-17 with history ending 2026-10-13 (Hydrochlorothiazide scenario)
    const hydrochlorothiazideForecast = {
      _id: 'fc-hctz-789',
      medicineId: 'med-001',
      generatedAt: '2026-10-17T08:00:00.000Z',
      forecastStartDate: '2026-10-14',
      forecastEndDate: '2026-10-28',
      horizonDays: 15,
      modelName: 'random_forest',
      modelVersion: 'rf-2026.10.1',
      predictedTotalDemand: 150,
      provisional: false,
      predictedDailyDemand: [
        { date: '2026-10-14', predicted: 10 },
        { date: '2026-10-15', predicted: 10 },
        { date: '2026-10-16', predicted: 10 },
        { date: '2026-10-17', predicted: 10 },
        { date: '2026-10-18', predicted: 10 }
      ],
      evaluationMetrics: { mae: 1.2, rmse: 1.8, wape: 0.08, holdoutDays: 15 },
      dataWindow: { from: '2025-10-14', to: '2026-10-13', days: 365, maskedDays: 0 },
      warnings: []
    };

    forecastService.getForecasts.mockResolvedValue({ data: [hydrochlorothiazideForecast] });

    render(<ForecastingPage />);

    // Warning alert should appear
    const alert = await screen.findByTestId('stale-history-warning');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain('Usage data ends on 2026-10-13; the first 3 forecast days are already in the past.');

    // Past date rows should carry the "Past" badge
    const pastBadges = await screen.findAllByTestId('past-forecast-badge');
    expect(pastBadges.length).toBeGreaterThanOrEqual(3);
  });
});
