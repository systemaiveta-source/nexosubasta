-- Complete event-driven push for private operations without changing auction settlement.
-- Existing process_auctions() remains the sole authority for deciding winners and creating transactions.

CREATE OR REPLACE FUNCTION public.decorate_operation_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  operation_row public.transactions;
BEGIN
  IF NEW.link !~ '^/operaciones/[0-9a-fA-F-]{36}$' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO operation_row
  FROM public.transactions
  WHERE id = substring(NEW.link FROM 13)::uuid;

  IF operation_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = operation_row.buyer_id THEN
    NEW.title := '¡Ganaste la subasta!';
    NEW.body := format(
      'Adjudicación confirmada por %s %s. El chat privado con el vendedor ya está disponible.',
      operation_row.amount,
      operation_row.currency
    );
    NEW.event_kind := 'auction_won';
  ELSIF NEW.user_id = operation_row.seller_id THEN
    NEW.title := 'Subasta adjudicada';
    NEW.body := format(
      'Tu artículo fue adjudicado por %s %s. El chat privado con el comprador ya está disponible.',
      operation_row.amount,
      operation_row.currency
    );
    NEW.event_kind := 'auction_sold';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS decorate_operation_notification ON public.notifications;
CREATE TRIGGER decorate_operation_notification
BEFORE INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.decorate_operation_notification();

CREATE OR REPLACE FUNCTION public.notify_private_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  operation_row public.transactions;
  recipient_id uuid;
  auction_title text;
BEGIN
  SELECT * INTO operation_row
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  IF operation_row.id IS NULL OR operation_row.status NOT IN ('pending', 'disputed') THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id = operation_row.buyer_id THEN
    recipient_id := operation_row.seller_id;
  ELSIF NEW.sender_id = operation_row.seller_id THEN
    recipient_id := operation_row.buyer_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT title INTO auction_title
  FROM public.auctions
  WHERE id = operation_row.auction_id;

  -- Deliberately omit message contents from lock-screen previews to avoid exposing
  -- account numbers, payment links, addresses, or other private coordination data.
  INSERT INTO public.notifications(user_id, title, body, link, event_kind)
  VALUES (
    recipient_id,
    'Nuevo mensaje privado',
    'Tienes un nuevo mensaje sobre: ' || coalesce(auction_title, 'tu operación en NEXO'),
    '/operaciones/' || operation_row.id,
    'chat_message'
  );

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS notify_private_message_recipient ON public.messages;
CREATE TRIGGER notify_private_message_recipient
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_private_message_recipient();

COMMENT ON FUNCTION public.decorate_operation_notification() IS
  'Adds winner/seller-specific copy and final amount to existing transaction notifications; does not settle auctions.';
COMMENT ON FUNCTION public.notify_private_message_recipient() IS
  'Notifies only the other participant of a private operation message; message body is never sent to push previews.';
