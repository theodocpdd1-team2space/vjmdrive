"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { logoutAndRedirect } from "./logout";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await logoutAndRedirect("/");
      }}
      className={className}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Logout
    </button>
  );
}
