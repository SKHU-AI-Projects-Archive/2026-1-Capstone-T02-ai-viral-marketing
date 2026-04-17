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
  imagePreviewUrl: string;
  imageFileName: string;
  imageMessage: string;
  analyzingImage: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAnalyzeImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function MarketingForm({
  form,
  loading,
  imagePreviewUrl,
  imageFileName,
  imageMessage,
  analyzingImage,
  onChange,
  onImageChange,
  onAnalyzeImage,
  onSubmit,
}: MarketingFormProps) {
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

      <div className="image-input">
        <label className="field">
          <span className="field__label">제품 이미지</span>
          <input
            className="field__control"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onImageChange}
          />
          <span className="field__hint">JPG, PNG, WEBP 형식만 업로드할 수 있으며 최대 4MB까지 지원합니다.</span>
        </label>

        {imagePreviewUrl ? (
          <div className="image-preview">
            <img src={imagePreviewUrl} alt={imageFileName ? `${imageFileName} 미리보기` : "제품 이미지 미리보기"} />
          </div>
        ) : null}

        <div className="image-input__actions">
          <button
            className="button button--secondary"
            type="button"
            disabled={!imagePreviewUrl || analyzingImage}
            onClick={onAnalyzeImage}
          >
            {analyzingImage ? "이미지 분석 중..." : "이미지 분석"}
          </button>
          {imageMessage ? <span className="field__hint">{imageMessage}</span> : null}
        </div>
      </div>

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
        placeholder="예: 국내 생산 스테인리스 텀블러로 보온성이 뛰어난 제품"
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
