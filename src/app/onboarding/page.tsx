import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import OnboardingForm from "./form";
import { REGIONS } from "@/lib/regions";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main className="min-h-screen bg-gradient-to-b from-kente-50 to-white">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          Tell us about your wedding
        </h1>
        <p className="mt-2 text-ink-700">
          We&apos;ll spin up your event page, dashboard, and a draft budget tuned to Ghana.
        </p>
        <OnboardingForm regions={[...REGIONS]} />
      </div>
    </main>
  );
}
