-- supabase/migrations/20261119000001_public_order_status.sql
-- Consulta pública do pedido por código, sem expor dados pessoais (LGPD).
-- A tabela `orders` tem RLS só para a dona; a vitrine anon usa esta função
-- security definer, que devolve apenas status, itens, datas e resumo financeiro
-- conferido — nunca endereço, telefone ou notas.

create or replace function public.public_order_status(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'public_code', o.public_code,
    'status', o.status,
    'scheduled_date', o.scheduled_date,
    'scheduled_time', o.scheduled_time,
    'total_cents', o.total_cents,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', item ->> 'name',
            'quantity', coalesce((item ->> 'quantity')::int, 1),
            'unit_price_cents', coalesce(
              (item ->> 'unitPriceCents')::int,
              (item ->> 'unit_price_cents')::int,
              0
            )
          )
        )
        from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
      ),
      '[]'::jsonb
    ),
    'paid_cents', coalesce(
      (
        select sum(p.amount_cents)
        from public.order_payments p
        where p.order_id = o.id
          and p.status = 'conferido'
      ),
      0
    )
  )
  from public.orders o
  where o.public_code is not null
    and lower(o.public_code) = lower(trim(p_code))
  limit 1;
$$;

revoke all on function public.public_order_status(text) from public;
grant execute on function public.public_order_status(text) to anon, authenticated;
