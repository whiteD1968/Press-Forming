export type EditorialStatus = "draft" | "submitted" | "reviewed" | "published" | "archived";

export type LibraryMedia = {
  id: string;
  entity_type: string;
  entity_id: string;
  storage_path: string | null;
  external_url: string | null;
  media_type: string | null;
  caption: string | null;
  credit: string | null;
  source_url: string | null;
  display_order: number | null;
  signedUrl?: string | null;
};

export type TaxonomyTerm = {
  id: string;
  taxonomy_type: string;
  name: string;
  slug: string | null;
  description: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export const editorialStatuses: EditorialStatus[] = ["draft", "submitted", "reviewed", "published", "archived"];
export const mediaTypes = ["reference", "historical", "process", "tooling", "diagram", "result", "publication", "other"];

export function syncPublished(status: EditorialStatus) {
  return status === "published";
}

export function publicStatusLabel(status: string | null | undefined) {
  return (status || "draft").toUpperCase();
}

export function numberOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

export function stringOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isEditableStatus(status: string | null | undefined) {
  return status === "draft" || status === "submitted";
}
