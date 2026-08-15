-- Admin puede mantener el catálogo y borrar entregas.
-- La app usa service role para estas operaciones; las policies cubren el camino autenticado.

create policy catalog_admin_types on public.requirement_types
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

create policy catalog_admin_templates on public.delivery_templates
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

create policy catalog_admin_template_requirements on public.template_requirements
  for all to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

create policy deliveries_delete_admin on public.deliveries
  for delete to authenticated
  using (public.current_role() = 'ADMIN');

create policy evidences_delete_admin on public.evidences
  for delete to authenticated
  using (public.current_role() = 'ADMIN');
