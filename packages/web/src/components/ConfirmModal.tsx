import { Backdrop } from './Backdrop';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Backdrop onClose={onCancel}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">{title}</h2>
        <p className="font-body text-sm text-muted mb-4 md:mb-6">{message}</p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-danger border-danger/50" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}
