alter table public.products enable row level security;

drop policy if exists "Allow public read products" on public.products;
create policy "Allow public read products"
on public.products
for select
to anon
using (true);

drop policy if exists "Allow public insert products" on public.products;
create policy "Allow public insert products"
on public.products
for insert
to anon
with check (true);

drop policy if exists "Allow public update products" on public.products;
create policy "Allow public update products"
on public.products
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public delete products" on public.products;
create policy "Allow public delete products"
on public.products
for delete
to anon
using (true);
