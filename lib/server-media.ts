import type { LibraryMedia } from "./library";

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl?: string } | null }>;
    };
  };
};

export async function withLibraryMediaUrls<T extends LibraryMedia>(supabase: StorageClient, media: T[]) {
  return Promise.all(media.map(async (item) => {
    if (!item.storage_path) return { ...item, signedUrl: null };
    const { data } = await supabase.storage.from("library-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signedUrl: data?.signedUrl ?? null };
  }));
}
