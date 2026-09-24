import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/rivora/workspace";
import { createWorkspace } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { claims, workspace } = await getAuthContext();
  if (!claims) redirect("/login");
  if (workspace) redirect("/app/inbox");

  return (
    <main className="min-h-screen bg-[#f5f7f5] px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div className="surface p-7">
          <div className="kicker">First workspace</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">Create your Rivora workspace.</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            This becomes the security boundary for customers, product catalogue, RFQs and learned SKU mappings.
          </p>
          {params.error ? (
            <div className="mt-5 rounded-xl bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]">{params.error}</div>
          ) : null}
          <form action={createWorkspace} className="mt-6">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Company / workspace name</span>
              <input name="workspaceName" required placeholder="Example Industrial Oy" className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
            </label>
            <button className="btn-primary mt-5 w-full">Create workspace</button>
          </form>
        </div>
      </div>
    </main>
  );
}
