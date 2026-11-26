require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const authRoutes = require("./src/routes/auth.routes");
const historicoRoutes = require("./src/routes/historico.routes");
const interaccionesRoutes = require("./src/routes/interacciones.routes");
const {
  requiereAuth,
  protegerRutaDashboard,
  validarTokenYObtenerAdmin,
} = require("./src/middleware/auth");

const app = express();
const server = http.createServer(app);

// Proteccion global del proceso para que errores transitorios de red nunca tumben la instancia en Render
process.on("unhandledRejection", (reason) => {
  console.warn("[Proceso] Promesa rechazada controlada:", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Proceso] Excepcion controlada:", err?.message || err);
});

app.use(express.json({ limit: "256kb" }));

// Endpoint ultraligero de salud (<1ms) para Render Health Check y Keep-Alive anti-hibernacion
app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    servicio: "community360-cloud",
    uptime_s: Math.round(process.uptime()),
  });
});

// Rutas REST (Fases 3 y 4)
app.use("/api/auth", authRoutes);
app.use("/api/historico", historicoRoutes);
app.use("/api/interacciones", interaccionesRoutes);

// Endpoint REST protegido de verificacion de estado
app.get("/api/estado", requiereAuth, (req, res) => {
  res.status(200).json({
    ok: true,
    mensaje: "Endpoint REST protegido verificado con Firebase Admin SDK y Firestore (administradores).",
    usuario: req.usuario,
  });
});

// Rutas de vistas HTML
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/dashboard", protegerRutaDashboard, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Archivos estaticos (CSS, JS y texturas 3D de alta resolucion)
app.use("/css", express.static(path.join(__dirname, "public", "css")));
app.use("/js", express.static(path.join(__dirname, "public", "js")));
app.use("/textures", express.static(path.join(__dirname, "public", "textures"), { maxAge: "7d" }));

// Servidor WebSocket con validacion de token Firebase Admin SDK + coleccion administradores (Fase 5)
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", async (request, socket, head) => {
  try {
    const urlObj = new URL(request.url, `http://${request.headers.host}`);
    if (urlObj.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    let token = urlObj.searchParams.get("token");
    if (!token && request.headers.authorization?.startsWith("Bearer ")) {
      token = request.headers.authorization.slice(7).trim();
    }
    if (!token && request.headers.cookie) {
      const m = request.headers.cookie.match(/(?:^|;\s*)c360_token=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }

    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const usuario = await validarTokenYObtenerAdmin(token);

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.usuario = usuario;
      wss.emit("connection", ws, request);
    });
  } catch (_err) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.send(
    JSON.stringify({
      evento: "conectado",
      mensaje: "Conexión WebSocket autenticada con Firebase Admin SDK",
      usuario: {
        uid: ws.usuario.uid,
        email: ws.usuario.email,
        rol: ws.usuario.rol,
      },
      timestamp: new Date().toISOString(),
    })
  );
});

// Heartbeat WebSocket cada 25 segundos para que el balanceador de Render no cierre conexiones inactivas
const wsHeartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (_err) {}
  }
}, 25000);
wsHeartbeatInterval.unref();

// Funcion auxiliar para emitir eventos a todos los clientes WebSocket conectados (Fase 5)
function emitirEventoWS(evento, payload) {
  const mensaje = JSON.stringify({
    evento,
    datos: payload,
    timestamp: new Date().toISOString(),
  });
  for (const cliente of wss.clients) {
    if (cliente.readyState === 1) {
      cliente.send(mensaje);
    }
  }
}

app.set("emitirEventoWS", emitirEventoWS);

const PORT = Number(process.env.PORT || 3000);
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Servidor Community 360 ejecutándose en http://localhost:${PORT}`);

    // Auto Keep-Alive cada 9 minutos para evitar que el plan gratuito de Render hiberne el servicio tras 15 min
    const externalUrl =
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.RENDER ? "https://community360-cloud.onrender.com" : null);

    if (externalUrl) {
      const keepAliveTimer = setInterval(async () => {
        try {
          await fetch(`${externalUrl}/healthz`);
        } catch (_err) {}
      }, 9 * 60 * 1000);
      keepAliveTimer.unref();
    }
  });
}

module.exports = { app, server, wss, emitirEventoWS };
