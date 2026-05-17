import { cookies } from "next/headers";

export const AUTH_COOKIE = "vjm_drive_auth";
export const ADMIN_COOKIE = "vjm_drive_admin";

export async function isAuthed() {
  return isAdmin();
}

export async function isAdmin() {
  const cookieStore = await cookies();
  return (
    cookieStore.get(ADMIN_COOKIE)?.value === "yes" ||
    cookieStore.get(AUTH_COOKIE)?.value === "yes"
  );
}
