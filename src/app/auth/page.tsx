import { AuthForm } from "@/components/auth/auth-form";
import { MotionShell } from "@/components/motion-shell";

export default function AuthPage() {
  return (
    <MotionShell>
      <div className="flex min-h-screen items-center justify-center px-4 pt-16">
        <AuthForm />
      </div>
    </MotionShell>
  );
}
