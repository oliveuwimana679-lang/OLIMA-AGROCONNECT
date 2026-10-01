export type SupabaseProfile = {
  id: string;
  role: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type ProfileWrite = Pick<SupabaseProfile, "id" | "role" | "full_name" | "phone" | "email">;

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

function profileEndpoint(userId?: string) {
  const { baseUrl } = getSupabaseConfig();
  const url = new URL("/rest/v1/profiles", baseUrl);
  url.searchParams.set("select", "id,role,full_name,phone,email");
  if (userId) {
    url.searchParams.set("id", `eq.${userId}`);
    url.searchParams.set("limit", "1");
  } else {
    url.searchParams.set("on_conflict", "id");
  }
  return url;
}

function profileHeaders(accessToken: string, publishableKey: string) {
  return {
    apikey: publishableKey,
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
    "content-type": "application/json",
  };
}

async function parseProfileResponse(response: Response): Promise<SupabaseProfile[]> {
  if (!response.ok) {
    throw new Error(`Supabase profile request failed (${response.status}).`);
  }

  const profiles: unknown = await response.json();
  if (!Array.isArray(profiles)) {
    throw new Error("Supabase returned an unexpected profile response.");
  }
  return profiles as SupabaseProfile[];
}

export async function readSupabaseProfile(
  userId: string,
  accessToken: string,
): Promise<SupabaseProfile | undefined> {
  const { publishableKey } = getSupabaseConfig();
  const response = await fetch(profileEndpoint(userId), {
    headers: profileHeaders(accessToken, publishableKey),
  });
  const profiles = await parseProfileResponse(response);
  return profiles[0];
}

export async function upsertSupabaseProfile(
  profile: ProfileWrite,
  accessToken: string,
): Promise<SupabaseProfile> {
  const { publishableKey } = getSupabaseConfig();
  const response = await fetch(profileEndpoint(), {
    method: "POST",
    headers: {
      ...profileHeaders(accessToken, publishableKey),
      prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(profile),
  });
  const profiles = await parseProfileResponse(response);
  const savedProfile = profiles[0];
  if (!savedProfile || savedProfile.id !== profile.id) {
    throw new Error("Supabase did not return the saved profile.");
  }
  return savedProfile;
}