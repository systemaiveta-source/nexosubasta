CREATE OR REPLACE FUNCTION public.completion_stage_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF ((NEW.buyer_confirmed AND NOT OLD.buyer_confirmed) OR (NEW.seller_confirmed AND NOT OLD.seller_confirmed)) AND OLD.payment_stage<>'completion_pending' THEN RAISE EXCEPTION 'Completa la coordinación, pago y entrega antes de confirmar la finalización'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER completion_stage_guard BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.completion_stage_guard();