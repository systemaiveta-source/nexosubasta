import { Share2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { auctionShareUrl, socialShareLinks } from "@/lib/auction-share";

export function AuctionShare({ id, title }: { id: string; title: string }) {
  const url = auctionShareUrl(id);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Enlace copiado");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        toast.error("No se pudo compartir. Puedes usar los enlaces de redes sociales.");
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={share}>
        <Share2 className="size-4" />
        Compartir subasta
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Compartir en redes sociales">
            <ExternalLink className="size-4" />
            Redes sociales
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {Object.entries(socialShareLinks(id, title)).map(([name, href]) => (
            <DropdownMenuItem key={name} asChild>
              <a href={href} target="_blank" rel="noopener noreferrer">
                {name}
              </a>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Enlace copiado");
              } catch {
                toast.error("No se pudo copiar el enlace");
              }
            }}
          >
            <Copy className="size-4" />
            Copiar enlace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
