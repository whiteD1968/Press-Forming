import Link from "next/link";
import { redirect } from "next/navigation";
import { getResearchAccessState } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function AccessStatusPage() {
  const { state, profile } = await getResearchAccessState();

  if (state === "public") redirect("/login");

  const requestedAt = profile?.approval_requested_at
    ? new Date(profile.approval_requested_at).toLocaleDateString()
    : "Not recorded";

  const content = {
    pending: {
      heading: "RESEARCH ACCESS PENDING",
      text: "Your account has been confirmed. Access to the Forming Material research archive requires administrator approval.",
    },
    rejected: {
      heading: "RESEARCH ACCESS NOT APPROVED",
      text: "Your account does not currently have access to the research archive.",
    },
    inactive: {
      heading: "RESEARCH ACCESS INACTIVE",
      text: "Your previous research access is currently inactive. Contact the project administrator if access should be restored.",
    },
    researcher: {
      heading: "RESEARCH ACCESS APPROVED",
      text: "Research access approved.",
    },
    admin: {
      heading: "RESEARCH ACCESS APPROVED",
      text: "Research access approved.",
    },
  }[state];

  return (
    <section className="page-shell narrow-shell">
      <div className="page-heading">
        <p className="eyebrow">Access Status</p>
        <h1>{content.heading}</h1>
        <p>{content.text}</p>
      </div>

      <div className="facts-grid">
        <div><span>Name</span><strong>{profile?.full_name || "Not provided"}</strong></div>
        <div><span>Email</span><strong>{profile?.email || "Not provided"}</strong></div>
        <div><span>Affiliation</span><strong>{profile?.affiliation || "Not provided"}</strong></div>
        <div><span>Request date</span><strong>{requestedAt}</strong></div>
      </div>

      {state === "rejected" && profile?.rejection_reason && (
        <div className="notice">{profile.rejection_reason}</div>
      )}

      {(state === "researcher" || state === "admin") && (
        <Link className="button primary" href={state === "admin" ? "/admin" : "/"}>Enter Forming Material</Link>
      )}
    </section>
  );
}
