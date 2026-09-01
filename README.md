# Pestañas Ana

Tienda única mobile-first para pestañas, maquillaje y accesorios de belleza, con pedidos por WhatsApp.

## Stack

- Next.js + TypeScript
- Supabase Database + RLS
- Supabase Auth con email/password
- Supabase Storage
- Tailwind CSS

## Arranque local

1. Crear un proyecto en Supabase y ejecutar la migración de `supabase/migrations/` desde el SQL Editor o con Supabase CLI.

2. Crear el bucket `catalog-media` y las políticas incluidas en la migración.

3. Crear el primer usuario administrador desde Supabase Authentication → Users.

4. Copiar variables:

   ```bash
   cp .env.example .env.local
   ```

5. Instalar dependencias:

   ```bash
   pnpm install
   ```

6. Si usás Supabase CLI local, iniciar la base, generar tipos y cargar datos demo:

   ```bash
   pnpm supabase:start
   pnpm supabase:reset
   pnpm supabase:types
   ```

7. Iniciar app:

   ```bash
   pnpm dev
   ```

El acceso administrativo es cerrado: no hay registro público. El usuario creado en Supabase debe tener una fila correspondiente en `public.stores.owner_id`; `supabase/seed.sql` puede crear una tienda demo para el primer usuario local.

## Rutas

- `/`: catálogo público.
- `/login`: acceso del administrador.
- `/gestion`: productos, pedidos y configuración.
- `/{slug}/product/{productSlug}`: página SEO de producto.
