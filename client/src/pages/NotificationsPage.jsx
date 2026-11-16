import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { notificationService } from '../services/notificationService';
import { useToast } from '../context/ToastContext';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ArrowRight,
  Filter,
  Check,
  Layers
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'expiring_batch', label: 'Expiring Batch' },
  { value: 'stockout_predicted', label: 'Stockout Predicted' },
  { value: 'po_pending', label: 'PO Pending Approval' },
  { value: 'forecast_ready', label: 'Forecast Ready' },
  { value: 'system', label: 'System Alerts' }
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' }
];

const READ_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'false', label: 'Unread Only' },
  { value: 'true', label: 'Read Only' }
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');

  const fetchNotifications = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await notificationService.getNotifications({
        page,
        limit: 15,
        type: typeFilter || undefined,
        severity: severityFilter || undefined,
        isRead: readFilter !== '' ? readFilter : undefined
      });
      setNotifications(res.data || []);
      if (res.meta) setMeta(res.meta);
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, severityFilter, readFilter]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      showToast('Notification marked as read', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to mark read', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      showToast('All notifications marked as read', 'success');
      fetchNotifications(meta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to mark all read', 'error');
    }
  };

  const handleNavigateEntity = (n) => {
    if (n.relatedEntityType === 'Medicine') {
      navigate('/medicines');
    } else if (n.relatedEntityType === 'Batch') {
      navigate('/inventory');
    } else if (n.relatedEntityType === 'PurchaseOrder') {
      navigate('/purchase-orders');
    }
  };

  const getSeverityIcon = (sev) => {
    if (sev === 'critical') return <AlertCircle className="w-4 h-4 text-status-critical" />;
    if (sev === 'warning') return <AlertTriangle className="w-4 h-4 text-status-warning" />;
    return <Info className="w-4 h-4 text-status-info" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & System Alerts"
        subtitle="Deduplicated real-time notifications for low stock, expiring batches, and purchase orders"
      >
        <Button
          id="btn-mark-all-read"
          variant="secondary"
          icon={CheckCheck}
          onClick={handleMarkAllRead}
        >
          Mark All Read
        </Button>
      </PageHeader>

      {/* Filter Bar */}
      <div className="card-base p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>

          <select
            id="filter-category"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-base text-xs py-1.5"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            id="filter-severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="input-base text-xs py-1.5"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            id="filter-read-status"
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value)}
            className="input-base text-xs py-1.5"
          >
            {READ_STATUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Alerts: <strong>{meta.total}</strong>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="card-base p-6 space-y-4">
          <Skeleton count={6} height={60} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchNotifications(meta.page)} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications found"
          description={
            typeFilter || severityFilter || readFilter
              ? "No alerts match your active filter criteria."
              : "Your inbox is completely clear! All inventory conditions are healthy."
          }
        />
      ) : (
        <div className="card-base divide-y divide-border overflow-hidden">
          {notifications.map((n) => {
            const hasLink = Boolean(n.relatedEntityType);

            return (
              <div
                key={n.id}
                onClick={() => hasLink && handleNavigateEntity(n)}
                className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                  !n.isRead ? 'bg-blue-50/25 hover:bg-blue-50/40' : 'hover:bg-slate-50/70'
                } ${hasLink ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                      n.severity === 'critical'
                        ? 'bg-status-critical/10'
                        : n.severity === 'warning'
                        ? 'bg-status-warning/10'
                        : 'bg-status-info/10'
                    }`}
                  >
                    {getSeverityIcon(n.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">{n.title}</span>
                      <Badge status={n.severity}>{n.severity.toUpperCase()}</Badge>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        {n.type.replace('_', ' ')}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>

                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Just now'}
                      </span>
                      {hasLink && (
                        <span className="text-brand font-semibold flex items-center gap-0.5 hover:underline">
                          View {n.relatedEntityType} <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-2">
                  {!n.isRead ? (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      className="px-2.5 py-1 text-xs font-semibold text-brand hover:text-white hover:bg-brand border border-brand/30 rounded transition-all flex items-center gap-1"
                      title="Mark as Read"
                    >
                      <Check className="w-3 h-3" /> Mark Read
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Read</span>
                  )}
                </div>
              </div>
            );
          })}

          <div className="p-4 border-t border-border">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(p) => fetchNotifications(p)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
