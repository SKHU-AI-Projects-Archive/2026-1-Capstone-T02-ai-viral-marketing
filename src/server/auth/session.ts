import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { ObjectId, WithId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import { serverConfig } from "../config";
import type { AppSessionData, SessionRecord, SessionUser as DbSessionUser, UserRecord } from "../db";
import { getCollections } from "../db";

const COOKIE_NAME = "ovms.sid";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type LoadedSession = {
  id: string | null;
  data: AppSessionData;
  isNew: boolean;
};

export type SessionUser = DbSessionUser;

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function sanitizeUser(user: WithId<UserRecord>): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

function signSessionId(sessionId: string): string {
  return createHmac("sha256", serverConfig.sessionSecret).update(sessionId).digest("base64url");
}

function encodeCookieValue(sessionId: string): string {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function decodeCookieValue(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) {
    return null;
  }

  const expected = signSessionId(sessionId);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }
  return sessionId;
}

function createSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function loadSession(request: NextRequest): Promise<LoadedSession> {
  const sessionId = decodeCookieValue(request.cookies.get(COOKIE_NAME)?.value);
  if (!sessionId) {
    return { id: null, data: {}, isNew: true };
  }

  const { sessionsCollection } = await getCollections();
  const session = await sessionsCollection.findOne({ _id: sessionId, expires: { $gt: new Date() } });
  if (!session) {
    return { id: null, data: {}, isNew: true };
  }

  return {
    id: session._id,
    data: session.session || {},
    isNew: false,
  };
}

export async function saveSession(session: LoadedSession): Promise<string> {
  const { sessionsCollection } = await getCollections();
  const sessionId = session.id || createSessionId();
  const record: SessionRecord = {
    _id: sessionId,
    session: session.data,
    expires: new Date(Date.now() + SESSION_TTL_MS),
  };

  await sessionsCollection.updateOne({ _id: sessionId }, { $set: record }, { upsert: true });
  session.id = sessionId;
  session.isNew = false;
  return sessionId;
}

export async function destroySession(session: LoadedSession): Promise<void> {
  if (!session.id) {
    return;
  }

  const { sessionsCollection } = await getCollections();
  await sessionsCollection.deleteOne({ _id: session.id });
  session.id = null;
  session.data = {};
  session.isNew = true;
}

export async function regenerateSession(session: LoadedSession): Promise<void> {
  if (session.id) {
    const { sessionsCollection } = await getCollections();
    await sessionsCollection.deleteOne({ _id: session.id });
  }
  session.id = null;
  session.isNew = true;
}

export function applySessionCookie(response: NextResponse, sessionId: string): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: encodeCookieValue(sessionId),
    httpOnly: true,
    sameSite: "lax",
    secure: serverConfig.nodeEnv === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: serverConfig.nodeEnv === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function commitSession(response: NextResponse, session: LoadedSession): Promise<NextResponse> {
  const sessionId = await saveSession(session);
  applySessionCookie(response, sessionId);
  return response;
}

export function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function getObjectIdFromSessionUser(user: SessionUser | undefined): ObjectId | null {
  const userId = String(user?.id || "");
  if (!ObjectId.isValid(userId)) {
    return null;
  }
  return new ObjectId(userId);
}
