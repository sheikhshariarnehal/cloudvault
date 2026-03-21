import { AuthBranding } from "@/components/auth/auth-branding";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex font-sans bg-[#161616]">
      <AuthBranding />
      <LoginForm />
    </div>
  );
}
