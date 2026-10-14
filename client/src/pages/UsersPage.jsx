import React from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Plus, Users, Shield } from 'lucide-react';

const mockUsers = [
  { id: '1', name: 'System Administrator', email: 'admin@medstock.local', role: 'admin', status: 'Active', lastLogin: 'Today, 01:15 AM' },
  { id: '2', name: 'Dr. Sarah Smith', email: 'manager@medstock.local', role: 'inventory_manager', status: 'Active', lastLogin: 'Yesterday, 04:30 PM' },
  { id: '3', name: 'Riya Staff', email: 'staff@medstock.local', role: 'staff', status: 'Active', lastLogin: '2 days ago' },
];

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User & Role Management"
        subtitle="Manage access credentials, role permissions (RBAC), and authentication audit logs"
      >
        <Button variant="primary" icon={Plus}>
          + Add User
        </Button>
      </PageHeader>

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600">{u.email}</td>
                  <td className="py-3 px-4 capitalize">
                    <span className="font-semibold text-brand">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge status="healthy">{u.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{u.lastLogin}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-xs text-brand hover:underline font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
