const { auth, firestore } = require("../config/db");

/**
 * Extrae el ID Token de Firebase del encabezado Authorization: Bearer <token>
 * o de la cookie HttpOnly c360_token (para proteccion de rutas del navegador).
 */
function extraerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)c360_token=([^;]+)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return null;
}

// Cache en memoria de corta duracion (25s) para evitar rafagas de llamadas duplicadas
// a Firebase Auth + Firestore cuando el dashboard carga 5 recursos simultaneamente.
// Se limpia inmediatamente al hacer POST /api/auth/logout para respetar la revocacion de tokens.
const tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 25000;

function invalidarCacheToken(uid, token) {
  if (token) tokenCache.delete(token);
  if (uid) {
    for (const [k, v] of tokenCache.entries()) {
      if (v.usuario?.uid === uid) tokenCache.delete(k);
    }
  }
}

/**
 * Verifica el ID Token con Firebase Admin SDK (incluyendo comprobacion de revocacion)
 * y consulta el rol en la coleccion "administradores" de Cloud Firestore (ID = uid).
 */
async function validarTokenYObtenerAdmin(token) {
  const ahora = Date.now();
  const enCache = tokenCache.get(token);
  if (enCache && enCache.expira > ahora) {
    return enCache.usuario;
  }

  const decoded = await auth.verifyIdToken(token, true);
  const docSnap = await firestore.collection("administradores").doc(decoded.uid).get();

  if (!docSnap.exists) {
    const err = new Error("El usuario no está autorizado en la colección administradores de Firestore.");
    err.statusCode = 403;
    throw err;
  }

  const datos = docSnap.data();
  const rol = datos.rol;
  if (!["admin", "lector"].includes(rol)) {
    const err = new Error("El rol del usuario en administradores no es válido.");
    err.statusCode = 403;
    throw err;
  }

  const usuario = {
    uid: decoded.uid,
    email: datos.email || decoded.email,
    rol,
    creado_en: datos.creado_en || null,
    ultimo_acceso: datos.ultimo_acceso || null,
  };

  if (tokenCache.size > 100) tokenCache.clear();
  tokenCache.set(token, { usuario, expira: ahora + TOKEN_CACHE_TTL_MS });
  return usuario;
}

/**
 * Middleware para proteger todos los endpoints REST con Firebase Admin SDK + Firestore administradores.
 */
async function requiereAuth(req, res, next) {
  const token = extraerToken(req);
  if (!token) {
    return res.status(401).json({
      error: "No autorizado. Se requiere un token de autenticación válido (Bearer token).",
    });
  }

  try {
    const usuario = await validarTokenYObtenerAdmin(token);
    req.usuario = usuario;
    req.token = token;
    return next();
  } catch (err) {
    const status = err.statusCode || 401;
    return res.status(status).json({
      error:
        status === 403
          ? err.message
          : "Token de autenticación inválido, expirado o revocado.",
    });
  }
}

/**
 * Middleware para restringir operaciones por rol ("admin" para escritura, "admin" | "lector" para lectura).
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "Usuario no autenticado." });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(" o ")}. Tu rol actual es: ${req.usuario.rol}.`,
      });
    }
    return next();
  };
}

/**
 * Middleware para proteger la ruta HTML /dashboard en el navegador.
 */
async function protegerRutaDashboard(req, res, next) {
  const token = extraerToken(req);
  if (!token) {
    return res.redirect("/login");
  }
  try {
    req.usuario = await validarTokenYObtenerAdmin(token);
    return next();
  } catch (_err) {
    res.clearCookie("c360_token", { path: "/" });
    return res.redirect("/login");
  }
}

module.exports = {
  extraerToken,
  validarTokenYObtenerAdmin,
  invalidarCacheToken,
  requiereAuth,
  requiereRol,
  protegerRutaDashboard,
};
