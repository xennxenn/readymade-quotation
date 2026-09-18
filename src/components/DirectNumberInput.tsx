import React, { useState, useEffect } from 'react';

export interface DirectNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
  placeholder?: string;
  allowZero?: boolean;
  disabled?: boolean;
  id?: string;
  title?: string;
  onBlurCallback?: () => void;
}

/**
 * DirectNumberInput allows frictionless direct numeric entry:
 * - Automatically highlights full value on focus (type directly without backspacing first)
 * - Allows clearing/deleting "0" so user can type cleanly without annoying leading 0s
 * - Handles empty or partial state during typing without aggressively forcing fallback numbers
 * - Gracefully normalizes and clamps to min/max on blur
 */
export const DirectNumberInput: React.FC<DirectNumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  className = '',
  placeholder = '',
  allowZero = true,
  disabled = false,
  id,
  title,
  onBlurCallback,
}) => {
  const formatInitial = (val: number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    if (val === 0 && !allowZero) return '';
    return String(val);
  };

  const [text, setText] = useState<string>(() => formatInitial(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value when component is not focused by user
  useEffect(() => {
    if (!isFocused) {
      setText(formatInitial(value));
    }
  }, [value, isFocused, allowZero]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow numbers, negative sign, and decimal points
    setText(raw);

    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '-' || trimmed === '.') {
      if (allowZero) {
        onChange(0);
      }
      return;
    }

    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed)) {
      if (max !== undefined && parsed > max) {
        return;
      }
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Select entire text on focus so user can immediately type a replacement number
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = text.trim();
    if (trimmed === '' || isNaN(parseFloat(trimmed))) {
      const fallback = min !== undefined ? min : (allowZero ? 0 : 1);
      setText(fallback === 0 && !allowZero ? '' : String(fallback));
      onChange(fallback);
    } else {
      let parsed = parseFloat(trimmed);
      if (min !== undefined && parsed < min) parsed = min;
      if (max !== undefined && parsed > max) parsed = max;
      setText(String(parsed));
      onChange(parsed);
    }
    onBlurCallback?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      id={id}
      title={title}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
};
