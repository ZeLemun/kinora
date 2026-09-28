import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

type ToastKind = 'default' | 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'default') => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, kind }]);
      setTimeout(() => dismiss(id), 2600);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-20 right-4 z-[120] flex flex-col items-end gap-2 sm:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={cn(
              'toast-in pointer-events-auto flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md',
              t.kind === 'success' && 'bg-[color-mix(in_srgb,var(--color-success)_22%,var(--color-elevated))] text-[var(--color-success)]',
              t.kind === 'error' && 'bg-[color-mix(in_srgb,var(--color-danger)_22%,var(--color-elevated))] text-[var(--color-danger)]',
              t.kind === 'default' && 'bg-elevated/95 text-text'
            )}
          >
            {t.kind === 'success' && <CheckIcon />}
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Safe to call outside the provider (e.g. in isolated tests).
  return ctx ?? { toast: () => undefined };
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `sm` for dialogs, `lg` for the settings sheet. */
  size?: 'sm' | 'lg';
  labelledBy?: string;
}

export function Modal({ open, onClose, title, children, footer, size = 'sm' }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog for keyboard and screen-reader users.
    const id = requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(id);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'pop-in relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl',
          size === 'sm' ? 'max-w-md' : 'max-w-2xl max-h-[85dvh] overflow-y-auto'
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text"
              aria-label="Close"
            >
              <XIcon />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary px-4 py-2 text-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="btn btn-primary px-4 py-2 text-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">{message}</p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Context menu                                                       */
/* ------------------------------------------------------------------ */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  dividerBefore?: boolean;
}

export function ContextMenu({
  open,
  anchorRef,
  items,
  onClose,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  items: MenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Defer so the click that opened the menu does not immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', onDoc));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      role="menu"
      className="pop-in absolute right-0 top-full z-50 mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-2xl"
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.dividerBefore && <div className="my-1 h-px bg-line" />}
          <button
            role="menuitem"
            className={cn(
              'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-elevated',
              item.tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-text'
            )}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonCard({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn('rail-item', wide ? 'w-64' : 'w-32 sm:w-36')}>
      <Skeleton className={cn('w-full', wide ? 'aspect-video' : 'aspect-[2/3]')} />
      <Skeleton className="mt-2.5 h-3 w-4/5" />
      <Skeleton className="mt-1.5 h-2.5 w-1/2" />
    </div>
  );
}

export function SkeletonRow({ count = 8, wide = false }: { count?: number; wide?: boolean }) {
  return (
    <section>
      <Skeleton className="mb-3 h-5 w-40" />
      <div className="rail rail-bleed">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} wide={wide} />
        ))}
      </div>
    </section>
  );
}

export function SkeletonDetail() {
  return (
    <div className="p-4 sm:p-6">
      <Skeleton className="h-[38dvh] w-full" />
      <div className="-mt-24 flex gap-5 px-2">
        <Skeleton className="aspect-[2/3] w-28 flex-none sm:w-40" />
        <div className="flex-1 space-y-3 pt-16">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-text-muted">
        {icon ?? <EmptyGlyph />}
      </div>
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-text-muted">{message}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary mt-6 px-5 py-2.5 text-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function EmptyGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 9h20" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
