ALTER TABLE public.transactions ADD COLUMN buyer_payment_accepted_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN seller_payment_accepted_at timestamptz;
COMMENT ON COLUMN public.transactions.agreed_method IS 'DEPRECATED: payment coordination now lives exclusively in private messages; historical values preserved';
COMMENT ON COLUMN public.transactions.payment_stage IS 'DEPRECATED: historical stages preserved; completion depends on separate acceptances and confirmations';
REVOKE UPDATE ON public.transactions FROM authenticated, anon;
CREATE OR REPLACE FUNCTION public.accept_operation_payment(_tx uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions; caller uuid := auth.uid();
BEGIN
 SELECT * INTO t FROM public.transactions WHERE id=_tx FOR UPDATE;
 IF caller IS NULL OR t.id IS NULL OR NOT(caller=t.buyer_id OR caller=t.seller_id) THEN RAISE EXCEPTION 'Operación no disponible'; END IF;
 IF t.status='completed' THEN RETURN; END IF;
 IF t.status NOT IN ('pending','disputed') THEN RAISE EXCEPTION 'Operación cerrada'; END IF;
 IF (caller=t.buyer_id AND t.buyer_payment_accepted_at IS NOT NULL) OR (caller=t.seller_id AND t.seller_payment_accepted_at IS NOT NULL) THEN RETURN; END IF;
 UPDATE public.transactions SET buyer_payment_accepted_at=CASE WHEN caller=t.buyer_id THEN clock_timestamp() ELSE buyer_payment_accepted_at END,seller_payment_accepted_at=CASE WHEN caller=t.seller_id THEN clock_timestamp() ELSE seller_payment_accepted_at END WHERE id=t.id;
 INSERT INTO public.operation_events(transaction_id,actor_id,kind) VALUES(t.id,caller,'payment_coordination_accepted');
END $$;
REVOKE ALL ON FUNCTION public.accept_operation_payment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_operation_payment(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.completion_stage_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF ((NEW.buyer_confirmed AND NOT OLD.buyer_confirmed) OR (NEW.seller_confirmed AND NOT OLD.seller_confirmed)) AND (NEW.buyer_payment_accepted_at IS NULL OR NEW.seller_payment_accepted_at IS NULL OR NEW.status<>'pending' OR EXISTS(SELECT 1 FROM public.disputes d WHERE d.transaction_id=NEW.id AND d.status='open')) THEN RAISE EXCEPTION 'Ambas partes deben aceptar la coordinación y no debe existir disputa'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.closed_operation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.status='completed' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Operación cerrada definitivamente'; END IF;
 IF NEW.status='completed' AND OLD.status<>'completed' AND (NOT NEW.buyer_confirmed OR NOT NEW.seller_confirmed OR NEW.buyer_payment_accepted_at IS NULL OR NEW.seller_payment_accepted_at IS NULL OR EXISTS(SELECT 1 FROM public.disputes d WHERE d.transaction_id=NEW.id AND d.status='open')) THEN RAISE EXCEPTION 'Faltan aceptaciones, confirmaciones o existe una disputa'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.confirm_transaction(_tx uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions; caller uuid := auth.uid();
BEGIN
 SELECT * INTO t FROM public.transactions WHERE id=_tx FOR UPDATE;
 IF caller IS NULL OR t.id IS NULL OR NOT(caller=t.buyer_id OR caller=t.seller_id) THEN RAISE EXCEPTION 'Operación no disponible'; END IF;
 IF t.status='completed' THEN RETURN; END IF;
 IF t.status<>'pending' OR EXISTS(SELECT 1 FROM public.disputes d WHERE d.transaction_id=t.id AND d.status='open') THEN RAISE EXCEPTION 'No se puede completar una operación en disputa'; END IF;
 IF t.buyer_payment_accepted_at IS NULL OR t.seller_payment_accepted_at IS NULL THEN RAISE EXCEPTION 'Ambas partes deben aceptar la coordinación del pago'; END IF;
 IF (caller=t.buyer_id AND t.buyer_confirmed) OR (caller=t.seller_id AND t.seller_confirmed) THEN RETURN; END IF;
 UPDATE public.transactions SET buyer_confirmed=buyer_confirmed OR caller=t.buyer_id,seller_confirmed=seller_confirmed OR caller=t.seller_id,buyer_confirmed_at=CASE WHEN caller=t.buyer_id THEN clock_timestamp() ELSE buyer_confirmed_at END,seller_confirmed_at=CASE WHEN caller=t.seller_id THEN clock_timestamp() ELSE seller_confirmed_at END WHERE id=t.id RETURNING * INTO t;
 IF t.buyer_confirmed AND t.seller_confirmed THEN UPDATE public.transactions SET status='completed',completed_at=clock_timestamp() WHERE id=t.id; END IF;
 INSERT INTO public.operation_events(transaction_id,actor_id,kind) VALUES(t.id,caller,'completion_confirmed');
 PERFORM public.notify(CASE WHEN caller=t.buyer_id THEN t.seller_id ELSE t.buyer_id END,'Confirmación de finalización','La otra parte marcó la operación como completada.','/operaciones/'||t.id);
END $$;
REVOKE ALL ON FUNCTION public.confirm_transaction(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_transaction(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.advance_operation(_tx uuid,_stage text,_method text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RAISE EXCEPTION 'Coordina el pago en el chat y usa Marcar como completado'; END $$;
CREATE OR REPLACE FUNCTION public.payment_terms_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE entry_value jsonb;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.accepted_payment_methods IS NOT DISTINCT FROM OLD.accepted_payment_methods THEN RETURN NEW; END IF;
  IF OLD.status<>'draft' THEN RAISE EXCEPTION 'Las condiciones publicadas no pueden cambiar'; END IF;
 END IF;
 IF jsonb_typeof(NEW.accepted_payment_methods)<>'array' OR jsonb_array_length(NEW.accepted_payment_methods)>20 THEN RAISE EXCEPTION 'Métodos no válidos'; END IF;
 FOR entry_value IN SELECT r.value FROM jsonb_array_elements(NEW.accepted_payment_methods) r(value) LOOP
  IF length(trim(coalesce(entry_value->>'name',''))) NOT BETWEEN 2 AND 100 OR coalesce(entry_value->>'kind','') NOT IN ('bank','platform','wallet','crypto','other') THEN RAISE EXCEPTION 'Método no válido'; END IF;
  IF entry_value->>'kind'='crypto' AND (length(trim(coalesce(entry_value->>'asset','')))<2 OR length(trim(coalesce(entry_value->>'network','')))<2) THEN RAISE EXCEPTION 'Indica activo y red'; END IF;
 END LOOP;
 RETURN NEW;
END $$;