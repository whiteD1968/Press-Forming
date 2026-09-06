"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function authenticate(formElement: HTMLFormElement, mode: "signin" | "signup") {
    setBusy(true);
    setMessage("");
    const form = new FormData(formElement);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const supabase = createClient();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (result.error) throw result.error;
      setMessage(mode === "signin" ? "Signed in. You can now submit experiments." : "Account created. Check your email if confirmation is enabled.");
      if (mode === "signin") window.location.href = "/submit";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-shell narrow-shell">
      <div className="page-heading">
        <p className="eyebrow">Research Portal</p>
        <h1>Researcher login</h1>
        <p>RAs and faculty use the same account to save drafts, submit experiments, and review the evolving archive.</p>
      </div>

      <form className="form-panel" onSubmit={(event) => { event.preventDefault(); authenticate(event.currentTarget, "signin"); }}>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required minLength={8} autoComplete="current-password" /></label>
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={busy}>Sign in</button>
          <button className="button" type="button" disabled={busy} onClick={(event) => {
            const form = event.currentTarget.closest("form");
            if (form) authenticate(form, "signup");
          }}>Create account</button>
        </div>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
