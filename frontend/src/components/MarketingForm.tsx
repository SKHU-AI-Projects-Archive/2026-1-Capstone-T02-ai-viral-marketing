import { ChangeEvent, FormEvent, useId } from "react";

import { TextArea } from "./TextArea";
import { TextInput } from "./TextInput";

type FormState = {
  name: string;
  keywords: string;
  summary: string;
};

type MarketingFormProps = {
  form: FormState;
  loading: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function MarketingForm({ form, loading, onChange, onSubmit }: MarketingFormProps) {
  const keywordHintId = useId();

  return (
    <form className="composer" onSubmit={onSubmit}>
      <TextInput
        label="Product Name"
        name="name"
        type="text"
        placeholder="Example: Thermal Bottle"
        value={form.name}
        onChange={onChange}
        maxLength={80}
        required
      />

      <TextInput
        label="Keywords"
        name="keywords"
        type="text"
        placeholder="Example: thermal, lightweight, value"
        value={form.keywords}
        onChange={onChange}
        hint="Separate keywords with commas."
        hintId={keywordHintId}
        aria-describedby={keywordHintId}
        required
      />

      <TextArea
        label="Product Summary"
        name="summary"
        rows={6}
        placeholder="Example: Stainless steel bottle made in Korea"
        value={form.summary}
        onChange={onChange}
        maxLength={400}
        required
      />

      <div className="composer__actions">
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate Marketing Copy"}
        </button>
      </div>
    </form>
  );
}
