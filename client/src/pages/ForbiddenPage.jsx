import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { ShieldAlert, Home } from 'lucide-react';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main p-6 text-center">
      <div className="max-w-md w-full card-base p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-status-critical/10 text-status-critical flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Your assigned role does not have permission to access this management area. Please contact an administrator if you require elevated privileges.
        </p>
        <div className="pt-2">
          <Button variant="primary" icon={Home} onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
