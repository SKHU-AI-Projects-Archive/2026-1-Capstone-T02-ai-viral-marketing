import { TextareaHTMLAttributes } from "react";

import { Field } from "./Field";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  hintId?: string;
};

export function TextArea({ label, hint, hintId, ...props }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} hintId={hintId}>
      <textarea className="field__control field__control--textarea" {...props} />
    </Field>
  );
}
