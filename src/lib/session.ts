// src/lib/session.ts
import { SessionOptions } from "iron-session";

export interface SessionData {
  user?: {
    identifier: string;
    locationId: string;
    isLoggedIn: boolean;
    loginTime: number;
    lastActivity: number;
  };
  // Remove sensitive and large data from session - fetch from Firestore instead
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "eliaai-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax",
  },
};

export const defaultSession: SessionData = {
  user: undefined,
};