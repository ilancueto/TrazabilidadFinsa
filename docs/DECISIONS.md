# Decisiones

## Observación no es un estado

`WITH_OBSERVATION` no entra en la máquina. Es `deliveries.has_open_observation` + texto en `observations`.

Motivo: una entrega puede estar En Picking o Lista y tener una observación al mismo tiempo. Mezclarlo en el estado rompe READY/CLOSED.

Eventos: `OBSERVATION_ADDED`, `OBSERVATION_RESOLVED`.

## Storage local = Supabase Storage

Hasta que exista cuenta cloud / storage corporativo, el adapter apunta a Supabase local. El código no asume un bucket público ni URLs eternas.

## Roles

El signup público no existe. El trigger crea perfiles como `PICKING`. El seed (service role) promueve a Ilan a `ADMIN`. Nadie puede cambiar su rol desde el cliente.

## Evidencias

Varias fotos por requisito. No hay delete: sólo void. El archivo se intenta mover a `voided/`.

## Compresión

En el cliente, lado largo 1800 px, JPEG 0.82, antes de subir. El server vuelve a validar MIME y tamaño.

## Offline

No se finge. Cola offline queda para fase 2.
