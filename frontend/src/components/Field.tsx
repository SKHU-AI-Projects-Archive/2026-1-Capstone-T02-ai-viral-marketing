import { PropsWithChildren } from "react";

type FieldProps = PropsWithChildren<{
  label: string;
  hint?: string;
  hintId?: string;
}>;

export function Field({ label, hint, hintId, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
