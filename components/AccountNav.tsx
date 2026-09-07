"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

type AccountState = "loading" | "public" | "researcher" | "admin";

export function AccountNav() {
  const [state, setState] = useState<AccountState>("loading");

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        if (mounted) setState("public");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.user.id)
        .single();

      if (mounted) setState(profile?.role === "admin" ? "admin" : "researcher");
    }

    loadAccount();
    return () => {
      mounted = false;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav className="main-nav" aria-label="Primary navigation">
      <Link href="/atlas">Atlas</Link>
      <Link href="/experiments">Experiments</Link>
      <Link href="/research">Research</Link>
      <Link href="/materials">Materials</Link>
      <Link href="/resources">Resources</Link>
      {state === "loading" ? null : state === "public" ? (
        <Link href="/login">Login</Link>
      ) : (
        <>
          <Link href="/submit">Submit</Link>
          {state === "admin" ? <Link href="/admin">Admin</Link> : <Link href="/my-work">My Work</Link>}
          <button className="nav-button" type="button" onClick={signOut}>Sign Out</button>
        </>
      )}
    </nav>
  );
}
