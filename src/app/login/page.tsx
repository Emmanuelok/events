import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  // In demo mode the login screen makes no sense — go straight to the dashboard,
  // which will auto-create the demo user via getCurrentUser + seed an example event.
  if (env().DEMO_MODE) {
    redirect("/dashboard");
  }
  return <LoginForm />;
}
