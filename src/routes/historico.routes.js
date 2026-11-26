const express = require("express");
const { pool, firestore } = require("../config/db");
const { requiereAuth } = require("../middleware/auth");

const router = express.Router();

// Cache en memoria de 45 segundos para el resumen historico analitico,
// evitando saturar CockroachDB Serverless y la memoria de Render en recargas continuas.
let cacheResumenData = null;
let cacheResumenExpira = 0;
const RESUMEN_CACHE_TTL_MS = 45000;

/**
 * GET /api/historico/resumen
 * Consulta analitica historica consumida directamente desde CockroachDB Cloud (ubicaciones y usuarios)
 * y Cloud Firestore (bitacora_etl y cuarentena_interacciones).
 */
router.get("/resumen", requiereAuth, async (req, res) => {
  try {
    if (cacheResumenData && Date.now() < cacheResumenExpira) {
      return res.status(200).json(cacheResumenData);
    }
    const [
      totalesQ,
      estatusQ,
      plataformaQ,
      interesQ,
      edadQ,
      estadosGeoQ,
      riesgoQ,
      privacidadCeroQ,
      muestraSinConsentimientoQ,
      bitacoraSnap,
      cuarentenaCountSnap,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::INT AS total_usuarios,
          COUNT(*) FILTER (WHERE es_artista = true)::INT AS total_artistas,
          COUNT(*) FILTER (WHERE consentimiento_datos = true)::INT AS con_consentimiento,
          COUNT(*) FILTER (WHERE consentimiento_datos = false)::INT AS sin_consentimiento,
          ROUND(AVG(sentimiento_promedio)::NUMERIC, 3)::FLOAT AS sentimiento_promedio_usuarios,
          SUM(mensajes_30d)::INT AS total_mensajes_30d,
          SUM(eventos_asistidos)::INT AS total_eventos_asistidos
        FROM usuarios
      `),
      pool.query(`
        SELECT estatus, COUNT(*)::INT AS total
        FROM usuarios
        GROUP BY estatus
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT plataforma_principal AS plataforma, COUNT(*)::INT AS total
        FROM usuarios
        GROUP BY plataforma_principal
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT interes_principal AS interes, COUNT(*)::INT AS total
        FROM usuarios
        GROUP BY interes_principal
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT rango_edad, COUNT(*)::INT AS total
        FROM usuarios
        GROUP BY rango_edad
        ORDER BY rango_edad ASC
      `),
      pool.query(`
        SELECT ub.pais, ub.estado, ub.ciudad, COUNT(u.id_usuario)::INT AS usuarios
        FROM ubicaciones ub
        LEFT JOIN usuarios u ON u.id_ubicacion = ub.id_ubicacion AND u.consentimiento_datos = true
        GROUP BY ub.id_ubicacion, ub.pais, ub.estado, ub.ciudad
        ORDER BY usuarios DESC, ub.pais ASC, ub.estado ASC
      `),
      pool.query(`
        SELECT
          u.id_usuario,
          u.alias,
          u.plataforma_principal,
          u.interes_principal,
          u.mensajes_30d,
          u.reacciones_30d,
          u.sentimiento_promedio::FLOAT AS sentimiento_promedio,
          u.ultima_actividad::TEXT AS ultima_actividad,
          u.estatus,
          u.consentimiento_datos,
          CASE WHEN u.consentimiento_datos THEN ub.ciudad ELSE NULL END AS ciudad,
          CASE WHEN u.consentimiento_datos THEN ub.estado ELSE NULL END AS estado
        FROM usuarios u
        LEFT JOIN ubicaciones ub ON u.id_ubicacion = ub.id_ubicacion
        WHERE u.estatus = 'en_riesgo'
        ORDER BY u.ultima_actividad ASC, u.sentimiento_promedio ASC
        LIMIT 15
      `),
      pool.query(`
        SELECT COUNT(*)::INT AS violaciones
        FROM usuarios
        WHERE consentimiento_datos = false
          AND (id_ubicacion IS NOT NULL OR latitud IS NOT NULL OR longitud IS NOT NULL)
      `),
      pool.query(`
        SELECT id_usuario, alias, consentimiento_datos, id_ubicacion, latitud, longitud
        FROM usuarios
        WHERE consentimiento_datos = false
        ORDER BY id_usuario ASC
        LIMIT 5
      `),
      firestore.collection("bitacora_etl").get(),
      firestore.collection("cuarentena_interacciones").count().get(),
    ]);

    const bitacora = bitacoraSnap.docs.map((d) => ({
      id_ejecucion: d.id,
      ...d.data(),
    }));
    const totalCuarentena = cuarentenaCountSnap.data().count;

    const porEstatus = {};
    for (const r of estatusQ.rows) porEstatus[r.estatus] = r.total;

    const porPlataforma = {};
    for (const r of plataformaQ.rows) porPlataforma[r.plataforma] = r.total;

    const porInteres = {};
    for (const r of interesQ.rows) porInteres[r.interes] = r.total;

    const porRangoEdad = {};
    for (const r of edadQ.rows) porRangoEdad[r.rango_edad] = r.total;

    const payload = {
      resumen_usuarios: totalesQ.rows[0],
      por_estatus: porEstatus,
      por_plataforma: porPlataforma,
      por_interes: porInteres,
      por_rango_edad: porRangoEdad,
      catalogo_ubicaciones: estadosGeoQ.rows,
      usuarios_en_riesgo: riesgoQ.rows,
      privacidad: {
        usuarios_sin_consentimiento_con_geo: privacidadCeroQ.rows[0].violaciones,
        muestra_anonimizados: muestraSinConsentimientoQ.rows,
      },
      auditoria_etl: {
        total_cuarentena_firestore: totalCuarentena,
        bitacora_etl: bitacora,
      },
    };

    cacheResumenData = payload;
    cacheResumenExpira = Date.now() + RESUMEN_CACHE_TTL_MS;

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({
      error: "Error al consultar métricas históricas en la nube.",
      detalle: err.message,
    });
  }
});

/**
 * GET /api/historico/usuarios
 * Lista filtrable de usuarios desde CockroachDB Cloud respetando la regla de privacidad geografica.
 */
router.get("/usuarios", requiereAuth, async (req, res) => {
  try {
    const { estatus, plataforma, consentimiento, limite = 25 } = req.query;
    const params = [];
    const condiciones = [];

    if (estatus && ["activo", "en_riesgo", "inactivo"].includes(estatus)) {
      params.push(estatus);
      condiciones.push(`u.estatus = $${params.length}`);
    }
    if (plataforma) {
      params.push(plataforma);
      condiciones.push(`u.plataforma_principal = $${params.length}`);
    }
    if (consentimiento === "true" || consentimiento === "false") {
      params.push(consentimiento === "true");
      condiciones.push(`u.consentimiento_datos = $${params.length}`);
    }

    const lim = Math.min(Math.max(parseInt(limite, 10) || 25, 1), 100);
    params.push(lim);

    const whereSql = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const sql = `
      SELECT
        u.id_usuario,
        u.alias,
        u.fecha_ingreso::TEXT AS fecha_ingreso,
        u.rango_edad,
        u.especie_fursona,
        u.interes_principal,
        u.plataforma_principal,
        u.es_artista,
        u.mensajes_30d,
        u.reacciones_30d,
        u.eventos_asistidos,
        u.comisiones_compradas,
        u.sentimiento_promedio::FLOAT AS sentimiento_promedio,
        u.ultima_actividad::TEXT AS ultima_actividad,
        u.estatus,
        u.consentimiento_datos,
        u.id_ubicacion,
        u.latitud::FLOAT AS latitud,
        u.longitud::FLOAT AS longitud,
        CASE WHEN u.consentimiento_datos THEN ub.ciudad ELSE NULL END AS ciudad,
        CASE WHEN u.consentimiento_datos THEN ub.estado ELSE NULL END AS estado,
        CASE WHEN u.consentimiento_datos THEN ub.pais ELSE NULL END AS pais
      FROM usuarios u
      LEFT JOIN ubicaciones ub ON u.id_ubicacion = ub.id_ubicacion
      ${whereSql}
      ORDER BY u.id_usuario ASC
      LIMIT $${params.length}
    `;

    const result = await pool.query(sql, params);
    return res.status(200).json({
      total_devueltos: result.rows.length,
      usuarios: result.rows,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error al consultar el padrón de usuarios en CockroachDB Cloud.",
      detalle: err.message,
    });
  }
});

module.exports = router;
