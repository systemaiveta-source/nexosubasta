CREATE OR REPLACE FUNCTION public.set_service_locations_verified(_auction uuid, _verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.service_requests SET locations_verified=_verified, updated_at=now() WHERE auction_id=_auction;
END $$;
REVOKE ALL ON FUNCTION public.set_service_locations_verified(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_service_locations_verified(uuid, boolean) TO service_role;