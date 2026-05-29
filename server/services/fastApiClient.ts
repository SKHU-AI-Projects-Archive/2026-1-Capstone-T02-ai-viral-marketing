import express = require("express");

import { serverConfig } from "../config";

type Response = express.Response;

export async function relayJsonResponse(upstreamResponse: globalThis.Response, res: Response): Promise<void> {
  const contentType = upstreamResponse.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await upstreamResponse.json();
    res.status(upstreamResponse.status).json(data);
    return;
  }

  const text = await upstreamResponse.text();
  res.status(upstreamResponse.status).json({
    detail: text || "내부 AI 서버가 예상하지 못한 응답을 반환했습니다.",
  });
}

export function postFastApiJson(pathname: string, body: unknown): Promise<globalThis.Response> {
  return fetch(`${serverConfig.fastApiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-API-Secret": serverConfig.internalApiSecret,
    },
    body: JSON.stringify(body),
  });
}

export function postFastApiForm(pathname: string, body: FormData): Promise<globalThis.Response> {
  return fetch(`${serverConfig.fastApiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "X-Internal-API-Secret": serverConfig.internalApiSecret,
    },
    body,
  });
}
