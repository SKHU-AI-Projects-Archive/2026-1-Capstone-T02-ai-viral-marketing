import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/generate", "/settings", "/generations", "/result"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) {
    return NextResponse.next();
  }

  if (request.cookies.get("ovms.sid")?.value) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/generate/:path*", "/settings/:path*", "/generations/:path*", "/result/:path*"],
};
