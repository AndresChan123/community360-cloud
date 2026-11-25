const express = require("express");
const { admin, firestore, pool } = require("../config/db");
const { requiereAuth, requiereRol } = require("../middleware/auth");

const router = express.Router();

const CANALES_MAP = {
  telegram: "Telegram",
  discord: "Discord",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  "twitter/x": "Twitter/X",
  twitter: "Twitter/X",
  x: "Twitter/X",
};
const CANALES_VALIDOS = ["Telegram", "Discord", "TikTok", "Instagram", "Facebook", "Twitter/X"];
const TIPOS_VALIDOS = ["mensaje", "comentario", "reaccion", "respuesta_encuesta", "rsvp_evento"];
const DISPOSITIVOS_MAP = {
  android: "Android",
  ios: "iOS",
  web: "Web",
  escritorio: "Escritorio",
};
const DISPOSITIVOS_VALIDOS = ["Android", "iOS", "Web", "Escritorio"];
const ETIQUETAS_VALIDAS = ["arte", "aviso", "evento", "humor", "juegos", "musica", "reglas"];
const RE_INTERACCION = /^I\d{7}$/;
const RE_USUARIO = /^U\d{6}$/;

function normalizarTimestampISO(ts) {
  if (!ts) return new Date().toISOString();
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Valida y normaliza el cuerpo de una interaccion para POST o PUT.
 * Nunca incluye pais, estado, ciudad, id_ubicacion ni consentimiento_autor.
 */
function validarPayloadInteraccion(body, esActualizacion = false, actual = null) {
  const errores = [];
  const base = actual ? { ...actual } : {};

  const rawUsuario = body.id_usuario !== undefined ? body.id_usuario : base.id_usuario;
  const id_usuario = String(rawUsuario || "").trim().toUpperCase();
  if (!RE_USUARIO.test(id_usuario)) {
    errores.push("id_usuario debe tener el formato U seguido de 6 dígitos (ej. U000176).");
  }

  const rawCanal = body.canal !== undefined ? body.canal : base.canal;
  const canalKey = String(rawCanal || "").trim().toLowerCase();
  const canal = CANALES_MAP[canalKey] || String(rawCanal || "").trim();
  if (!CANALES_VALIDOS.includes(canal)) {
    errores.push(`canal inválido. Valores permitidos: ${CANALES_VALIDOS.join(", ")}.`);
  }

  const rawTipo = body.tipo !== undefined ? body.tipo : base.tipo;
  const tipo = String(rawTipo || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!TIPOS_VALIDOS.includes(tipo)) {
    errores.push(`tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(", ")}.`);
  }

  const rawTema = body.tema !== undefined ? body.tema : base.tema;
  const tema = String(rawTema || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!tema) {
    errores.push("tema es obligatorio.");
  }

  const rawSent = body.sentimiento !== undefined ? body.sentimiento : base.sentimiento;
  const sentimientoNum = Number(rawSent);
  if (rawSent === undefined || rawSent === null || rawSent === "" || Number.isNaN(sentimientoNum) || sentimientoNum < -1 || sentimientoNum > 1) {
    errores.push("sentimiento debe ser un número decimal entre -1 y 1.");
  }
  const sentimiento = Number.isNaN(sentimientoNum) ? 0 : Math.round(sentimientoNum * 100) / 100;

  const rawDisp = body.dispositivo !== undefined ? body.dispositivo : base.dispositivo;
  const dispKey = String(rawDisp || "").trim().toLowerCase();
  const dispositivo = DISPOSITIVOS_MAP[dispKey] || String(rawDisp || "").trim();
  if (!DISPOSITIVOS_VALIDOS.includes(dispositivo)) {
    errores.push(`dispositivo inválido. Valores permitidos: ${DISPOSITIVOS_VALIDOS.join(", ")}.`);
  }

  let texto = body.texto !== undefined ? body.texto : base.texto;
  if (texto !== null && texto !== undefined) {
    texto = String(texto).trim();
    if (!texto) texto = null;
  } else {
    texto = null;
  }
  if (tipo === "reaccion" && texto === null) {
    texto = null;
  }

  let longitud_texto = 0;
  if (texto === null) {
    longitud_texto = 0;
  } else if (body.longitud_texto !== undefined) {
    const lt = Number(body.longitud_texto);
    if (!Number.isInteger(lt) || lt < 0) {
      errores.push("longitud_texto debe ser un entero mayor o igual a 0.");
    } else {
      longitud_texto = lt === 0 ? texto.length : lt;
    }
  } else {
    longitud_texto = texto.length;
  }

  const rawReac = body.reacciones_recibidas !== undefined
    ? body.reacciones_recibidas
    : (base.reacciones_recibidas !== undefined ? base.reacciones_recibidas : 0);
  const reacciones_recibidas = Number(rawReac);
  if (!Number.isInteger(reacciones_recibidas) || reacciones_recibidas < 0) {
    errores.push("reacciones_recibidas debe ser un entero mayor o igual a 0.");
  }

  const rawIdioma = body.idioma !== undefined ? body.idioma : (base.idioma || "es");
  const idioma = String(rawIdioma || "es").trim().toLowerCase() || "es";

  let rawEtiquetas = body.etiquetas !== undefined ? body.etiquetas : (base.etiquetas || []);
  if (typeof rawEtiquetas === "string") {
    rawEtiquetas = rawEtiquetas
      .split("|")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  const etiquetas = [];
  if (!Array.isArray(rawEtiquetas)) {
    errores.push("etiquetas debe ser un arreglo de strings o cadena separada por '|'.");
  } else {
    for (const item of rawEtiquetas) {
      const tag = String(item || "").trim().toLowerCase();
      if (!tag) continue;
      if (!ETIQUETAS_VALIDAS.includes(tag)) {
        errores.push(`etiqueta '${tag}' fuera del catálogo permitido (${ETIQUETAS_VALIDAS.join(", ")}).`);
      } else if (!etiquetas.includes(tag)) {
        etiquetas.push(tag);
      }
    }
  }

  let fechaObj = new Date();
  if (body.timestamp) {
    const parsed = new Date(body.timestamp);
    if (Number.isNaN(parsed.getTime())) {
      errores.push("timestamp tiene un formato de fecha inválido.");
    } else {
      fechaObj = parsed;
    }
  } else if (esActualizacion && base.timestamp) {
    fechaObj = typeof base.timestamp.toDate === "function"
      ? base.timestamp.toDate()
      : new Date(base.timestamp);
  }

  return {
    errores,
    documento: {
      id_usuario,
      timestamp: admin.firestore.Timestamp.fromDate(fechaObj),
      canal,
      tipo,
      texto,
      tema,
      sentimiento,
      idioma,
      dispositivo,
      longitud_texto,
      reacciones_recibidas,
      etiquetas,
    },
  };
}

function calcularMetricasDesdeLista(lista, estadoPorUsuario, version) {
  const por_tipo = {};
  const por_canal = {};
  const por_tema = {};
  const por_dispositivo = {};
  const por_etiqueta = {};
  const mapa_calor_estado = {};

  let sumaSentimiento = 0;
  let sumaReacciones = 0;
  let sumaLongitud = 0;
  let positivas = 0;
  let neutras = 0;
  let negativas = 0;

  for (const d of lista) {
    const sent = Number(d.sentimiento || 0);
    const reac = Number(d.reacciones_recibidas || 0);
    const long = Number(d.longitud_texto || 0);

    sumaSentimiento += sent;
    sumaReacciones += reac;
    sumaLongitud += long;

    if (sent > 0.2) positivas += 1;
    else if (sent < -0.2) negativas += 1;
    else neutras += 1;

    if (d.tipo) por_tipo[d.tipo] = (por_tipo[d.tipo] || 0) + 1;
    if (d.canal) por_canal[d.canal] = (por_canal[d.canal] || 0) + 1;
    if (d.tema) por_tema[d.tema] = (por_tema[d.tema] || 0) + 1;
    if (d.dispositivo) por_dispositivo[d.dispositivo] = (por_dispositivo[d.dispositivo] || 0) + 1;

    if (Array.isArray(d.etiquetas)) {
      for (const et of d.etiquetas) {
        por_etiqueta[et] = (por_etiqueta[et] || 0) + 1;
      }
    }

    const estadoAutor = estadoPorUsuario[d.id_usuario];
    if (estadoAutor) {
      mapa_calor_estado[estadoAutor] = (mapa_calor_estado[estadoAutor] || 0) + 1;
    }
  }

  lista.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const total = lista.length;
  const sentimiento_promedio = total ? Number((sumaSentimiento / total).toFixed(3)) : 0;
  const promedio_reacciones = total ? Number((sumaReacciones / total).toFixed(2)) : 0;
  const longitud_promedio_texto = total ? Number((sumaLongitud / total).toFixed(1)) : 0;
  const tasa_positiva_pct = total ? Number(((positivas / total) * 100).toFixed(1)) : 0;
  const tasa_negativa_pct = total ? Number(((negativas / total) * 100).toFixed(1)) : 0;

  return {
    version,
    total_interacciones: total,
    sentimiento_promedio,
    total_reacciones_recibidas: sumaReacciones,
    promedio_reacciones,
    longitud_promedio_texto,
    distribucion_sentimiento: {
      positivas,
      neutras,
      negativas,
      tasa_positiva_pct,
      tasa_negativa_pct,
    },
    por_tipo,
    por_canal,
    por_tema,
    por_dispositivo,
    por_etiqueta,
    mapa_calor_estado,
  };
}

/**
 * Recalcula todos los indicadores matematicos sobre la coleccion "interacciones" de Cloud Firestore
 * cruzando el estado geografico UNICAMENTE de los usuarios en CockroachDB con consentimiento_datos = true,
 * y persiste el resultado en Firestore (metricas_vivas/actuales).
 */
async function recalcularYGuardarMetricas() {
  const [interSnap, geoUsuariosQ, metricasActualesSnap] = await Promise.all([
    firestore.collection("interacciones").get(),
    pool.query(`
      SELECT u.id_usuario, ub.estado
      FROM usuarios u
      JOIN ubicaciones ub ON u.id_ubicacion = ub.id_ubicacion
      WHERE u.consentimiento_datos = true
    `),
    firestore.collection("metricas_vivas").doc("actuales").get(),
  ]);

  const estadoPorUsuario = {};
  for (const row of geoUsuariosQ.rows) {
    estadoPorUsuario[row.id_usuario] = row.estado;
  }

  const lista = interSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id_interaccion: doc.id,
      id_usuario: d.id_usuario,
      timestamp: normalizarTimestampISO(d.timestamp),
      canal: d.canal,
      tipo: d.tipo,
      texto: d.texto ?? null,
      tema: d.tema,
      sentimiento: Number(d.sentimiento || 0),
      idioma: d.idioma || "es",
      dispositivo: d.dispositivo,
      longitud_texto: Number(d.longitud_texto || 0),
      reacciones_recibidas: Number(d.reacciones_recibidas || 0),
      etiquetas: Array.isArray(d.etiquetas) ? d.etiquetas : [],
    };
  });

  const versionPrevia = metricasActualesSnap.exists
    ? Number(metricasActualesSnap.data().version || 1)
    : 0;

  const baseMetricas = calcularMetricasDesdeLista(lista, estadoPorUsuario, versionPrevia + 1);
  const nuevasMetricas = {
    ...baseMetricas,
    actualizado_en: admin.firestore.FieldValue.serverTimestamp(),
  };

  await firestore.collection("metricas_vivas").doc("actuales").set(nuevasMetricas);

  return {
    metricas: {
      ...baseMetricas,
      actualizado_en: new Date().toISOString(),
    },
    interacciones: lista,
  };
}

/**
 * GET /api/interacciones
 * Devuelve las metricas vivas calculadas y la lista de interacciones de Cloud Firestore.
 */
router.get("/", requiereAuth, async (req, res) => {
  try {
    const { canal, tipo, tema, limite = 50 } = req.query;
    const { metricas, interacciones } = await recalcularYGuardarMetricas();

    let filtradas = interacciones;
    if (canal) {
      filtradas = filtradas.filter((i) => i.canal.toLowerCase() === String(canal).toLowerCase());
    }
    if (tipo) {
      filtradas = filtradas.filter((i) => i.tipo.toLowerCase() === String(tipo).toLowerCase());
    }
    if (tema) {
      filtradas = filtradas.filter((i) => i.tema.toLowerCase() === String(tema).toLowerCase());
    }

    const lim = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 300);

    return res.status(200).json({
      total_interacciones: metricas.total_interacciones,
      total_filtradas: filtradas.length,
      metricas,
      interacciones: filtradas.slice(0, lim),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error al consultar las interacciones en Firestore.",
      detalle: err.message,
    });
  }
});

/**
 * POST /api/interacciones
 * Crea una nueva interaccion en Firestore (exclusivo desde Postman / cliente REST con rol admin),
 * valida integridad referencial de id_usuario contra CockroachDB, recalcula metricas_vivas/actuales
 * y emite la actualizacion en tiempo real por WebSockets.
 */
router.post("/", requiereAuth, requiereRol("admin"), async (req, res) => {
  try {
    let id_interaccion = String(req.body?.id_interaccion || "").trim().toUpperCase();
    if (!id_interaccion) {
      const randomDigits = String(Math.floor(1000000 + Math.random() * 9000000));
      id_interaccion = `I${randomDigits}`;
    }

    if (!RE_INTERACCION.test(id_interaccion)) {
      return res.status(400).json({
        error: "id_interaccion inválido. Debe tener el formato I seguido de 7 dígitos (ej. I0009001).",
      });
    }

    const { errores, documento } = validarPayloadInteraccion(req.body, false, null);
    if (errores.length > 0) {
      return res.status(400).json({
        error: "Datos de interacción inválidos.",
        detalles: errores,
      });
    }

    // 1) Verificar integridad referencial del usuario en CockroachDB Cloud
    const userQ = await pool.query(
      "SELECT id_usuario, alias, consentimiento_datos FROM usuarios WHERE id_usuario = $1",
      [documento.id_usuario]
    );
    if (userQ.rowCount === 0) {
      return res.status(422).json({
        error: `Integridad referencial: el usuario ${documento.id_usuario} no existe en el padrón de CockroachDB.`,
      });
    }

    // 2) Verificar que no exista previamente el id_interaccion en Cloud Firestore
    const docRef = firestore.collection("interacciones").doc(id_interaccion);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      return res.status(409).json({
        error: `La interacción ${id_interaccion} ya existe en Firestore. Usa PUT /api/interacciones/${id_interaccion} para modificarla.`,
      });
    }

    // 3) Guardar documento en Firestore (sin pais, estado, ciudad, id_ubicacion ni consentimiento_autor)
    await docRef.set(documento);

    // 4) Recalcular metricas_vivas/actuales y emitir por WebSocket
    const { metricas, interacciones } = await recalcularYGuardarMetricas();
    const interaccionCreada = {
      id_interaccion,
      ...documento,
      timestamp: documento.timestamp.toDate().toISOString(),
    };

    const emitirEventoWS = req.app.get("emitirEventoWS");
    if (typeof emitirEventoWS === "function") {
      emitirEventoWS("interaccion_creada", {
        operacion: "POST",
        id_interaccion,
        interaccion: interaccionCreada,
        metricas,
        interacciones_recientes: interacciones.slice(0, 30),
      });
    }

    return res.status(201).json({
      mensaje: "Interacción creada exitosamente en Firestore y difundida por WebSocket.",
      interaccion: interaccionCreada,
      metricas_actualizadas: {
        version: metricas.version,
        total_interacciones: metricas.total_interacciones,
        sentimiento_promedio: metricas.sentimiento_promedio,
        total_reacciones_recibidas: metricas.total_reacciones_recibidas,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error al crear la interacción.",
      detalle: err.message,
    });
  }
});

/**
 * PUT /api/interacciones/:id
 * Modifica una interaccion existente en Firestore, recalcula metricas_vivas/actuales
 * y notifica en tiempo real a los clientes WebSocket conectados.
 */
router.put("/:id", requiereAuth, requiereRol("admin"), async (req, res) => {
  try {
    const id_interaccion = String(req.params.id || "").trim().toUpperCase();
    if (!RE_INTERACCION.test(id_interaccion)) {
      return res.status(400).json({
        error: "El parámetro :id debe tener el formato I seguido de 7 dígitos (ej. I0004013).",
      });
    }

    const docRef = firestore.collection("interacciones").doc(id_interaccion);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({
        error: `No se encontró la interacción ${id_interaccion} en Firestore.`,
      });
    }

    const actual = docSnap.data();
    const { errores, documento } = validarPayloadInteraccion(req.body, true, actual);
    if (errores.length > 0) {
      return res.status(400).json({
        error: "Datos de actualización inválidos.",
        detalles: errores,
      });
    }

    if (documento.id_usuario !== actual.id_usuario) {
      const userQ = await pool.query(
        "SELECT id_usuario FROM usuarios WHERE id_usuario = $1",
        [documento.id_usuario]
      );
      if (userQ.rowCount === 0) {
        return res.status(422).json({
          error: `Integridad referencial: el usuario ${documento.id_usuario} no existe en CockroachDB.`,
        });
      }
    }

    await docRef.set(documento);

    const { metricas, interacciones } = await recalcularYGuardarMetricas();
    const interaccionActualizada = {
      id_interaccion,
      ...documento,
      timestamp: documento.timestamp.toDate().toISOString(),
    };

    const emitirEventoWS = req.app.get("emitirEventoWS");
    if (typeof emitirEventoWS === "function") {
      emitirEventoWS("interaccion_actualizada", {
        operacion: "PUT",
        id_interaccion,
        interaccion: interaccionActualizada,
        metricas,
        interacciones_recientes: interacciones.slice(0, 30),
      });
    }

    return res.status(200).json({
      mensaje: "Interacción actualizada exitosamente en Firestore y difundida por WebSocket.",
      interaccion: interaccionActualizada,
      metricas_actualizadas: {
        version: metricas.version,
        total_interacciones: metricas.total_interacciones,
        sentimiento_promedio: metricas.sentimiento_promedio,
        total_reacciones_recibidas: metricas.total_reacciones_recibidas,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error al actualizar la interacción.",
      detalle: err.message,
    });
  }
});

/**
 * DELETE /api/interacciones/:id
 * Elimina una interaccion de Firestore, recalcula metricas_vivas/actuales
 * y emite el evento por WebSockets para reflejar el cambio en el dashboard sin recargar.
 */
router.delete("/:id", requiereAuth, requiereRol("admin"), async (req, res) => {
  try {
    const id_interaccion = String(req.params.id || "").trim().toUpperCase();
    if (!RE_INTERACCION.test(id_interaccion)) {
      return res.status(400).json({
        error: "El parámetro :id debe tener el formato I seguido de 7 dígitos (ej. I0004013).",
      });
    }

    const docRef = firestore.collection("interacciones").doc(id_interaccion);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({
        error: `No se encontró la interacción ${id_interaccion} en Firestore.`,
      });
    }

    const eliminada = docSnap.data();
    await docRef.delete();

    const { metricas, interacciones } = await recalcularYGuardarMetricas();

    const emitirEventoWS = req.app.get("emitirEventoWS");
    if (typeof emitirEventoWS === "function") {
      emitirEventoWS("interaccion_eliminada", {
        operacion: "DELETE",
        id_interaccion,
        interaccion_eliminada: {
          id_interaccion,
          id_usuario: eliminada.id_usuario,
          canal: eliminada.canal,
          tipo: eliminada.tipo,
          tema: eliminada.tema,
          sentimiento: eliminada.sentimiento,
        },
        metricas,
        interacciones_recientes: interacciones.slice(0, 30),
      });
    }

    return res.status(200).json({
      mensaje: `Interacción ${id_interaccion} eliminada de Firestore y métricas recalculadas en vivo.`,
      id_interaccion,
      metricas_actualizadas: {
        version: metricas.version,
        total_interacciones: metricas.total_interacciones,
        sentimiento_promedio: metricas.sentimiento_promedio,
        total_reacciones_recibidas: metricas.total_reacciones_recibidas,
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error al eliminar la interacción.",
      detalle: err.message,
    });
  }
});

module.exports = router;
