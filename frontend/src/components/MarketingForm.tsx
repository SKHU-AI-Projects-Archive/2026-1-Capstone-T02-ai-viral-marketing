import { ChangeEvent, FormEvent, useId } from "react";

import type { BlogImage, Tone } from "../api/types";
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
  blogImages: BlogImage[];
  blogImageMessage: string;
  analyzingImage: boolean;
  uploadingBlogImages: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onToneChange: (tone: Tone) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveBlogImage: (id: string) => void;
  onBlogImageChange: (
    id: string,
    field: "label" | "description" | "placementHint",
    value: string
  ) => void;
  onBlogImageFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAnalyzeImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  { value: "blog", label: "블로그", description: "네이버/티스토리형 리뷰 글, 700~1200자" },
  { value: "coupang_review", label: "쿠팡 리뷰", description: "실사용자 후기 톤, 100~300자" },
  { value: "community_comment", label: "커뮤니티 댓글", description: "자연스러운 댓글 톤, 50~150자" },
];

export function MarketingForm({
  form,
  loading,
  imagePreviewUrl,
  imageFileName,
  imageMessage,
  blogImages,
  blogImageMessage,
  analyzingImage,
  uploadingBlogImages,
  onChange,
  onToneChange,
  onImageChange,
  onRemoveBlogImage,
  onBlogImageChange,
  onBlogImageFilesChange,
  onAnalyzeImage,
  onSubmit,
}: MarketingFormProps) {
  const keywordHintId = useId();
  const toneGroupId = useId();
  const toneDescriptionId = useId();
  const imageHintId = useId();
  const imageMessageId = useId();
  const blogImagesHintId = useId();
  const blogImagesMessageId = useId();
  const activeTone = TONE_OPTIONS.find((option) => option.value === form.tone) ?? TONE_OPTIONS[0];
  const imageDescription = imageMessage ? `${imageHintId} ${imageMessageId}` : imageHintId;
  const blogImagesDescription = blogImageMessage ? `${blogImagesHintId} ${blogImagesMessageId}` : blogImagesHintId;

  return (
    <form className="composer" onSubmit={onSubmit}>
      <fieldset className="tone-segment" aria-labelledby={toneGroupId} aria-describedby={toneDescriptionId}>
        <legend id={toneGroupId} className="field__label">
          톤 선택
        </legend>
        <div className="tone-segment__options" role="radiogroup" aria-labelledby={toneGroupId} aria-describedby={toneDescriptionId}>
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
                  aria-describedby={toneDescriptionId}
                  onChange={() => onToneChange(option.value)}
                />
                <span className="tone-segment__label">{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="field__hint" id={toneDescriptionId}>
          {activeTone.description}
        </span>
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
            aria-describedby={imageDescription}
            onChange={onImageChange}
          />
          <span className="field__hint" id={imageHintId}>
            JPG, PNG, WEBP 형식만 업로드할 수 있으며 최대 4MB까지 지원합니다.
          </span>
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
            aria-busy={analyzingImage}
            onClick={onAnalyzeImage}
          >
            {analyzingImage ? "이미지 분석 중..." : "이미지 분석"}
          </button>
          {imageMessage ? (
            <span className="field__hint" id={imageMessageId} role="status" aria-live="polite">
              {imageMessage}
            </span>
          ) : null}
        </div>
      </div>

      {form.tone === "blog" ? (
        <section className="blog-images" aria-labelledby="blog-images-title" aria-describedby={blogImagesDescription}>
          <div className="blog-images__header">
            <div>
              <h3 id="blog-images-title">블로그 이미지</h3>
              <p className="field__hint" id={blogImagesHintId}>
                이미지 파일을 최대 5개까지 업로드하면 Cloudinary에 저장하고 본문에 실제 이미지 링크를 삽입합니다.
                이미지 분석에는 위 제품 이미지 1개만 사용됩니다.
              </p>
            </div>
          </div>

          <label className="field">
            <span className="field__label">블로그 이미지 파일</span>
            <input
              className="field__control"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploadingBlogImages || blogImages.length >= 5}
              onChange={onBlogImageFilesChange}
            />
            <span className="field__hint">
              JPG, PNG, WEBP 형식만 가능하며 파일당 4MB 이하입니다.
            </span>
          </label>

          {blogImages.length ? (
            <div className="blog-images__list">
              {blogImages.map((image, index) => (
                <fieldset className="blog-image-card" key={image.id}>
                  <legend>이미지 {index + 1}</legend>
                  <TextInput
                    label="라벨"
                    name={`blogImageLabel-${image.id}`}
                    type="text"
                    placeholder="예: 대표 이미지"
                    value={image.label}
                    onChange={(event) => onBlogImageChange(image.id, "label", event.target.value)}
                    maxLength={30}
                    required
                  />
                  <TextInput
                    label="이미지 설명"
                    name={`blogImageDescription-${image.id}`}
                    type="text"
                    placeholder="예: 제품 패키지가 정면으로 보이는 이미지"
                    value={image.description || ""}
                    onChange={(event) => onBlogImageChange(image.id, "description", event.target.value)}
                    maxLength={120}
                  />
                  <TextInput
                    label="배치 힌트"
                    name={`blogImagePlacement-${image.id}`}
                    type="text"
                    placeholder="예: 도입부 직후, 성분 설명 섹션"
                    value={image.placementHint || ""}
                    onChange={(event) => onBlogImageChange(image.id, "placementHint", event.target.value)}
                    maxLength={80}
                  />
                  {image.displayUrl ? (
                    <p className="blog-image-card__url">
                      Cloudinary URL: <a href={image.sourceUrl || image.displayUrl} rel="noreferrer" target="_blank">{image.displayUrl}</a>
                    </p>
                  ) : null}
                  <button
                    className="result__copy blog-image-card__remove"
                    type="button"
                    onClick={() => onRemoveBlogImage(image.id)}
                  >
                    삭제
                  </button>
                </fieldset>
              ))}
            </div>
          ) : (
            <p className="blog-images__empty">등록된 블로그 이미지가 없습니다. 이미지 없이도 블로그 문구를 생성할 수 있습니다.</p>
          )}

          {blogImageMessage ? (
            <p className="field__hint" id={blogImagesMessageId} role="status" aria-live="polite">
              {blogImageMessage}
            </p>
          ) : null}
        </section>
      ) : null}

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
        placeholder="예: 국내 생산 스테인리스 텀블러로 보온성이 좋은 제품"
        value={form.summary}
        onChange={onChange}
        maxLength={400}
        required
      />

      <div className="composer__actions">
        <button className="button" type="submit" disabled={loading} aria-busy={loading}>
          {loading ? "생성 중..." : "마케팅 문구 생성"}
        </button>
      </div>
    </form>
  );
}
