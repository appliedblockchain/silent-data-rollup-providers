import { createContext, useContext, useState, ReactNode } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'pending';
  duration?: number | null; // null means no auto-dismiss
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], options?: { duration?: number | null }) => number;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: Toast['type'] = 'info', options?: { duration?: number | null }) => {
    const id = Date.now();
    setToasts(prev => [...prev, { 
      id, 
      message, 
      type,
      duration: options?.duration
    }]);
    return id
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const value = {
    toasts,
    showToast,
    removeToast
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}; 