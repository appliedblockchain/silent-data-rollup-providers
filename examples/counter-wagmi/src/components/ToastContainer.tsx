import { Toast as ToastComponent } from './Toast';
import { useToast, Toast as ToastType } from '../hooks/useToast';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-20 right-4 z-40 space-y-2">
      {toasts.map((toast: ToastType) => (
        <ToastComponent
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
} 