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
    draftResearch,
    published,
    activeResearchers,
    inactiveResearchers,
    materials,
    products,
    equipment,
    atlasEntries,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("approval_status", "pending"),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("research_sources").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("research_sources").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", false),
    supabase.from("materials").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("equipment").select("id", { count: "exact", head: true }),
    supabase.from("atlas_entries").select("id", { count: "exact", head: true }),
  ]);

  const activityResults = await Promise.all([
    supabase.from("experiments").select("id, title, code, researcher_name, status, created_at").order("created_at", { ascending: false }).limit(4),
    supabase.from("research_sources").select("id, title, author, status, updated_at").order("updated_at", { ascending: false }).limit(4),
    supabase.from("materials").select("id, name, status, updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("products").select("id, product_name, manufacturer, status, updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("equipment").select("id, name, manufacturer, status, updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("atlas_entries").select("id, title, status, updated_at").order("updated_at", { ascending: false }).limit(3),
  ]);

  const activity = [
    ...((activityResults[0].data ?? []) as any[]).map((item) => ({ type: "Experiment", title: `${item.code || "Experiment"} / ${item.title}`, contributor: item.researcher_name, status: item.status, updated: item.created_at, href: `/experiments/${item.id}` })),
    ...((activityResults[1].data ?? []) as any[]).map((item) => ({ type: "Research", title: item.title, contributor: item.author, status: item.status, updated: item.updated_at, href: `/research/${item.id}` })),
    ...((activityResults[2].data ?? []) as any[]).map((item) => ({ type: "Material", title: item.name, contributor: "", status: item.status, updated: item.updated_at, href: `/materials/${item.id}` })),
    ...((activityResults[3].data ?? []) as any[]).map((item) => ({ type: "Product", title: item.product_name, contributor: item.manufacturer, status: item.status, updated: item.updated_at, href: `/resources/products/${item.id}` })),
    ...((activityResults[4].data ?? []) as any[]).map((item) => ({ type: "Equipment", title: item.name, contributor: item.manufacturer, status: item.status, updated: item.updated_at, href: `/resources/equipment/${item.id}` })),
    ...((activityResults[5].data ?? []) as any[]).map((item) => ({ type: "Atlas", title: item.title, contributor: "", status: item.status, updated: item.updated_at, href: `/atlas/${item.id}` })),
  ].sort((a, b) => new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime()).slice(0, 15);

  const links = [
    { code: "01", title: "Access Requests", href: "/admin/researchers", detail: `${pendingUsers.count ?? 0} pending approvals` },
    { code: "02", title: "Experiment Review", href: "/admin/review", detail: `${submitted.count ?? 0} submitted experiments` },
    { code: "03", title: "Library Review", href: "/admin/library-review", detail: `${submittedLibrary.count ?? 0} submitted sources plus library records` },
    { code: "04", title: "Researchers", href: "/admin/researchers", detail: `${activeResearchers.count ?? 0} active / ${inactiveResearchers.count ?? 0} inactive` },
    { code: "05", title: "Experiments", href: "/admin/experiments", detail: `${published.count ?? 0} published experiments` },
    { code: "06", title: "Atlas", href: "/admin/atlas", detail: `${atlasEntries.count ?? 0} atlas entries` },
    { code: "07", title: "Research", href: "/admin/research", detail: `${draftResearch.count ?? 0} draft sources` },
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
      <section className="detail-section">
        <p className="section-index">Recent Research Activity</p>
        <div className="admin-table">
          {activity.map((item) => (
            <Link className="library-admin-row" href={item.href} key={`${item.type}-${item.href}`}>
              <span><strong>{item.title}</strong><small>{item.type}</small></span>
              <span>{item.contributor || "-"}</span>
              <span><span className="status-pill">{item.status || "draft"}</span></span>
              <span>{item.updated ? new Date(item.updated).toLocaleDateString() : "-"}</span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
