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
        label="제품명"
        name="name"
        type="text"
        placeholder="예: 보온 텀블러"
        value={form.name}
        onChange={onChange}
        maxLength={80}
        required
      />

      <TextInput
        label="키워드"
        name="keywords"
        type="text"
        placeholder="예: 보온, 경량, 가성비"
        value={form.keywords}
        onChange={onChange}
        hint="키워드는 쉼표로 구분해 주세요."
        hintId={keywordHintId}
        aria-describedby={keywordHintId}
        required
      />

      <TextArea
        label="제품 요약"
        name="summary"
        rows={6}
        placeholder="예: 국내 생산 스테인리스 보틀"
        value={form.summary}
        onChange={onChange}
        maxLength={400}
        required
      />

      <div className="composer__actions">
        <button className="button" type="submit" disabled={loading}>
          {loading ? "생성 중..." : "마케팅 문구 생성"}
        </button>
      </div>
    </form>
  );
}
