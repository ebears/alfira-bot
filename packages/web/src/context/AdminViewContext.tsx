import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';

interface AdminViewContextValue {
  isAdminView: boolean;
  toggleAdminView: () => void;
}

const AdminViewContext = createContext<AdminViewContextValue | null>(null);

export function AdminViewProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [adminViewOn, setAdminViewOn] = useState(true);

  // isAdminView is only true when the user IS an admin AND the toggle is on.
  // Non-admin users always get false, regardless of the toggle state.
  const isAdminView = (user?.isAdmin ?? false) && adminViewOn;

  const toggleAdminView = () => {
    if (user?.isAdmin) {
      setAdminViewOn((v) => !v);
    }
  };

  return (
    <AdminViewContext.Provider value={{ isAdminView, toggleAdminView }}>
      {children}
    </AdminViewContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminView(): AdminViewContextValue {
  const ctx = useContext(AdminViewContext);
  if (!ctx) throw new Error('useAdminView must be used inside AdminViewProvider');
  return ctx;
}
