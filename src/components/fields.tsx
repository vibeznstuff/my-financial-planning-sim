import { useEffect, useState } from "react";

interface NumInputProps {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string; // display-only, e.g. "$"
  suffix?: string; // display-only, e.g. "%"
  "aria-label"?: string;
}

/**
 * Numeric input that lets the user type freely (including "", "-", "1.")
 * and commits the parsed number on every valid keystroke.
 */
export function NumInput({ value, onChange, step, min, max, ...rest }: NumInputProps) {
  const [text, setText] = useState(String(value));

  // Sync when the underlying value changes from outside this input.
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      value={text}
      step={step}
      min={min}
      max={max}
      aria-label={rest["aria-label"]}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        const n = parseFloat(text);
        setText(String(Number.isNaN(n) ? value : n));
        if (Number.isNaN(n)) return;
      }}
    />
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
