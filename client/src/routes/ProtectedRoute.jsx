import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Skeleton from '../components/common/Skeleton';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-main p-8">
        <div className="max-w-md w-full card-base p-6 text-center space-y-4">
          <div className="w-10 h-10 rounded-full bg-brand/10 mx-auto flex items-center justify-center animate-pulse">
            <div className="w-5 h-5 rounded-full bg-brand" />
          </div>
          <Skeleton variant="text" className="w-2/3 mx-auto" />
          <Skeleton variant="text" className="w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
