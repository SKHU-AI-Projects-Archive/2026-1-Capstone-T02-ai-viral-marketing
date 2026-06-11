import { InputHTMLAttributes } from "react";

import { Field } from "./Field";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  hintId?: string;
};

export function TextInput({ label, hint, hintId, ...props }: TextInputProps) {
  return (
    <Field label={label} hint={hint} hintId={hintId}>
      <input className="field__control" {...props} />
    </Field>
  );
}
