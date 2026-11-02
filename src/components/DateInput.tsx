import React from 'react';
import { formatTypedDate, parseDate } from '../domain/interest';

interface DateInputProps {
  id?: string;
  value: string; // DD-MM-YYYY
  onChange: (val: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const DateInput: React.FC<DateInputProps> = ({
  id,
  value,
  onChange,
  label,
  error,
  placeholder = 'DD-MM-YYYY',
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTypedDate(e.target.value);
    onChange(formatted);
  };

  const validation = value.length === 10 ? parseDate(value) : null;
  const hasError = Boolean(error || (validation && !validation.valid));
  const errorMessage = error || (validation && !validation.valid ? validation.error : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-bold text-mk-text mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9\-]*"
          maxLength={10}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full min-h-touch px-4 py-2.5 text-xl font-bold tracking-wider rounded-2xl bg-white border text-mk-text placeholder:text-slate-300 focus:outline-none transition-all ${
            hasError
              ? 'border-red-400 focus:ring-2 focus:ring-red-300'
              : 'border-mk-line focus:border-mk-purple focus:ring-2 focus:ring-mk-soft'
          } ${disabled ? 'bg-slate-100 text-slate-400' : ''}`}
        />
      </div>

      {hasError && errorMessage && (
        <p className="mt-1 text-xs font-semibold text-red-600 animate-fade-in">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

