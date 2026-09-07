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
    submittedLibrary,
    published,
    activeResearchers,
    inactiveResearchers,
    materials,
    products,
    equipment,
  ] = await Promise.all([
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("research_sources").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", false),
    supabase.from("materials").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("equipment").select("id", { count: "exact", head: true }),
  ]);

  const links = [
    { code: "01", title: "Experiment Review", href: "/admin/review", detail: `${submitted.count ?? 0} submitted experiments` },
    { code: "02", title: "Library Review", href: "/admin/library-review", detail: `${submittedLibrary.count ?? 0} submitted sources plus library records` },
    { code: "03", title: "Researchers", href: "/admin/researchers", detail: `${activeResearchers.count ?? 0} active / ${inactiveResearchers.count ?? 0} inactive` },
    { code: "04", title: "Experiments", href: "/admin/experiments", detail: `${published.count ?? 0} published experiments` },
    { code: "05", title: "Atlas", href: "/admin/atlas", detail: "Categories and entries" },
    { code: "06", title: "Research", href: "/admin/research", detail: "Sources and references" },
    { code: "07", title: "Materials", href: "/admin/materials", detail: `${materials.count ?? 0} material records` },
    { code: "08", title: "Products", href: "/admin/products", detail: `${products.count ?? 0} product records` },
    { code: "09", title: "Vendors", href: "/admin/vendors", detail: "Supplier records" },
    { code: "10", title: "Equipment", href: "/admin/equipment", detail: `${equipment.count ?? 0} equipment records` },
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
