import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExpiryRiskPage from '../ExpiryRiskPage';
import { expiryService } from '../../services/expiryService';

vi.mock('../../services/expiryService', () => ({
  expiryService: {
    getExpiryRisk: vi.fn(),
    getBatchRisk: vi.fn()
  }
}));

describe('ExpiryRiskPage — Demand Source and Confidence Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays "No saved forecast; estimated from the last 28 days of average usage" for medicine without saved forecast', async () => {
    expiryService.getExpiryRisk.mockResolvedValue({
      data: {
        summary: { estimatedWastageUnits: 45, estimatedValueAtRisk: 120 },
        batches: [
          {
            batchId: 'batch-no-fc',
            batchNumber: 'B-MED-004-02',
            medicineId: 'med-004',
            medicineName: 'Metformin 500mg',
            medicineCode: 'MED-004',
            unit: 'tablets',
            expiryDate: '2026-10-29',
            daysLeft: 12,
            currentQuantity: 60,
            expectedConsumed: 15,
            expectedLeftover: 45,
            leftoverPct: 75,
            exposureValue: 120,
            riskLevel: 'critical',
            reasons: [
              'Only 12 days of shelf life remain',
              'No saved forecast; estimated from the last 28 days of average usage'
            ],
            suggestedActions: ['Prioritise dispensing this batch'],
            extrapolated: false,
            confidence: 'low',
            confidenceNote: 'No saved forecast; estimated from the last 28 days of average usage',
            hasSavedForecast: false,
            trailingDays: 28
          }
        ]
      }
    });

    render(<ExpiryRiskPage />);

    await waitFor(() => {
      expect(screen.getByText('Metformin 500mg')).toBeInTheDocument();
      expect(screen.getByText('B-MED-004-02')).toBeInTheDocument();
    });

    // Open Why Flagged modal
    const whyFlaggedBtn = screen.getByRole('button', { name: /why flagged\?/i });
    fireEvent.click(whyFlaggedBtn);

    // Verify modal content
    expect(screen.getByText(/Simulation Factual Reasons:/i)).toBeInTheDocument();
    expect(
      screen.getByText('No saved forecast; estimated from the last 28 days of average usage')
    ).toBeInTheDocument();

    const confNote = screen.getByTestId('confidence-note');
    expect(confNote).toHaveTextContent('No saved forecast; estimated from the last 28 days of average usage');
    expect(confNote).not.toHaveTextContent('extrapolated beyond forecast horizon');
  });

  it('displays "Estimate extrapolated beyond forecast horizon — lower confidence" when saved forecast extrapolation is true', async () => {
    expiryService.getExpiryRisk.mockResolvedValue({
      data: {
        summary: { estimatedWastageUnits: 20, estimatedValueAtRisk: 60 },
        batches: [
          {
            batchId: 'batch-fc-extrap',
            batchNumber: 'B-MED-030-02',
            medicineId: 'med-030',
            medicineName: 'Hydrochlorothiazide 25mg',
            medicineCode: 'MED-030',
            unit: 'tablets',
            expiryDate: '2026-11-20',
            daysLeft: 34,
            currentQuantity: 80,
            expectedConsumed: 60,
            expectedLeftover: 20,
            leftoverPct: 25,
            exposureValue: 60,
            riskLevel: 'medium',
            reasons: [
              '34 days of shelf life remain within review horizon',
              'Estimate extrapolated beyond forecast horizon — lower confidence'
            ],
            suggestedActions: ['Monitor dispensing velocity'],
            extrapolated: true,
            confidence: 'low',
            confidenceNote: 'Estimate extrapolated beyond forecast horizon — lower confidence',
            hasSavedForecast: true
          }
        ]
      }
    });

    render(<ExpiryRiskPage />);

    await waitFor(() => {
      expect(screen.getByText('Hydrochlorothiazide 25mg')).toBeInTheDocument();
    });

    const whyFlaggedBtn = screen.getByRole('button', { name: /why flagged\?/i });
    fireEvent.click(whyFlaggedBtn);

    const confNote = screen.getByTestId('confidence-note');
    expect(confNote).toHaveTextContent('Estimate extrapolated beyond forecast horizon — lower confidence');
    expect(confNote).not.toHaveTextContent('No saved forecast');
  });

  it('renders pagination controls for >20 batches, navigates to page 2, and displays accurate counts', async () => {
    // Generate 20 batches for page 1
    const page1Batches = Array.from({ length: 20 }, (_, i) => ({
      batchId: `batch-${i + 1}`,
      batchNumber: `B-TEST-${i + 1}`,
      medicineId: `med-${i + 1}`,
      medicineName: `Medicine ${i + 1}`,
      medicineCode: `MED-${i + 1}`,
      unit: 'tablets',
      expiryDate: '2026-11-15',
      daysLeft: 29,
      currentQuantity: 100,
      expectedConsumed: 40,
      expectedLeftover: 60,
      leftoverPct: 60,
      exposureValue: 150,
      riskLevel: 'high',
      reasons: ['Testing page 1'],
      suggestedActions: ['Prioritise dispensing'],
      extrapolated: false,
      confidence: 'normal'
    }));

    // Generate 2 batches for page 2
    const page2Batches = Array.from({ length: 2 }, (_, i) => ({
      batchId: `batch-${21 + i}`,
      batchNumber: `B-TEST-${21 + i}`,
      medicineId: `med-${21 + i}`,
      medicineName: `Medicine ${21 + i}`,
      medicineCode: `MED-${21 + i}`,
      unit: 'tablets',
      expiryDate: '2026-11-20',
      daysLeft: 34,
      currentQuantity: 80,
      expectedConsumed: 30,
      expectedLeftover: 50,
      leftoverPct: 62.5,
      exposureValue: 125,
      riskLevel: 'high',
      reasons: ['Testing page 2'],
      suggestedActions: ['Prioritise dispensing'],
      extrapolated: false,
      confidence: 'normal'
    }));

    expiryService.getExpiryRisk.mockImplementation(({ page = 1 }) => {
      if (page === 2) {
        return Promise.resolve({
          data: {
            summary: { estimatedWastageUnits: 1300, estimatedValueAtRisk: 3250 },
            batches: page2Batches
          },
          meta: { page: 2, limit: 20, total: 22, totalPages: 2 }
        });
      }
      return Promise.resolve({
        data: {
          summary: { estimatedWastageUnits: 1300, estimatedValueAtRisk: 3250 },
          batches: page1Batches
        },
        meta: { page: 1, limit: 20, total: 22, totalPages: 2 }
      });
    });

    render(<ExpiryRiskPage />);

    // Wait for Page 1 to load
    await waitFor(() => {
      expect(screen.getByText('Medicine 1')).toBeInTheDocument();
      expect(screen.getByText('B-TEST-1')).toBeInTheDocument();
    });

    // Check footer on Page 1
    const countEl = screen.getByTestId('pagination-count');
    expect(countEl).toHaveTextContent('Showing 1-20 of 22 batches');

    // Page 2 button should be present
    const page2Btn = screen.getByRole('button', { name: '2' });
    expect(page2Btn).toBeInTheDocument();

    // Click Page 2
    fireEvent.click(page2Btn);

    // Wait for Page 2 content
    await waitFor(() => {
      expect(screen.getByText('Medicine 21')).toBeInTheDocument();
      expect(screen.getByText('B-TEST-21')).toBeInTheDocument();
    });

    // Verify footer on Page 2
    expect(screen.getByTestId('pagination-count')).toHaveTextContent('Showing 21-22 of 22 batches');

    // Changing window resets to page 1
    const btn60d = screen.getByRole('button', { name: '60 Days' });
    fireEvent.click(btn60d);

    await waitFor(() => {
      expect(expiryService.getExpiryRisk).toHaveBeenLastCalledWith(
        expect.objectContaining({ windowDays: 60, page: 1 })
      );
    });
  });
});
