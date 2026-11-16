import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import AppLayout from '../components/layout/AppLayout';

// Pages
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import MedicinesPage from '../pages/MedicinesPage';
import InventoryPage from '../pages/InventoryPage';
import ExpiryRiskPage from '../pages/ExpiryRiskPage';
import ForecastingPage from '../pages/ForecastingPage';
import StockoutPage from '../pages/StockoutPage';
import ReordersPage from '../pages/ReordersPage';
import StockMovementsPage from '../pages/StockMovementsPage';
import SuppliersPage from '../pages/SuppliersPage';
import PurchaseOrdersPage from '../pages/PurchaseOrdersPage';
import ReportsPage from '../pages/ReportsPage';
import NotificationsPage from '../pages/NotificationsPage';
import UsersPage from '../pages/UsersPage';
import SettingsPage from '../pages/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';
import ForbiddenPage from '../pages/ForbiddenPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      {/* Protected routes wrapped in AppLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="medicines" element={<MedicinesPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="expiry-risk" element={<ExpiryRiskPage />} />
        <Route path="stockout-predictions" element={<StockoutPage />} />
        <Route path="stock-movements" element={<StockMovementsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />

        {/* Admin and Inventory Manager routes */}
        <Route
          path="forecasting"
          element={
            <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
              <ForecastingPage />
            </RoleRoute>
          }
        />
        <Route
          path="reorders"
          element={
            <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
              <ReordersPage />
            </RoleRoute>
          }
        />
        <Route
          path="suppliers"
          element={
            <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
              <SuppliersPage />
            </RoleRoute>
          }
        />
        <Route
          path="purchase-orders"
          element={
            <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
              <PurchaseOrdersPage />
            </RoleRoute>
          }
        />
        <Route
          path="reports"
          element={
            <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
              <ReportsPage />
            </RoleRoute>
          }
        />

        {/* Admin and Manager for Settings (Manager can access Data Import tab) */}
        <Route
          path="settings"
          element={
            <RoleRoute allowedRoles={['admin', 'inventory_manager']}>
              <SettingsPage />
            </RoleRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="users"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <UsersPage />
            </RoleRoute>
          }
        />
      </Route>

      {/* Catch-all 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
