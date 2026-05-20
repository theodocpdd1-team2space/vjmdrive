import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <AuthForm mode="reset" />
    </Suspense>
  );
}
