import type { Tone } from "../api/types";

export const TONE_LABELS: Record<Tone, string> = {
  blog: "블로그",
  coupang_review: "쿠팡 리뷰",
  community_comment: "커뮤니티 댓글",
};

export function getToneLabel(tone: Tone): string {
  return TONE_LABELS[tone] ?? "블로그";
}
