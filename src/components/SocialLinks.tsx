import { ExternalLink } from "lucide-react";
import { socialLinkSchema } from "@/lib/social-links";
export function SocialLinks({
  links,
}: {
  links: { id: string; network: string; label: string; url: string; sort: number }[];
}) {
  const safe = links.filter((row) => socialLinkSchema.safeParse({ ...row, active: true }).success);
  if (!safe.length) return null;
  return (
    <nav
      aria-label="Redes sociales de NEXO"
      className="mx-auto flex max-w-6xl flex-wrap justify-center gap-5 border-t border-border px-4 py-8"
    >
      {safe.map((row) => (
        <a
          key={row.id}
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {row.label}
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </nav>
  );
}
