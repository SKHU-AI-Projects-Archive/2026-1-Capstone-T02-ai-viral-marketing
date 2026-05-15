import { ChangeEvent, FormEvent, useId } from "react";

import type { Tone } from "../App";
import { TextArea } from "./TextArea";
import { TextInput } from "./TextInput";

type FormState = {
  name: string;
  keywords: string;
  summary: string;
  tone: Tone;
};

type MarketingFormProps = {
  form: FormState;
  loading: boolean;
  imagePreviewUrl: string;
  imageFileName: string;
  imageMessage: string;
  analyzingImage: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onToneChange: (tone: Tone) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAnalyzeImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: "blog", label: "블로그", description: "네이버 검색형 후기, 700~1200자" },
  { value: "coupang_review", label: "쿠팡 리뷰", description: "실사용자 후기 톤, 100~300자" },
  { value: "community_comment", label: "커뮤니티 댓글", description: "자연스러운 커뮤니티 댓글, 50~150자" },
];

export function MarketingForm({
  form,
  loading,
  imagePreviewUrl,
  imageFileName,
  imageMessage,
  analyzingImage,
  onChange,
  onToneChange,
  onImageChange,
  onAnalyzeImage,
  onSubmit,
}: MarketingFormProps) {
  const keywordHintId = useId();
  const toneGroupId = useId();
  const activeTone = TONE_OPTIONS.find((option) => option.value === form.tone) ?? TONE_OPTIONS[0];

  return (
    <form className="composer" onSubmit={onSubmit}>
      <fieldset className="tone-segment" aria-labelledby={toneGroupId}>
        <legend id={toneGroupId} className="field__label">
          톤 선택
        </legend>
        <div className="tone-segment__options" role="radiogroup">
          {TONE_OPTIONS.map((option) => {
            const checked = option.value === form.tone;
            return (
              <label
                key={option.value}
                className={`tone-segment__option${checked ? " tone-segment__option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="tone"
                  value={option.value}
                  checked={checked}
                  onChange={() => onToneChange(option.value)}
                />
                <span className="tone-segment__label">{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="field__hint">{activeTone.description}</span>
      </fieldset>

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
