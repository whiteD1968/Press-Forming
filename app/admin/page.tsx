import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { requireAdmin } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    pendingUsers,
    submitted,
    submittedLibrary,
    published,
    activeResearchers,
    inactiveResearchers,
    materials,
    products,
    equipment,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
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
    { code: "01", title: "Access Requests", href: "/admin/researchers", detail: `${pendingUsers.count ?? 0} pending approvals` },
    { code: "02", title: "Experiment Review", href: "/admin/review", detail: `${submitted.count ?? 0} submitted experiments` },
    { code: "03", title: "Library Review", href: "/admin/library-review", detail: `${submittedLibrary.count ?? 0} submitted sources plus library records` },
    { code: "04", title: "Researchers", href: "/admin/researchers", detail: `${activeResearchers.count ?? 0} active / ${inactiveResearchers.count ?? 0} inactive` },
    { code: "05", title: "Experiments", href: "/admin/experiments", detail: `${published.count ?? 0} published experiments` },
    { code: "06", title: "Atlas", href: "/admin/atlas", detail: "Categories and entries" },
    { code: "07", title: "Research", href: "/admin/research", detail: "Sources and references" },
    { code: "08", title: "Materials", href: "/admin/materials", detail: `${materials.count ?? 0} material records` },
    { code: "09", title: "Products", href: "/admin/products", detail: `${products.count ?? 0} product records` },
    { code: "10", title: "Vendors", href: "/admin/vendors", detail: "Supplier records" },
    { code: "11", title: "Equipment", href: "/admin/equipment", detail: `${equipment.count ?? 0} equipment records` },
    { code: "12", title: "Taxonomy", href: "/admin/taxonomy", detail: "Research vocabulary" },
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
