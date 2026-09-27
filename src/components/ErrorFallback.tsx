import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui/basic';
import { cn } from '../utils/cn';

interface ErrorFallbackProps {
  error?: Error;
  onRetry?: () => void;
  message?: string;
  className?: string;
}

export function ErrorFallback({ error, onRetry, message, className }: ErrorFallbackProps) {
  const { t } = useTranslation();
  
  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-text mb-2">
        {message || t('error') || 'Si è verificato un errore'}
      </h3>
      <p className="text-text-muted mb-6 max-w-sm">
        {error?.message || t('tapToRetry') || 'Qualcosa è andato storto. Riprova più tardi.'}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="primary" className="gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('retry') || 'Riprova'}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, message, actionLabel, onAction, className }: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className || ''}`}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 text-text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
      {message && <p className="text-text-muted mb-6 max-w-sm">{message}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction} className="gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ message, className }: { message?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className || ''}`}>
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-text-muted">{message || t('loading') || 'Caricamento...'}</p>
    </div>
  );
}