import { NextResponse } from "next/server";

export function relativeRedirect(path: string, status = 307): NextResponse {
  const location = path.startsWith("/") ? path : `/${path}`;
  return new NextResponse(null, {
    status,
    headers: { Location: location },
  });
}
