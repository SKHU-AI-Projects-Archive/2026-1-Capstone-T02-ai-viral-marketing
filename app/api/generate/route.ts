import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function POST() {
  return NextResponse.json(
    {
      detail: "동기 생성 API는 더 이상 지원하지 않습니다. POST /api/generation-jobs를 사용해 주세요.",
    },
    { status: 410 }
  );
}
