"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

export default function AuthCallbackPage() {
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function confirmAccount() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        setErrorMessage("Missing confirmation code.");
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        window.location.replace("/access-status");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, approval_status, is_active")
        .eq("id", userId)
        .single();

      if (!profile || profile.approval_status !== "approved" || profile.is_active === false) {
        window.location.replace("/access-status");
        return;
      }

      window.location.replace(profile.role === "admin" ? "/admin" : "/");
    }

    confirmAccount();
  }, []);

  if (!errorMessage) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">Completing account confirmation...</div>
      </section>
    );
  }

  return (
    <section className="page-shell narrow-shell">
      <div className="page-heading">
        <p className="eyebrow">Authentication Error</p>
        <h1>Authentication error</h1>
        <p>We could not complete the account confirmation.</p>
      </div>
      <div className="notice">{errorMessage}</div>
      <Link className="button primary" href="/login">Return to login</Link>
    </section>
  );
}
