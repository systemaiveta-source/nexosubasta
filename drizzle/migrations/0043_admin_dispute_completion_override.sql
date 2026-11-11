-- Allow an explicit staff dispute decision to complete an operation without
-- fabricating buyer/seller acceptances or confirmations. Normal completion
-- remains subject to every existing guard.
CREATE OR REPLACE FUNCTION public.closed_operation_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  staff_dispute_resolution boolean :=
    coalesce(current_setting('nexo.admin_dispute_resolution', true), '') = 'on'
    AND public.is_staff(auth.uid());
BEGIN
  IF OLD.status='completed' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Operación cerrada definitivamente';
  END IF;

  IF NEW.status='completed' AND OLD.status<>'completed' THEN
    IF EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.transaction_id=NEW.id AND d.status='open'
    ) THEN
      RAISE EXCEPTION 'No se puede completar mientras exista una disputa abierta';
    END IF;

    IF NOT staff_dispute_resolution AND (
      NOT NEW.buyer_confirmed
      OR NOT NEW.seller_confirmed
      OR NEW.buyer_payment_accepted_at IS NULL
      OR NEW.seller_payment_accepted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Faltan aceptaciones, confirmaciones o existe una disputa';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_dispute(
  _dispute uuid,
  _status text,
  _resolution text,
  _tx_status text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  d public.disputes;
  t public.transactions;
  staff_override boolean := false;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF _status NOT IN ('resolved','rejected')
     OR _tx_status NOT IN ('pending','completed','cancelled') THEN
    RAISE EXCEPTION 'Valor no válido';
  END IF;
  IF _tx_status='completed' AND _status<>'resolved' THEN
    RAISE EXCEPTION 'Solo una disputa resuelta puede marcar la operación como completada';
  END IF;
  IF length(trim(coalesce(_resolution,''))) < 5 THEN
    RAISE EXCEPTION 'La resolución debe explicar la decisión';
  END IF;

  SELECT * INTO d FROM public.disputes WHERE id=_dispute FOR UPDATE;
  IF d.id IS NULL OR d.status<>'open' THEN
    RAISE EXCEPTION 'Disputa no abierta';
  END IF;

  SELECT * INTO t FROM public.transactions WHERE id=d.transaction_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Operación no encontrada';
  END IF;

  -- Close the dispute first so the transaction guard can verify there is no
  -- remaining open case. All changes are atomic within this function call.
  UPDATE public.disputes
  SET status=_status,
      resolution=trim(_resolution),
      resolved_by=auth.uid(),
      resolved_at=clock_timestamp()
  WHERE id=d.id;

  staff_override := _tx_status='completed';
  IF staff_override THEN
    PERFORM set_config('nexo.admin_dispute_resolution','on',true);
  END IF;

  UPDATE public.transactions
  SET status=_tx_status,
      completed_at=CASE
        WHEN _tx_status='completed' THEN clock_timestamp()
        ELSE completed_at
      END
  WHERE id=t.id
  RETURNING * INTO t;

  IF staff_override THEN
    PERFORM set_config('nexo.admin_dispute_resolution','off',true);
  END IF;

  INSERT INTO public.admin_audit_log(actor_id,action,target,details)
  VALUES (
    auth.uid(),
    'resolve_dispute',
    d.id::text,
    jsonb_build_object(
      'status',_status,
      'tx_status',_tx_status,
      'resolution',trim(_resolution),
      'admin_completion_override',staff_override
    )
  );

  PERFORM public.notify(t.buyer_id,'Disputa resuelta',trim(_resolution),'/operaciones/'||t.id);
  PERFORM public.notify(t.seller_id,'Disputa resuelta',trim(_resolution),'/operaciones/'||t.id);
END $$;
