const express = require("express");
const { admin, firestore, auth } = require("../config/db");
const { requiereAuth, validarTokenYObtenerAdmin } = require("../middleware/auth");

const router = express.Router();

// Permite autenticarse escribiendo el usuario docente ("lizandro.reyes") o su correo completo
const ALIAS_USUARIOS = {
  "lizandro.reyes": "lizandro.reyes@utmetropolitana.edu.mx",
  admin: "admin@community360.mx",
  lector: "lector@community360.mx",
};

function normalizarIdentificador(identificador) {
  const limpio = String(identificador || "").trim().toLowerCase();
  if (ALIAS_USUARIOS[limpio]) {
    return ALIAS_USUARIOS[limpio];
  }
  if (!limpio.includes("@") && limpio.length > 0) {
    return `${limpio}@utmetropolitana.edu.mx`;
  }
  return limpio;
}

/**
 * POST /api/auth/login
 * Valida las credenciales contra Firebase Authentication (hash scrypt seguro en la nube),
 * verifica el ID Token con Firebase Admin SDK, consulta el rol en Firestore ("administradores")
 * y actualiza "ultimo_acceso".
 */
router.post("/login", async (req, res) => {
  try {
    const rawUser = req.body?.email || req.body?.usuario || "";
    const email = normalizarIdentificador(rawUser);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        error: "Debes proporcionar tu usuario o correo electrónico y tu contraseña.",
      });
    }

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "Falta configurar FIREBASE_WEB_API_KEY en las variables de entorno del servidor.",
      });
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.idToken) {
      return res.status(401).json({
        error: "Credenciales inválidas. Verifica tu usuario/correo y contraseña.",
      });
    }

    // Verificar el ID Token con Firebase Admin SDK y consultar coleccion "administradores" en Firestore
    const usuario = await validarTokenYObtenerAdmin(data.idToken);

    // Actualizar ultimo_acceso en Firestore
    await firestore.collection("administradores").doc(usuario.uid).update({
      ultimo_acceso: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Guardar cookie HttpOnly para proteger la ruta /dashboard en el navegador
    const maxAgeMs = Number(data.expiresIn || 3600) * 1000;
    res.cookie("c360_token", data.idToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: maxAgeMs,
      path: "/",
    });

    return res.status(200).json({
      mensaje: "Autenticación exitosa",
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: Number(data.expiresIn || 3600),
      usuario: {
        uid: usuario.uid,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error:
        status === 403
          ? err.message
          : "Error al procesar el inicio de sesión.",
    });
  }
});

/**
 * GET /api/auth/sesion
 * Verifica el ID Token activo con el Admin SDK y devuelve el perfil y rol desde "administradores".
 */
router.get("/sesion", requiereAuth, async (req, res) => {
  return res.status(200).json({
    autenticado: true,
    usuario: {
      uid: req.usuario.uid,
      email: req.usuario.email,
      rol: req.usuario.rol,
    },
  });
});

/**
 * POST /api/auth/logout
 * Revoca los tokens de refresco en Firebase Auth y limpia la cookie de sesion.
 */
router.post("/logout", requiereAuth, async (req, res) => {
  try {
    await auth.revokeRefreshTokens(req.usuario.uid);
  } catch (_err) {
    // Continuar con limpieza de cookie
  }
  res.clearCookie("c360_token", { path: "/" });
  return res.status(200).json({
    mensaje: "Sesión cerrada correctamente.",
  });
});

module.exports = router;
