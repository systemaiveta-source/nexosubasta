CREATE FUNCTION public.my_publications() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 RETURN coalesce((SELECT jsonb_agg(v ORDER BY v.created_at DESC) FROM (SELECT s.id,s.title,s.status,s.current_price,s.currency,s.bid_count,s.ends_at,s.auction_type,s.closing_mode,s.winner_id,s.selection_pending,s.extension_pending,a.extension_used,a.republished_from,s.created_at FROM public.auctions_safe s JOIN public.auctions a ON a.id=s.id WHERE s.seller_id=auth.uid()) v),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.my_publications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_publications() TO authenticated;