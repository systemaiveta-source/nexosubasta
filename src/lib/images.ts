import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const IMAGE_BUCKET = "auction-images";

/** Resolves stored image paths to temporary viewable links. */
export function useImageUrls(paths: string[] | undefined) {
  const list = (paths ?? []).filter(Boolean);
  return useQuery({
    queryKey: ["img", list],
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(list, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((d) => {
        if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      });
      return map;
    },
  });
}

export async function uploadAuctionImage(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Solo se permiten imágenes");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
