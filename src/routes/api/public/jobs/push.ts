import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/push")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const failure = await authenticateCronRequest(request);
        if (failure) return failure;
        if (process.env["NEXO_PUSH_DELIVERY_ENABLED"] !== "true")
          return Response.json({ enabled: false }, { status: 503 });
        const { deliverWebPushBatch } = await import("@/lib/web-push.server");
        return Response.json(await deliverWebPushBatch());
      },
    },
  },
});
