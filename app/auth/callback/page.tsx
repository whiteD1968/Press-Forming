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
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      window.location.replace("/submit");
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
