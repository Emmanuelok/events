import CallbackClient from "./client";

export default async function GiftCallback({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const reference = sp.reference || sp.trxref || "";
  return (
    <main className="min-h-screen bg-gradient-to-b from-kente-50 to-white">
      <div className="mx-auto max-w-md px-5 py-16">
        <CallbackClient reference={reference} slug={slug} />
      </div>
    </main>
  );
}
