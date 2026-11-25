-- 1) Conteo final de registros cargados en CockroachDB
SELECT 'ubicaciones' AS tabla, COUNT(*) FROM ubicaciones
UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios;

-- 2) Usuarios sin consentimiento que conservan datos geograficos (debe dar 0)
SELECT COUNT(*) AS usuarios_con_geo_sin_consentimiento
FROM usuarios
WHERE consentimiento_datos = false
  AND (id_ubicacion IS NOT NULL OR latitud IS NOT NULL OR longitud IS NOT NULL);

-- 3) Muestra de usuarios sin consentimiento (ubicacion y coordenadas en NULL)
SELECT id_usuario, consentimiento_datos, id_ubicacion, latitud, longitud
FROM usuarios WHERE consentimiento_datos = false LIMIT 5;
