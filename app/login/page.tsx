import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#f5f7f5] px-5 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-7 text-center">
          <div className="text-2xl font-extrabold tracking-[-.04em] text-[#10251b]">Nodra</div>
          <div className="mt-2 text-sm text-[var(--muted)]">RFQ intelligence desk</div>
        </div>

        <div className="surface p-6 sm:p-8">
          <div className="kicker">Secure workspace</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-.03em]">Sign in to Nodra.</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Your catalogue, RFQs and product memory are isolated with Supabase Row Level Security.
          </p>

          {params.error ? (
            <div className="mt-5 rounded-xl bg-[var(--red-soft)] p-3 text-sm text-[var(--red)]">
              {params.error}
            </div>
          ) : null}
          {params.message ? (
            <div className="mt-5 rounded-xl bg-[var(--green-soft)] p-3 text-sm text-[var(--green-dark)]">
              {params.message}
            </div>
          ) : null}

          <form className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Email</span>
              <input name="email" type="email" required className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Password</span>
              <input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-xl border border-[var(--line)] px-3 py-3 outline-none focus:border-[var(--green)]" />
            </label>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button formAction={login} className="btn-primary">Sign in</button>
              <button formAction={signup} className="btn-secondary">Create account</button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
