export async function logoutAndRedirect(to = "/") {
  await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = to;
}
