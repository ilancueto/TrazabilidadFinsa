-- EXPAND: nuevo valor de modalidad. No usarlo en este archivo (ADD VALUE no es usable
-- en la misma transacción). ANDREANI permanece en el enum como valor legado.

alter type public.delivery_modality add value if not exists 'DESPACHO';
