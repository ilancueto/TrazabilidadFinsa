# Backup local v0.9-baseline

Copia lógica del estado productivo al tag `v0.9-baseline`. No sustituye PITR de Supabase. La clave de cifrado **no** se versiona ni se escribe en este documento.

## Contenido

| Parte | Ubicación (gitignored) | Notas |
| --- | --- | --- |
| Plano (datos + evidencias) | `archivos/backups/2026-08-20-v0.9-baseline/` | Se conserva hasta una decisión explícita de borrado. |
| Dump SQL | `.../database/data.sql` | 768 196 bytes. |
| Evidencias | `.../evidences/` | 466 archivos de imagen (232 jpg, 231 webp, 3 jpeg). |
| Tar plano | `archivos/backups/2026-08-20-v0.9-baseline.tar` | Empaquetado con `tar.exe` de Windows. |
| Cifrado | `archivos/backups/2026-08-20-v0.9-baseline.tar.aesgcm` | AES-256-GCM. |
| Clave | `archivos/backups/keys/v0.9-baseline.key` | 32 bytes. Sólo lectura para el usuario local. |

Árbol plano verificado: **467** archivos, **127 357 599** bytes.

## Método

1. Generar clave: `node scripts/backup-crypto.mjs keygen --out archivos/backups/keys/v0.9-baseline.key`
2. Empaquetar: `node scripts/backup-crypto.mjs pack --src archivos/backups/2026-08-20-v0.9-baseline --tar archivos/backups/2026-08-20-v0.9-baseline.tar`
3. Cifrar: `node scripts/backup-crypto.mjs encrypt --in ...tar --out ...tar.aesgcm --key ...key`
4. Verificar: `node scripts/backup-crypto.mjs verify --src <dir-plano> --tar ...tar --enc ...tar.aesgcm --key ...key`

El archivo `.aesgcm` lleva encabezado `CAT1`, IV de 12 bytes, ciphertext y tag GCM de 16 bytes. El script no imprime la clave.

## Integridad (2026-08-21)

Verificación ejecutada contra el plano original: el tar descifrado coincidió; el árbol extraído coincidió en cantidad de archivos y en el hash del inventario.

| Objeto | SHA-256 |
| --- | --- |
| `data.sql` | `6fea2cd0c4d4d67b8ed2a3208821e4f43403f37c6fd8cef86b76c138a52a9494` |
| Inventario de archivos (rutas relativas + hash por archivo) | `1b55251db4724a9b5c1383f64459c1d682cd6c413ea4e22c3c43ce36e6cba4fe` |
| Tar plano | `b7cc459862c3fa1898aa5702c8a6e967ae591b732ea22cead2314b6893fcecf5` |
| Tar cifrado `.aesgcm` | `0c305fa968812cba72583a5800e7b675cfdc90ee6a0e3923c982d88c832c8fd6` |

El plano **no** se borró.

## Recuperación

En una carpeta vacía, fuera de producción:

```text
node scripts/backup-crypto.mjs decrypt --in archivos/backups/2026-08-20-v0.9-baseline.tar.aesgcm --out restored.tar --key archivos/backups/keys/v0.9-baseline.key
tar -xf restored.tar
```

Comprobar `sha256` de `data.sql` y el inventario (`verify` si el plano de referencia sigue disponible). Restaurar el SQL y las evidencias sólo en un proyecto Supabase aislado. No importar este dump sobre producción.

Si se pierde la clave, el `.aesgcm` no es recuperable. Copiar la clave a un gestor de secretos o medio offline separado del ciphertext. No adjuntarla al repositorio ni a tickets.

## Retención

| Ítem | Política |
| --- | --- |
| Copia cifrada + clave | Conservar hasta publicar `v1.0.0` **y** existir otro backup cifrado verificado. Mínimo 180 días desde 2026-08-20 (hasta 2027-02-16). |
| Tar plano y directorio plano | Conservar mientras no haya otra verificación de restauración. Este cambio no los elimina. |
| Copias intermedias de `verify` | El script las borra al terminar. |
| Ubicación | Disco local del operador, gitignored (`archivos/`, `*.aesgcm`). No subir a Vercel ni al remoto Git. |

Un backup sin `verify` exitoso no se considera operativo. El simulacro periódico sigue en `docs/RUNBOOK.md`.
