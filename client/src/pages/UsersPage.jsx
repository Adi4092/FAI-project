import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Pagination from '../components/common/Pagination';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { userService } from '../services/userService';
import { useToast } from '../context/ToastContext';
import {
  Plus,
  Users,
  Shield,
  KeyRound,
  UserCheck,
  UserX,
  Trash2,
  Edit2,
  History,
  Filter,
  Search,
  Lock,
  Mail,
  User as UserIcon
} from 'lucide-react';

export default function UsersPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'audit'

  // Users State
  const [users, setUsers] = useState([]);
  const [usersMeta, setUsersMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditMeta, setAuditMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    entityType: '',
    from: '',
    to: ''
  });

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff'
  });
  const [editForm, setEditForm] = useState({ name: '' });
  const [roleForm, setRoleForm] = useState({ role: 'staff' });
  const [resetForm, setResetForm] = useState({ newPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const res = await userService.getUsers({ page, limit: 10 });
      setUsers(res.data || []);
      if (res.meta) setUsersMeta(res.meta);
    } catch (err) {
      setUsersError(err?.response?.data?.error?.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    try {
      setAuditLoading(true);
      setAuditError(null);
      const res = await userService.getAuditLogs({
        page,
        limit: 15,
        action: auditFilters.action || undefined,
        entityType: auditFilters.entityType || undefined,
        from: auditFilters.from || undefined,
        to: auditFilters.to || undefined
      });
      setAuditLogs(res.data || []);
      if (res.meta) setAuditMeta(res.meta);
    } catch (err) {
      setAuditError(err?.response?.data?.error?.message || 'Failed to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers(1);
    } else {
      fetchAuditLogs(1);
    }
  }, [activeTab, fetchUsers, fetchAuditLogs]);

  // Create User
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      showToast('All fields are required', 'error');
      return;
    }
    if (createForm.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await userService.createUser(createForm);
      showToast('User created successfully', 'success');
      setCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'staff' });
      fetchUsers(1);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit User
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await userService.updateUser(selectedUser.id, editForm);
      showToast('User updated successfully', 'success');
      setEditModalOpen(false);
      fetchUsers(usersMeta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to update user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Change Role
  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await userService.updateUserRole(selectedUser.id, roleForm.role);
      showToast('User role updated successfully', 'success');
      setRoleModalOpen(false);
      fetchUsers(usersMeta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to change role', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset Password
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    try {
      setSubmitting(true);
      await userService.resetPassword(selectedUser.id, resetForm.newPassword);
      showToast(`Password reset for ${selectedUser.name}`, 'success');
      setResetModalOpen(false);
      setResetForm({ newPassword: '' });
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to reset password', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (u) => {
    try {
      await userService.updateUserStatus(u.id, !u.isActive);
      showToast(`User ${u.isActive ? 'deactivated' : 'activated'} successfully`, 'success');
      fetchUsers(usersMeta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to update user status', 'error');
    }
  };

  // Delete User
  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Are you sure you want to permanently delete user '${u.name}'?`)) {
      return;
    }
    try {
      await userService.deleteUser(u.id);
      showToast('User deleted successfully', 'success');
      fetchUsers(usersMeta.page);
    } catch (err) {
      showToast(err?.response?.data?.error?.message || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User & Access Management"
        subtitle="Manage system credentials, role-based access permissions, and security audit logs"
      >
        {activeTab === 'users' && (
          <Button
            id="btn-add-user"
            variant="primary"
            icon={Plus}
            onClick={() => setCreateModalOpen(true)}
          >
            + Add User
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b border-border space-x-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'border-b-2 border-brand text-brand bg-blue-50/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Accounts ({usersMeta.total})</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-b-2 border-brand text-brand bg-blue-50/50'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>System Audit Log</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: USER ACCOUNTS
      ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {usersLoading ? (
            <div className="card-base p-6 space-y-4">
              <Skeleton count={5} height={40} />
            </div>
          ) : usersError ? (
            <ErrorState message={usersError} onRetry={() => fetchUsers(usersMeta.page)} />
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description="No user accounts registered in the database."
            />
          ) : (
            <div className="card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Last Login</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px]">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{u.name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              u.role === 'admin'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role === 'inventory_manager'
                                ? 'bg-blue-50 text-brand border-blue-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {u.role.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge status={u.isActive ? 'healthy' : 'critical'}>
                            {u.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setEditForm({ name: u.name });
                                setEditModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-brand hover:bg-slate-100 rounded"
                              title="Edit Name"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setRoleForm({ role: u.role });
                                setRoleModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Change Role"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setResetForm({ newPassword: '' });
                                setResetModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1 rounded ${
                                u.isActive
                                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={u.isActive ? 'Deactivate User' : 'Activate User'}
                            >
                              {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-border">
                <Pagination
                  currentPage={usersMeta.page}
                  totalPages={usersMeta.totalPages}
                  onPageChange={(p) => fetchUsers(p)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: AUDIT LOG
      ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="card-base p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </span>

              <select
                value={auditFilters.entityType}
                onChange={(e) => setAuditFilters({ ...auditFilters, entityType: e.target.value })}
                className="input-base text-xs py-1.5"
              >
                <option value="">All Entity Types</option>
                <option value="User">User</option>
                <option value="Medicine">Medicine</option>
                <option value="Batch">Batch</option>
                <option value="PurchaseOrder">PurchaseOrder</option>
                <option value="StockMovement">StockMovement</option>
                <option value="Setting">Setting</option>
              </select>

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={auditFilters.from}
                  onChange={(e) => setAuditFilters({ ...auditFilters, from: e.target.value })}
                  className="input-base text-xs py-1.5"
                  placeholder="From"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={auditFilters.to}
                  onChange={(e) => setAuditFilters({ ...auditFilters, to: e.target.value })}
                  className="input-base text-xs py-1.5"
                  placeholder="To"
                />
              </div>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Total Log Entries: <strong>{auditMeta.total}</strong>
            </span>
          </div>

          {auditLoading ? (
            <div className="card-base p-6 space-y-4">
              <Skeleton count={6} height={40} />
            </div>
          ) : auditError ? (
            <ErrorState message={auditError} onRetry={() => fetchAuditLogs(auditMeta.page)} />
          ) : auditLogs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No audit logs found"
              description="No audit records match the selected parameters."
            />
          ) : (
            <div className="card-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/70 text-slate-500 font-semibold">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Entity</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                      <th className="py-3 px-4 text-right">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {log.actorId?.name || 'System'}
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {log.actorId?.email}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="font-semibold text-slate-700">{log.entityType}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">{log.reason || 'N/A'}</td>
                        <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-400">
                          {log.ip || '127.0.0.1'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-border">
                <Pagination
                  currentPage={auditMeta.page}
                  totalPages={auditMeta.totalPages}
                  onPageChange={(p) => fetchAuditLogs(p)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          CREATE USER MODAL
      ========================================================================= */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Add New User"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="input-base text-xs py-2 w-full"
                placeholder="e.g., Dr. Jane Wilson"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="input-base text-xs py-2 w-full"
                placeholder="jane@medstock.local"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Temporary Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="input-base text-xs py-2 w-full"
                placeholder="Min 6 characters"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">System Role *</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="input-base text-xs py-2 w-full"
              >
                <option value="staff">Staff (Dispensing & Stock View)</option>
                <option value="inventory_manager">Inventory Manager (Approvals, POs, AI Forecasts)</option>
                <option value="admin">Administrator (Full Access & User Management)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Create User
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          EDIT NAME MODAL
      ========================================================================= */}
      {editModalOpen && selectedUser && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit User: ${selectedUser.name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="input-base text-xs py-2 w-full"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          CHANGE ROLE MODAL
      ========================================================================= */}
      {roleModalOpen && selectedUser && (
        <Modal
          isOpen={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
          title={`Change Role: ${selectedUser.name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleRoleSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Select the new access role for <strong>{selectedUser.name}</strong>. Demoting the last active administrator is strictly protected and will be rejected.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={roleForm.role}
                onChange={(e) => setRoleForm({ role: e.target.value })}
                className="input-base text-xs py-2 w-full"
              >
                <option value="staff">Staff</option>
                <option value="inventory_manager">Inventory Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setRoleModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Update Role
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          RESET PASSWORD MODAL
      ========================================================================= */}
      {resetModalOpen && selectedUser && (
        <Modal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title={`Reset Password: ${selectedUser.name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <p className="text-slate-600">
              Enter a new temporary password for <strong>{selectedUser.email}</strong>.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">New Password (Min 6 chars) *</label>
              <input
                type="password"
                required
                minLength={6}
                value={resetForm.newPassword}
                onChange={(e) => setResetForm({ newPassword: e.target.value })}
                className="input-base text-xs py-2 w-full"
                placeholder="Enter new password"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setResetModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Reset Password
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
