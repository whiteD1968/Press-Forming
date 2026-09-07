"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

type AccountState = "loading" | "public" | "pending" | "rejected" | "inactive" | "researcher" | "admin";

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
        .select("role, approval_status, is_active")
        .eq("id", auth.user.id)
        .single();

      if (!profile || profile.approval_status === "pending") {
        if (mounted) setState("pending");
        return;
      }
      if (profile.approval_status === "rejected") {
        if (mounted) setState("rejected");
        return;
      }
      if (profile.is_active === false) {
        if (mounted) setState("inactive");
        return;
      }

      if (mounted) setState(profile.role === "admin" ? "admin" : "researcher");
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
      {state === "loading" ? null : state === "public" ? (
        <>
          <Link href="/">Home</Link>
          <Link href="/login">Login</Link>
        </>
      ) : state === "pending" || state === "rejected" || state === "inactive" ? (
        <>
          <Link href="/">Home</Link>
          <Link href="/access-status">Access Status</Link>
          <button className="nav-button" type="button" onClick={signOut}>Sign Out</button>
        </>
      ) : (
        <>
          <Link href="/atlas">Atlas</Link>
          <Link href="/experiments">Experiments</Link>
          <Link href="/research">Research</Link>
          <Link href="/materials">Materials</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/contribute">Contribute</Link>
          {state === "admin" ? <Link href="/admin">Admin</Link> : <Link href="/my-work">My Work</Link>}
          <button className="nav-button" type="button" onClick={signOut}>Sign Out</button>
        </>
      )}
    </nav>
  );
}
