import { useState } from 'react';
import type { AddonConfig } from '../addon-types';

interface AddonConfigFormProps {
  transportUrl: string;
  fields: AddonConfig[];
  initial: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
}

/**
 * Renders an add-on's `/configure` manifest as a form. This is what unlocks
 * debrid-backed add-ons, which are the only streams that play without a
 * torrent engine.
 */
export function AddonConfigForm({
  fields,
  initial,
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
}: AddonConfigFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const seeded: Record<string, unknown> = {};
    for (const f of fields) {
      const existing = initial[f.key];
      if (existing !== undefined) seeded[f.key] = existing;
      else if (f.default !== undefined) seeded[f.key] = f.default;
      else if (f.type === 'checkbox') seeded[f.key] = false;
      else seeded[f.key] = '';
    }
    return seeded;
  });

  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      className="mt-2 space-y-3 rounded-lg border border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(values);
      }}
    >
      {fields.map((f) => {
        if (f.type === 'checkbox') {
          return (
            <label key={f.key} className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={Boolean(values[f.key])}
                onChange={(e) => set(f.key, e.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {f.title}
            </label>
          );
        }

        if (f.type === 'select') {
          const options = (f.options ?? []).map((o) =>
            typeof o === 'string' ? { value: o, label: o } : o
          );
          return (
            <label key={f.key} className="block text-sm text-text">
              <span className="mb-1 block text-text-muted">{f.title}</span>
              <select
                value={String(values[f.key] ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={f.key} className="block text-sm text-text">
            <span className="mb-1 block text-text-muted">
              {f.title}
              {f.required ? ' *' : ''}
            </span>
            <input
              type={f.type === 'password' ? 'password' : 'text'}
              value={String(values[f.key] ?? '')}
              onChange={(e) => set(f.key, e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text"
            />
          </label>
        );
      })}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          {saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-muted"
        >
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
