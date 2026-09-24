# SPIKE: Cloudflare R2 para Evidencias

Este documento describe la arquitectura, configuración y validación del spike de integración de **Cloudflare R2** para el almacenamiento de binarios de evidencias en la aplicación *Trazabilidad de Entregas — Finning CAT*.

> **ESTADO DEL SPIKE**: Completado en branch de spike (`spike/r2-evidence-storage`).
> **ENTORNO DE PRODUCCIÓN**: Intacto. Sin cutover, sin migración remota aplicada y sin cambios de variables de producción.

---

## 1. Contexto y Objetivos

- **Motivo**: Reducción de costos de transferencia y cuota de almacenamiento de binarios (imágenes y thumbnails) en Supabase Storage, migrando exclusivamente los archivos de evidencias a Cloudflare R2 (S3-compatible, con 10 GB gratuitos y egress a costo cero).
- **Alcance**:
  - Implementación del adaptador `R2EvidenceStorage` conforme a la interfaz `EvidenceStorage`.
  - Factory con soporte dual: `getEvidenceStorage()` (default por variable de entorno) y `getEvidenceStorageForProvider(provider)` (`supabase` | `r2`).
  - **Dual-read**: Lecturas determinan el almacenamiento basándose en la columna `provider` registrada en cada evidencia (`evidences.provider`).
  - **Escritura selectiva**: Cuando `EVIDENCE_STORAGE_PROVIDER=r2`, las nuevas evidencias se suben a Cloudflare R2 y se persisten en base de datos con `provider = 'R2'`.
  - Migración draft para `register_evidence` y `register_evidence_v2` con parámetro `p_provider` y constraint `evidences_provider_check`.

---

## 2. Setup en Cloudflare R2

### 2.1 Crear el Bucket
1. Ingresar al dashboard de Cloudflare: `R2 Object Storage` -> `Create bucket`.
2. Asignar el nombre del bucket (ej. `cat-evidences`).
3. Ubicación: Seleccionar `Automatic` o la región geográfica más cercana (ej. `WNAM` o `EEUR`).

### 2.2 Crear el API Token
1. En el panel de R2, ir a `Manage R2 API Tokens` -> `Create API token`.
2. Permisos:
   - **Object Read & Write**: Necesario para subir (`PutObject`), leer (`GetObject`), anular (`CopyObject` / `DeleteObject`) y eliminar (`DeleteObject`).
   - Aplicar al bucket específico (ej. `cat-evidences`).
3. TTL / Expiración: Configurar según las políticas de seguridad corporativas (o permanente con rotación periódica).
4. Guardar los valores generados:
   - `Account ID` (visible en el dashboard de R2 o URL)
   - `Access Key ID`
   - `Secret Access Key`

### 2.3 CORS (Opcional si no hay uploads directos por browser)
Actualmente los uploads van a través de la API server-side de Next.js (`/api/evidence`). Si en el futuro se implementaran direct browser uploads vía presigned PUT, configurar CORS en el bucket:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://*.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 3. Variables de Entorno

Configurar en `.env.local` para pruebas de desarrollo:

```bash
# Provider activo para escrituras: "supabase" (default) o "r2"
EVIDENCE_STORAGE_PROVIDER=r2

# Credenciales de Cloudflare R2
R2_ACCOUNT_ID=tu_account_id_de_cloudflare
R2_ACCESS_KEY_ID=tu_access_key_id
R2_SECRET_ACCESS_KEY=tu_secret_access_key
R2_BUCKET=cat-evidences

# Opcional (se infiere automáticamente como https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com)
# R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

---

## 4. Arquitectura de Implementación

### 4.1 Adaptador R2 (`src/lib/storage/r2-adapter.ts`)
Implementa la interfaz `EvidenceStorage`:
- `upload({ key, bytes, mimeType })`: Ejecuta `PutObjectCommand` con `Buffer.from(bytes)` y `ContentType`.
- `getAuthorizedUrl(key, expiresInSeconds)`: Genera una URL prefirmada temporal usando `getSignedUrl` de `@aws-sdk/s3-request-presigner` con `GetObjectCommand`.
- `download(key)`: Descarga el binario vía `GetObjectCommand` y `response.Body.transformToByteArray()`.
- `void(key)`: En S3/R2 no existe un comando atómico `move`. Realiza `CopyObjectCommand` hacia la ruta `voidedKey(key)` y luego `DeleteObjectCommand` sobre la ruta original. Si falla la copia, registra el error en observabilidad sin interrumpir la operación de negocio.
- `remove(key)`: Elimina tanto `key` como `voidedKey(key)` mediante `DeleteObjectCommand`.

### 4.2 Factory y Dual-Read (`src/lib/storage/index.ts`)
- `getEvidenceStorageForProvider(provider)`:
  - Normaliza a minúsculas (`supabase` -> `SupabaseEvidenceStorage`, `r2` -> `R2EvidenceStorage`).
  - Lanza error controlado si el proveedor no es reconocido.
  - Mantiene instancias en caché (singletons) para reutilizar conexiones HTTP y SDK.
- `getEvidenceStorage()`:
  - Resuelve el proveedor por defecto configurado en `process.env.EVIDENCE_STORAGE_PROVIDER ?? "supabase"`.

### 4.3 Puntos de Lectura Dual (Dual-Read)
1. **Endpoint de archivo de evidencia (`src/app/api/evidence/[id]/file/route.ts`)**:
   - Consulta `provider` en `evidences`.
   - Llama a `getEvidenceStorageForProvider(data.provider).getAuthorizedUrl(...)`.
   - Redirige al cliente a la URL prefirmada (Supabase Storage o Cloudflare R2).
2. **Generación de URLs firmadas en lote (`src/lib/evidence/urls.ts`)**:
   - `signedEvidenceUrls` y `signedEvidenceUrlMap` reciben `provider` de cada fila y delegan a su storage respectivo.
3. **Descarga de entregas en ZIP (`src/app/api/deliveries/export-zip/route.ts`)**:
   - Para cada evidencia activa se invoca `getEvidenceStorageForProvider(ev.provider).download(ev.storage_key)`.
4. **Generación de informe PDF (`src/app/admin/deliveries/[id]/report/route.ts`)**:
   - La lista de fotos a renderizar incluye `provider`, y la descarga concurrente usa el adapter específico de cada fila.
5. **Anulación de evidencias (`src/lib/actions/evidence.ts`)**:
   - Obtiene `provider` de la evidencia y anula en el storage correspondiente (`getEvidenceStorageForProvider(evidence.provider).void(...)`).

### 4.4 Escritura y Persistencia (`src/lib/evidence/persist.ts`)
- Si `EVIDENCE_STORAGE_PROVIDER=r2`, la imagen y su thumbnail se suben a Cloudflare R2 a través de `getEvidenceStorage()`.
- Se invoca `register_evidence_v2` pasando `p_provider: 'R2'`.
- Si `EVIDENCE_STORAGE_PROVIDER=supabase` (o no definido), `p_provider` no se envía, manteniendo compatibilidad transparente con bases de datos donde la migración aún no haya sido aplicada.

### 4.5 Migración de Base de Datos (`supabase/migrations/20260924155658_register_evidence_provider_param.sql`)
- Agrega constraint `check (provider in ('SUPABASE', 'R2'))` en la tabla `public.evidences`.
- Reemplaza `register_evidence` y `register_evidence_v2` incorporando el parámetro `p_provider text default 'SUPABASE'`.
- Notar que el trigger de verificación de storage existente (`validate_evidence_storage_binding`) ya contenía la cláusula `if new.provider <> 'SUPABASE' then return new; end if;`, por lo que las evidencias de R2 no requieren objetos en `storage.objects` de Supabase.

---

## 5. Cómo Probar Localmente

### 5.1 Pruebas Unitarias Automatizadas (sin credenciales reales)
```bash
npm run test:unit
npm run typecheck
```
Los tests mockean el cliente S3 y verifican los comandos de subida, descarga, prefirmado, copia/anulación y borrado, así como el comportamiento del factory con ambos proveedores.

### 5.2 Prueba Manual con Bucket Real de Cloudflare R2
1. Crear un bucket de prueba en Cloudflare y generar un API token R2 con permisos de lectura y escritura.
2. En `.env.local`:
   ```bash
   EVIDENCE_STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=<tu_account_id>
   R2_ACCESS_KEY_ID=<tu_access_key>
   R2_SECRET_ACCESS_KEY=<tu_secret_key>
   R2_BUCKET=<tu_bucket>
   ```
3. En la base de datos local (Supabase local):
   Aplicar la migración draft:
   ```bash
   npx supabase migration up
   ```
4. Iniciar la aplicación:
   ```bash
   npm run dev
   ```
5. Subir una evidencia desde la interfaz de Picking o Detalle de Entrega.
6. Verificar en el dashboard de Cloudflare R2 que el archivo y su thumbnail aparecen en la ruta correspondiente (ej. `2026/09/DEL-001/REMITO/...`).
7. Abrir la entrega y comprobar que la imagen se visualiza correctamente en el visor y se descarga en el reporte PDF y en el ZIP exportado.

---

## 6. Qué NO Está Hecho (Exclusiones Explícitas del Spike)

1. **NO aplicado a Supabase Remoto**: La migración `20260924155658_register_evidence_provider_param.sql` permanece como draft local.
2. **NO hay cutover en Producción**: Producción continúa operando al 100% sobre Supabase Storage (`EVIDENCE_STORAGE_PROVIDER=supabase`).
3. **NO hay migración de datos históricos (Backfill)**: Las fotos existentes en Supabase Storage no han sido copiadas a R2. El diseño dual-read permite que coexistan indefinidamente sin necesidad de migración inmediata.
4. **NO hay subida directa cliente->R2 (Direct Uploads)**: Las cargas continúan pasando por el servidor Next.js para normalización de imágenes, redimensionado y generación de thumbnails WebP con `sharp`.
