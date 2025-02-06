import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'pending';
  duration?: number | null;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration !== null) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    pending: 'bg-yellow-500',
  }[type];

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between`}>
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-white hover:text-gray-200 transition-colors"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}