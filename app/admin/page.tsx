import Link from "next/link";
import { createClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return <AdminRequired />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "admin") {
    return <AdminRequired />;
  }

  const [
    submitted,
    published,
    activeResearchers,
    inactiveResearchers,
  ] = await Promise.all([
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", false),
  ]);

  const links = [
    { code: "01", title: "Review Queue", href: "/admin/review", detail: `${submitted.count ?? 0} submitted experiments` },
    { code: "02", title: "Researchers", href: "/admin/researchers", detail: `${activeResearchers.count ?? 0} active / ${inactiveResearchers.count ?? 0} inactive` },
    { code: "03", title: "Experiments", href: "/admin/experiments", detail: `${published.count ?? 0} published experiments` },
    { code: "04", title: "Research Sources", href: "/admin/sources", detail: "Atlas source lineage" },
  ];

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Administration</h1>
        <p>Review submissions, maintain researcher access, and steward the experiment archive without removing attribution.</p>
      </div>
      <div className="admin-grid">
        {links.map((link) => (
          <Link className="admin-tile" href={link.href} key={link.href}>
            <span>{link.code}</span>
            <strong>{link.title}</strong>
            <small>{link.detail}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AdminRequired() {
  return (
    <section className="page-shell narrow-shell">
      <div className="notice">Administrator access required.</div>
    </section>
  );
}
