"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function routeAfterSignIn(userId: string) {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, approval_status, is_active")
      .eq("id", userId)
      .single();

    if (!profile || profile.approval_status === "pending" || profile.approval_status === "rejected" || profile.is_active === false) {
      window.location.href = "/access-status";
      return;
    }

    window.location.href = profile.role === "admin" ? "/admin" : "/";
  }

  async function authenticate(formElement: HTMLFormElement, mode: "signin" | "signup") {
    setBusy(true);
    setMessage("");
    const form = new FormData(formElement);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const fullName = String(form.get("full_name") || "").trim();
    const affiliation = String(form.get("affiliation") || "").trim();
    const accessRequestNote = String(form.get("access_request_note") || "").trim();

    try {
      const supabase = createClient();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
              data: {
                full_name: fullName,
                affiliation,
                access_request_note: accessRequestNote,
              },
            },
          });

      if (result.error) throw result.error;
      if (mode === "signin") {
        if (result.data.user) await routeAfterSignIn(result.data.user.id);
        return;
      }
      setMessage("Account created. Confirm your email to complete your access request. Research access requires administrator approval.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setMessage(
        message.toLowerCase().includes("email rate limit exceeded")
          ? "The temporary email sending limit has been reached. If your account is already confirmed, use Sign In. Otherwise, wait before requesting another confirmation email."
          : message
      );
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
        </div>
        {message && <p className="form-message">{message}</p>}
      </form>

      <form className="form-panel" onSubmit={(event) => { event.preventDefault(); authenticate(event.currentTarget, "signup"); }}>
        <div className="page-heading compact-heading">
          <p className="eyebrow">Request Access</p>
          <h2>Create account</h2>
        </div>
        <label>Full Name<input name="full_name" required autoComplete="name" /></label>
        <label>Affiliation<input name="affiliation" required placeholder="FAU School of Architecture" /></label>
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label>Access Request Note<textarea name="access_request_note" rows={3} placeholder="Research Assistant, Structures course, Visiting researcher" /></label>
        <button className="button secondary" type="submit" disabled={busy}>Create account</button>
      </form>
    </section>
  );
}
