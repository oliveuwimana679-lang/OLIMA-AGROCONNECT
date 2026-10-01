import type { RequestHandler, Response } from "express";

export type SupabaseAuthContext = {
  userId: string;
  email: string | null;
  accessToken: string;
};

function getSupabaseConfig() {
  const projectUrl = process.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!projectUrl || !publishableKey) {
    throw new Error("Supabase configuration is missing.");
  }

  const url = new URL(projectUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("Supabase project URL must use HTTPS.");
  }

  return { baseUrl: url.origin, publishableKey };
}

async function verifyAccessToken(accessToken: string): Promise<{ id: string; email: string | null } | null> {
  const { baseUrl, publishableKey } = getSupabaseConfig();
  const response = await fetch(new URL("/auth/v1/user", baseUrl), {
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  });
  if (!response.ok) return null;

  const user: unknown = await response.json();
  if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string") {
    return null;
  }
  return {
    id: user.id,
    email: "email" in user && typeof user.email === "string" ? user.email : null,
  };
}

export function getSupabaseAuthContext(res: Response): SupabaseAuthContext | undefined {
  return (res.locals as { supabaseAuth?: SupabaseAuthContext }).supabaseAuth;
}

export const supabaseAuthMiddleware: RequestHandler = async (req, res, next) => {
  const authorization = req.get("authorization");
  if (!authorization) {
    next();
    return;
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const accessToken = match[1];
    const user = await verifyAccessToken(accessToken);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    (res.locals as { supabaseAuth?: SupabaseAuthContext }).supabaseAuth = {
      userId: user.id,
      email: user.email,
      accessToken,
    };
    next();
  } catch {
    res.status(503).json({ error: "Authentication service is unavailable" });
  }
};