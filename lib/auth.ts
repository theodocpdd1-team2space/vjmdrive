import { cookies } from "next/headers";

export const AUTH_COOKIE = "vjm_drive_auth";

export async function isAuthed() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value === "yes";
}
