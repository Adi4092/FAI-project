import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Bell, CheckCheck, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

const mockNotifications = [
  { id: '1', title: 'Batch Expiring Soon', msg: 'Amoxicillin batch B002 expires in 3 days (50 units remaining).', severity: 'critical', time: '10 mins ago', isRead: false },
  { id: '2', title: 'Critical Low Stock', msg: 'Metformin 500mg has fallen below safety stock threshold (10 units).', severity: 'critical', time: '1 hour ago', isRead: false },
  { id: '3', title: 'Reorder Point Reached', msg: 'Paracetamol 500mg is below reorder level (15 units remaining).', severity: 'warning', time: '3 hours ago', isRead: false },
  { id: '4', title: 'Forecast Ready', msg: 'Random Forest demand forecast generated for Ciprofloxacin 500mg.', severity: 'info', time: 'Yesterday', isRead: true },
];

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications & System Alerts"
        subtitle="Deduplicated real-time notifications for low stock, expiring batches, and AI forecasts"
      >
        <Button variant="secondary" icon={CheckCheck}>
          Mark All Read
        </Button>
      </PageHeader>

      <div className="card-base divide-y divide-border overflow-hidden">
        {mockNotifications.map((n) => (
          <div key={n.id} className={`p-4 flex items-start justify-between gap-4 transition-colors ${
            !n.isRead ? 'bg-blue-50/20' : 'hover:bg-slate-50/70'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
                n.severity === 'critical' ? 'bg-status-critical/10 text-status-critical' : 'bg-status-warning/10 text-status-warning'
              }`}>
                {n.severity === 'critical' ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{n.title}</span>
                  <Badge status={n.severity}>{n.severity}</Badge>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand" />}
                </div>
                <p className="text-xs text-slate-600 mt-1">{n.msg}</p>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {n.time}
                </div>
              </div>
            </div>

            <button className="text-xs text-brand hover:underline font-medium flex-shrink-0">
              {n.isRead ? 'Archived' : 'Mark Read'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
