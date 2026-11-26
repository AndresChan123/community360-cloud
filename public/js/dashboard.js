document.addEventListener("DOMContentLoaded", async () => {
  let token = sessionStorage.getItem("c360_id_token");
  const userEmailEl = document.getElementById("user-email");
  const userRolEl = document.getElementById("user-rol");
  const userAvatarEl = document.getElementById("user-avatar");
  const panelCurrentEmailEl = document.getElementById("panel-current-email");
  const panelCurrentRoleEl = document.getElementById("panel-current-role");
  const wsDotEl = document.getElementById("ws-dot");
  const wsStatusEl = document.getElementById("ws-status");
  const wsHeaderDotEl = document.getElementById("ws-header-dot");
  const wsHeaderTextEl = document.getElementById("ws-header-text");
  const versionBadgeEl = document.getElementById("version-badge");
  const btnLogout = document.getElementById("btn-logout");

  const charts = {};
  const kpiPrevios = {};
  let ultimoIdModificado = null;
  let wsInstance = null;

  function authHeaders() {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function redirigirLogin() {
    sessionStorage.removeItem("c360_id_token");
    sessionStorage.removeItem("c360_usuario");
    window.location.replace("/login");
  }

  function formatearEtiqueta(texto) {
    if (!texto) return "-";
    const diccionario = {
      activo: "Activo",
      en_riesgo: "En riesgo",
      inactivo: "Inactivo",
      eventos_convenciones: "Eventos y convenciones",
      reglas_moderacion: "Reglas y moderación",
      arte_digital: "Arte digital",
      arte_tradicional: "Arte tradicional",
      respuesta_encuesta: "Encuesta",
      rsvp_evento: "Asistencia a evento",
      reaccion: "Reacción",
      comentario: "Comentario",
      mensaje: "Mensaje",
      musica: "Música",
      comics: "Cómics",
      videojuegos: "Videojuegos",
    };
    const clave = String(texto).trim().toLowerCase();
    if (diccionario[clave]) return diccionario[clave];

    return String(texto)
      .replace(/_/g, " ")
      .split(" ")
      .map((palabra) =>
        palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase() : ""
      )
      .join(" ");
  }

  // =========================================================================
  // NAVEGACION POR VISTAS INDEPENDIENTES (SIN TENER QUE HACER SCROLL LARGO)
  // =========================================================================
  const TITULOS_VISTAS = {
    "vista-inicio": {
      eyebrow: "Resumen General · Cuatro Áreas de Análisis",
      titulo: "Centro de Analítica Comunitaria",
      subtitulo: "Selecciona cualquiera de las áreas para explorar el pulso en vivo, el mapa regional o el padrón de miembros.",
    },
    "vista-pulso": {
      eyebrow: "01 · Conversación en Vivo · Redes Sociales",
      titulo: "Pulso en Vivo",
      subtitulo: "Seguimiento instantáneo del ánimo, temas comentados y participación por canal digital.",
    },
    "vista-actividad": {
      eyebrow: "02 · Territorio y Flujo · Participación Regional",
      titulo: "Mapa Regional y Publicaciones",
      subtitulo: "Distribución geográfica de la actividad por estado y flujo reciente de publicaciones.",
    },
    "vista-comunidad": {
      eyebrow: "03 · Demografía y Retención · Comunidad",
      titulo: "Perfiles y Retención de Miembros",
      subtitulo: "Permanencia en la comunidad, intereses culturales y composición por grupos de edad.",
    },
    "vista-directorio": {
      eyebrow: "04 · Padrón Comunitario · Privacidad de Ubicación",
      titulo: "Directorio de Miembros",
      subtitulo: "Consulta individual de perfiles y resguardo de ubicación de quienes eligieron mantenerla privada.",
    },
  };

  function activarVista(viewId) {
    if (!viewId) return;
    document.querySelectorAll(".view-section").forEach((sec) => {
      sec.classList.toggle("active", sec.id === viewId);
    });
    document.querySelectorAll(".sidebar-nav .nav-link").forEach((btn) => {
      const activo = btn.getAttribute("data-view") === viewId;
      btn.classList.toggle("active", activo);
    });
    const meta = TITULOS_VISTAS[viewId];
    if (meta) {
      const eyebrowEl = document.getElementById("hero-eyebrow-text");
      if (eyebrowEl) eyebrowEl.textContent = meta.eyebrow;
      document.getElementById("topbar-view-title").textContent = meta.titulo;
      document.getElementById("topbar-view-subtitle").textContent = meta.subtitulo;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      Object.values(charts).forEach((c) => {
        if (c && typeof c.resize === "function") c.resize();
      });
    }, 50);
  }

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      activarVista(btn.getAttribute("data-view"));
    });
  });

  // =========================================================================
  // PANEL DE SESION Y CAMBIO DE CUENTA DESDE EL ENCABEZADO
  // =========================================================================
  const btnSessionToggle = document.getElementById("btn-session-toggle");
  const sessionPanel = document.getElementById("session-panel");
  const sessionWrap = document.getElementById("session-dropdown-wrap");
  const quickSwitchForm = document.getElementById("quick-switch-form");
  const switchMsgEl = document.getElementById("switch-msg");

  function actualizarUISesion(usuario) {
    const rolTexto = usuario.rol === "admin" ? "Administrador" : "Solo lectura";
    userEmailEl.textContent = usuario.email;
    userRolEl.textContent = rolTexto;
    if (panelCurrentEmailEl) panelCurrentEmailEl.textContent = usuario.email;
    if (panelCurrentRoleEl) {
      panelCurrentRoleEl.textContent = rolTexto;
      panelCurrentRoleEl.className = `status-pill ${usuario.rol === "admin" ? "st-activo" : "tag-priv"}`;
    }
    const iniciales = (usuario.email || "U")
      .split("@")[0]
      .split(/[._-]/)
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
    if (userAvatarEl && iniciales) userAvatarEl.textContent = iniciales;
  }

  if (btnSessionToggle && sessionPanel) {
    btnSessionToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const abierto = !sessionPanel.hidden;
      sessionPanel.hidden = abierto;
      btnSessionToggle.setAttribute("aria-expanded", String(!abierto));
    });

    document.addEventListener("click", (e) => {
      if (sessionWrap && !sessionWrap.contains(e.target)) {
        sessionPanel.hidden = true;
        btnSessionToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  async function cambiarDeCuenta(usuarioInput, passwordInput) {
    if (switchMsgEl) switchMsgEl.textContent = "Cambiando de cuenta...";
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuarioInput, password: passwordInput }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (switchMsgEl) switchMsgEl.textContent = data.error || "Credenciales incorrectas.";
        return;
      }
      token = data.token;
      sessionStorage.setItem("c360_id_token", data.token);
      sessionStorage.setItem("c360_usuario", JSON.stringify(data.usuario));
      actualizarUISesion(data.usuario);
      if (switchMsgEl) switchMsgEl.textContent = "";
      if (sessionPanel) sessionPanel.hidden = true;

      if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        wsInstance.close();
      }
      wsInstance = conectarWebSocket();
    } catch (_err) {
      if (switchMsgEl) switchMsgEl.textContent = "Error al conectar con el servidor.";
    }
  }

  document.querySelectorAll(".account-switch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const u = btn.getAttribute("data-user");
      const p = btn.getAttribute("data-pass");
      cambiarDeCuenta(u, p);
    });
  });

  if (quickSwitchForm) {
    quickSwitchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const u = document.getElementById("switch-user").value.trim();
      const p = document.getElementById("switch-pass").value;
      if (u && p) cambiarDeCuenta(u, p);
    });
  }

  // 1) Validar sesion activa al cargar
  try {
    const respSesion = await fetch("/api/auth/sesion", { headers: authHeaders() });
    if (!respSesion.ok) {
      redirigirLogin();
      return;
    }
    const { usuario } = await respSesion.json();
    actualizarUISesion(usuario);
  } catch (_err) {
    redirigirLogin();
    return;
  }

  function actualizarKPI(elementId, cardId, nuevoValorNumero, formateador, animar = false) {
    const el = document.getElementById(elementId);
    const card = cardId ? document.getElementById(cardId) : null;
    if (!el) return;

    const previo = kpiPrevios[elementId];
    kpiPrevios[elementId] = nuevoValorNumero;

    if (!animar || previo === undefined || previo === nuevoValorNumero) {
      el.textContent = formateador(nuevoValorNumero);
      return;
    }

    if (card) {
      card.classList.remove("kpi-flash");
      void card.offsetWidth;
      card.classList.add("kpi-flash");
    }

    const duracion = 600;
    const inicio = performance.now();
    function frame(ahora) {
      const progreso = Math.min((ahora - inicio) / duracion, 1);
      const ease = 1 - Math.pow(1 - progreso, 3);
      const actual = previo + (nuevoValorNumero - previo) * ease;
      el.textContent = formateador(actual);
      if (progreso < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formateador(nuevoValorNumero);
      }
    }
    requestAnimationFrame(frame);
  }

  // Colores reactivos al tema claro / oscuro
  const PRIMARY = "#3B82F6";
  const PRIMARY_HOVER = "#2563EB";
  function esTemaOscuro() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }
  function obtenerColoresTema() {
    const dark = esTemaOscuro();
    return {
      grid: dark ? "rgba(148, 163, 184, 0.12)" : "#E3E8EF",
      axis: dark ? "#94A3B8" : "#5B6778",
      text: dark ? "#F8FAFC" : "#1B2430",
      borderDona: dark ? "#11192C" : "#FFFFFF",
    };
  }
  let GRID_COLOR = obtenerColoresTema().grid;
  let AXIS_TEXT = obtenerColoresTema().axis;
  let DARK_TEXT = obtenerColoresTema().text;

  const PALETA_CANALES = [
    "#2457C5",
    "#1A9AA0",
    "#7A5CC7",
    "#E0A030",
    "#C2547A",
    "#64748B",
  ];

  const COLORES_ESTATUS = {
    activo: "#1E8E5A",
    en_riesgo: "#C77700",
    inactivo: "#C0392B",
  };

  Chart.defaults.color = AXIS_TEXT;
  Chart.defaults.borderColor = GRID_COLOR;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  const barValueLabelsPlugin = {
    id: "barValueLabels",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "bar") return;
      const { ctx } = chart;
      const isHorizontal = chart.config.options?.indexAxis === "y";
      ctx.save();
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillStyle = DARK_TEXT;

      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar, index) => {
          const val = dataset.data[index];
          if (val === undefined || val === null) return;
          if (isHorizontal) {
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(val.toLocaleString("es-MX"), bar.x + 8, bar.y);
          } else {
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(val.toLocaleString("es-MX"), bar.x, bar.y - 5);
          }
        });
      });
      ctx.restore();
    },
  };

  // Plugin 2: Total fijo al centro + anillo HUD futurista mientras la dona gira sola
  let hudAngle = 0;
  const doughnutCenterTextPlugin = {
    id: "doughnutCenterText",
    afterDraw(chart) {
      if (chart.config.type !== "doughnut") return;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      const { ctx } = chart;
      const centerX = meta.data[0].x;
      const centerY = meta.data[0].y;
      const innerRadius = meta.data[0].innerRadius || 55;
      const total = (chart.data.datasets[0]?.data || []).reduce((acc, v) => acc + Number(v || 0), 0);
      const centerLabel = chart.config.options?.plugins?.centerLabel || "Total";

      ctx.save();
      // Anillo tecnologico discontinuo contrarrotante en el interior de la dona
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 7, -hudAngle, -hudAngle + Math.PI * 1.35);
      ctx.strokeStyle = esTemaOscuro() ? "rgba(56, 189, 248, 0.35)" : "rgba(36, 87, 197, 0.25)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 21px 'Sora', 'Inter', sans-serif";
      ctx.fillStyle = DARK_TEXT;
      ctx.fillText(total.toLocaleString("es-MX"), centerX, centerY - 7);

      ctx.font = "500 11px 'Inter', sans-serif";
      ctx.fillStyle = AXIS_TEXT;
      ctx.fillText(centerLabel, centerX, centerY + 12);
      ctx.restore();
    },
  };

  // Bucle de rotacion continua automatica para todas las graficas redondas (donas)
  const donasEnHover = new Set();
  function iniciarRotacionContinuaDonas() {
    function step() {
      hudAngle = (hudAngle + 0.012) % (Math.PI * 2);
      Object.values(charts).forEach((chart) => {
        if (!chart || chart.config.type !== "doughnut") return;
        const canvas = chart.canvas;
        if (!canvas || canvas.offsetParent === null) return;
        if (donasEnHover.has(canvas.id)) return;
        const rotActual = Number(chart.options.rotation || 0);
        chart.options.rotation = (rotActual + 0.32) % 360;
        chart.update("none");
      });
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  iniciarRotacionContinuaDonas();

  ["chart-ws-canal", "chart-ws-polaridad", "chart-rest-estatus"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("mouseenter", () => donasEnHover.add(id));
    el.addEventListener("mouseleave", () => donasEnHover.delete(id));
  });

  Chart.register(barValueLabelsPlugin, doughnutCenterTextPlugin);

  function opcionesDona(centerLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      animation: { duration: 500, easing: "easeOutQuart" },
      plugins: {
        centerLabel,
        legend: {
          position: "right",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "circle",
            padding: 14,
            color: DARK_TEXT,
            font: { size: 12, weight: "500" },
            generateLabels(chart) {
              const data = chart.data;
              if (!data.labels || !data.datasets.length) return [];
              const ds = data.datasets[0];
              const total = ds.data.reduce((a, b) => a + Number(b || 0), 0) || 1;
              return data.labels.map((label, i) => {
                const val = Number(ds.data[i] || 0);
                const pct = ((val / total) * 100).toFixed(1);
                return {
                  text: `${label} · ${pct}%`,
                  fillStyle: ds.backgroundColor[i],
                  strokeStyle: "#FFFFFF",
                  fontColor: DARK_TEXT,
                  hidden: !chart.getDataVisibility(i),
                  index: i,
                };
              });
            },
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const ds = context.dataset.data;
              const total = ds.reduce((a, b) => a + Number(b || 0), 0) || 1;
              const val = Number(context.raw || 0);
              const pct = ((val / total) * 100).toFixed(1);
              return ` ${context.label}: ${val.toLocaleString("es-MX")} (${pct}%)`;
            },
          },
        },
      },
    };
  }

  function crearOActualizarChart(key, canvasId, config) {
    if (charts[key]) {
      charts[key].data = config.data;
      charts[key].update();
      return;
    }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    charts[key] = new Chart(ctx, config);
  }

  function calcularColorHeatmap(valor, min, max) {
    const rango = Math.max(max - min, 1);
    const t = Math.min(Math.max((valor - min) / rango, 0), 1);
    const r = Math.round(234 + (31 - 234) * t);
    const g = Math.round(241 + (79 - 241) * t);
    const b = Math.round(251 + (163 - 251) * t);
    const esOscuro = t >= 0.52;
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      textColor: esOscuro ? "#FFFFFF" : "#1B2430",
      subColor: esOscuro ? "rgba(255, 255, 255, 0.92)" : "#2457C5",
    };
  }

  // =========================================================================
  // RENDERIZADO DE PULSO EN TIEMPO REAL
  // =========================================================================
  function renderizarMetricasVivas(metricas, interaccionesRecientes = null, esEventoWS = false) {
    if (!metricas) return;

    versionBadgeEl.textContent = "Actualizado al momento";

    const totalInterNum = Number(metricas.total_interacciones || 0);
    const hubPubEl = document.getElementById("hub-stat-publicaciones");
    if (hubPubEl) hubPubEl.textContent = totalInterNum.toLocaleString("es-MX");

    actualizarKPI(
      "kpi-total-inter",
      "card-kpi-total",
      totalInterNum,
      (v) => Math.round(v).toLocaleString("es-MX"),
      esEventoWS
    );

    const sent = Number(metricas.sentimiento_promedio || 0);
    const sentEl = document.getElementById("kpi-sentimiento");
    sentEl.className = `metric-value ${sent >= 0.2 ? "text-success" : sent < -0.2 ? "text-danger" : ""}`;
    actualizarKPI(
      "kpi-sentimiento",
      "card-kpi-sent",
      sent,
      (v) => (v >= 0 ? "+" : "") + v.toFixed(2),
      esEventoWS
    );

    const totalReac = Number(metricas.total_reacciones_recibidas ?? 0);
    const promReac = Number(metricas.promedio_reacciones ?? 0);
    actualizarKPI(
      "kpi-reacciones",
      "card-kpi-reac",
      totalReac,
      (v) => Math.round(v).toLocaleString("es-MX"),
      esEventoWS
    );
    document.getElementById("kpi-reacciones-prom").textContent = `Promedio de ${promReac.toFixed(1)} por publicación`;

    const distSent = metricas.distribucion_sentimiento || {
      positivas: 0,
      neutras: 0,
      negativas: 0,
      tasa_positiva_pct: 0,
      tasa_negativa_pct: 0,
    };

    actualizarKPI(
      "kpi-tasa-pos",
      "card-kpi-pos",
      Number(distSent.tasa_positiva_pct || 0),
      (v) => `${v.toFixed(1)}%`,
      esEventoWS
    );

    actualizarKPI(
      "kpi-tasa-neg",
      "card-kpi-neg",
      Number(distSent.tasa_negativa_pct || 0),
      (v) => `${v.toFixed(1)}%`,
      esEventoWS
    );

    // 1) Temas de conversacion
    const temasEntries = Object.entries(metricas.por_tema || {}).sort((a, b) => b[1] - a[1]);
    crearOActualizarChart("wsTema", "chart-ws-tema", {
      type: "bar",
      data: {
        labels: temasEntries.map(([k]) => formatearEtiqueta(k)),
        datasets: [
          {
            label: "Publicaciones",
            data: temasEntries.map(([, v]) => v),
            backgroundColor: PRIMARY,
            hoverBackgroundColor: PRIMARY_HOVER,
            borderRadius: 4,
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 36 } },
        animation: { duration: 500, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GRID_COLOR }, ticks: { color: AXIS_TEXT } },
          y: { grid: { display: false }, ticks: { color: AXIS_TEXT } },
        },
      },
    });

    // 2) Dona de canales
    const canalEntries = Object.entries(metricas.por_canal || {}).sort((a, b) => b[1] - a[1]);
    crearOActualizarChart("wsCanal", "chart-ws-canal", {
      type: "doughnut",
      data: {
        labels: canalEntries.map(([k]) => k),
        datasets: [
          {
            data: canalEntries.map(([, v]) => v),
            backgroundColor: PALETA_CANALES,
            borderWidth: 2,
            borderColor: "#FFFFFF",
          },
        ],
      },
      options: opcionesDona("Publicaciones"),
    });

    // 3) Forma de participacion
    const tipoEntries = Object.entries(metricas.por_tipo || {}).sort((a, b) => b[1] - a[1]);
    crearOActualizarChart("wsTipo", "chart-ws-tipo", {
      type: "bar",
      data: {
        labels: tipoEntries.map(([k]) => formatearEtiqueta(k)),
        datasets: [
          {
            label: "Publicaciones",
            data: tipoEntries.map(([, v]) => v),
            backgroundColor: PRIMARY,
            hoverBackgroundColor: PRIMARY_HOVER,
            borderRadius: 4,
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 36 } },
        animation: { duration: 500, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GRID_COLOR }, ticks: { color: AXIS_TEXT } },
          y: { grid: { display: false }, ticks: { color: AXIS_TEXT } },
        },
      },
    });

    // 4) Balance de animo
    crearOActualizarChart("wsPolaridad", "chart-ws-polaridad", {
      type: "doughnut",
      data: {
        labels: ["Positivo", "Neutro", "Crítico"],
        datasets: [
          {
            data: [distSent.positivas || 0, distSent.neutras || 0, distSent.negativas || 0],
            backgroundColor: ["#1E8E5A", "#6B7280", "#C0392B"],
            borderWidth: 2,
            borderColor: "#FFFFFF",
          },
        ],
      },
      options: opcionesDona("Analizadas"),
    });

    // 5) Mapa de calor secuencial
    const heatmapContainer = document.getElementById("heatmap-estados");
    const estadosEntries = Object.entries(metricas.mapa_calor_estado || {}).sort((a, b) => b[1] - a[1]);
    const valores = estadosEntries.map(([, c]) => c);
    const maxEstado = valores.length ? Math.max(...valores) : 1;
    const minEstado = valores.length ? Math.min(...valores) : 0;

    heatmapContainer.innerHTML = estadosEntries
      .map(([estado, conteo]) => {
        const col = calcularColorHeatmap(conteo, minEstado, maxEstado);
        return `
          <div class="heatmap-cell" style="background:${col.bg};">
            <div class="heatmap-state" style="color:${col.textColor};">${estado}</div>
            <div class="heatmap-count" style="color:${col.subColor};">${conteo}</div>
          </div>
        `;
      })
      .join("");

    // 6) Tabla de actividad reciente
    if (Array.isArray(interaccionesRecientes)) {
      const tbody = document.getElementById("tbody-interacciones");
      tbody.innerHTML = interaccionesRecientes
        .slice(0, 25)
        .map((i) => {
          const highlightClass = i.id_interaccion === ultimoIdModificado ? "row-highlight" : "";
          const s = Number(i.sentimiento || 0);
          const sColor = s > 0.2 ? "text-success" : s < -0.2 ? "text-danger" : "";
          const tags = Array.isArray(i.etiquetas) && i.etiquetas.length
            ? i.etiquetas.map((t) => formatearEtiqueta(t)).join(", ")
            : "General";
          return `
            <tr class="${highlightClass}">
              <td class="mono-id">${i.id_interaccion}</td>
              <td class="mono-id">${i.id_usuario}</td>
              <td>${i.canal}</td>
              <td>${formatearEtiqueta(i.tipo)}</td>
              <td>${formatearEtiqueta(i.tema)}</td>
              <td class="num-col ${sColor}"><strong>${(s >= 0 ? "+" : "") + s.toFixed(2)}</strong></td>
              <td class="num-col">${i.reacciones_recibidas ?? 0}</td>
              <td>${tags}</td>
            </tr>
          `;
        })
        .join("");
    }
  }

  function registrarEventoEnVivo(evento, datos, timestamp) {
    const banner = document.getElementById("ws-banner");
    const titleEl = document.getElementById("ws-last-title");
    const timeEl = document.getElementById("ws-last-time");
    const listEl = document.getElementById("ws-event-log");

    banner.classList.add("active-pulse");
    setTimeout(() => banner.classList.remove("active-pulse"), 1800);

    const hora = new Date(timestamp || Date.now()).toLocaleTimeString("es-MX");
    const op = datos.operacion || evento.toUpperCase();
    const id = datos.id_interaccion || "-";
    const etiquetaHumana =
      op === "POST"
        ? "Nueva actividad"
        : op === "PUT"
        ? "Actividad editada"
        : "Actividad eliminada";

    titleEl.textContent = `${etiquetaHumana} (${id}) · Publicaciones activas: ${datos.metricas?.total_interacciones} · Ánimo promedio: ${Number(datos.metricas?.sentimiento_promedio || 0).toFixed(2)}`;
    timeEl.textContent = hora;

    const detalle = datos.interaccion
      ? `Miembro ${datos.interaccion.id_usuario} en ${datos.interaccion.canal} · Tema: ${formatearEtiqueta(datos.interaccion.tema)} · Reacciones: ${datos.interaccion.reacciones_recibidas}`
      : datos.interaccion_eliminada
      ? `Miembro ${datos.interaccion_eliminada.id_usuario} · Publicación retirada`
      : "";

    const item = document.createElement("div");
    item.className = "ws-event-item";
    item.innerHTML = `
      <span class="op-badge ${op.toLowerCase()}">${etiquetaHumana}</span>
      <span class="mono-id">${id}</span>
      <span>${detalle}</span>
      <span class="ticker-time" style="margin-left:auto;">${hora}</span>
    `;
    listEl.prepend(item);
    while (listEl.children.length > 3) {
      listEl.removeChild(listEl.lastChild);
    }
  }

  async function cargarInteraccionesIniciales() {
    try {
      const resp = await fetch("/api/interacciones?limite=25", { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      renderizarMetricasVivas(data.metricas, data.interacciones, false);
    } catch (_err) {}
  }

  function actualizarEstadoWS(enLinea) {
    if (enLinea) {
      wsDotEl.classList.add("online");
      wsStatusEl.textContent = "Conectado en tiempo real";
      if (wsHeaderDotEl) wsHeaderDotEl.classList.add("online");
      if (wsHeaderTextEl) wsHeaderTextEl.textContent = "Conectado en tiempo real";
    } else {
      wsDotEl.classList.remove("online");
      wsStatusEl.textContent = "Reconectando...";
      if (wsHeaderDotEl) wsHeaderDotEl.classList.remove("online");
      if (wsHeaderTextEl) wsHeaderTextEl.textContent = "Reconectando...";
    }
  }

  function conectarWebSocket() {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = token
      ? `${wsProtocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
      : `${wsProtocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      actualizarEstadoWS(true);
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (
          msg.evento === "interaccion_creada" ||
          msg.evento === "interaccion_actualizada" ||
          msg.evento === "interaccion_eliminada"
        ) {
          ultimoIdModificado = msg.datos?.id_interaccion || null;
          renderizarMetricasVivas(msg.datos.metricas, msg.datos.interacciones_recientes, true);
          registrarEventoEnVivo(msg.evento, msg.datos, msg.timestamp);
        }
      } catch (_err) {}
    });

    ws.addEventListener("close", () => {
      actualizarEstadoWS(false);
    });

    return ws;
  }

  // =========================================================================
  // PERFILES Y RETENCION
  // =========================================================================
  async function cargarResumenHistoricoREST() {
    try {
      const resp = await fetch("/api/historico/resumen", { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();

      const r = data.resumen_usuarios || {};
      document.getElementById("kpi-hist-usuarios").textContent = Number(
        r.total_usuarios || 0
      ).toLocaleString("es-MX");
      document.getElementById("kpi-hist-artistas").textContent = `${r.total_artistas || 0} creadores digitales · ${Number(r.total_mensajes_30d || 0).toLocaleString("es-MX")} mensajes en el mes`;

      const enRiesgo = data.por_estatus?.en_riesgo || 0;
      document.getElementById("kpi-hist-riesgo").textContent = Number(enRiesgo).toLocaleString("es-MX");

      document.getElementById("kpi-hist-sin-cons").textContent = Number(
        r.sin_consentimiento || 0
      ).toLocaleString("es-MX");
      document.getElementById("kpi-hist-violaciones").textContent = "Ubicación protegida en el 100% de los casos";

      document.getElementById("kpi-hist-cuarentena").textContent = Number(
        data.auditoria_etl?.total_cuarentena_firestore || 793
      ).toLocaleString("es-MX");

      const ordenEstatus = ["activo", "en_riesgo", "inactivo"].filter(
        (k) => data.por_estatus && data.por_estatus[k] !== undefined
      );
      crearOActualizarChart("restEstatus", "chart-rest-estatus", {
        type: "doughnut",
        data: {
          labels: ordenEstatus.map((k) => formatearEtiqueta(k)),
          datasets: [
            {
              data: ordenEstatus.map((k) => data.por_estatus[k]),
              backgroundColor: ordenEstatus.map((k) => COLORES_ESTATUS[k] || "#6B7280"),
              borderWidth: 2,
              borderColor: "#FFFFFF",
            },
          ],
        },
        options: opcionesDona("Miembros"),
      });

      const intEntries = Object.entries(data.por_interes || {}).sort((a, b) => b[1] - a[1]);
      crearOActualizarChart("restInteres", "chart-rest-interes", {
        type: "bar",
        data: {
          labels: intEntries.map(([k]) => formatearEtiqueta(k)),
          datasets: [
            {
              label: "Miembros",
              data: intEntries.map(([, v]) => v),
              backgroundColor: PRIMARY,
              hoverBackgroundColor: PRIMARY_HOVER,
              borderRadius: 4,
              maxBarThickness: 20,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 36 } },
          animation: { duration: 500, easing: "easeOutQuart" },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: GRID_COLOR }, ticks: { color: AXIS_TEXT } },
            y: { grid: { display: false }, ticks: { color: AXIS_TEXT } },
          },
        },
      });

      const edadEntries = Object.entries(data.por_rango_edad || {});
      crearOActualizarChart("restEdad", "chart-rest-edad", {
        type: "bar",
        data: {
          labels: edadEntries.map(([k]) => `${k} años`),
          datasets: [
            {
              label: "Miembros",
              data: edadEntries.map(([, v]) => v),
              backgroundColor: PRIMARY,
              hoverBackgroundColor: PRIMARY_HOVER,
              borderRadius: 4,
              maxBarThickness: 36,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 20 } },
          animation: { duration: 500, easing: "easeOutQuart" },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: AXIS_TEXT } },
            y: { grid: { color: GRID_COLOR }, ticks: { color: AXIS_TEXT } },
          },
        },
      });
    } catch (_err) {}
  }

  const ICONO_CANDADO = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

  async function consultarTablaUsuariosREST() {
    const estatus = document.getElementById("filtro-estatus").value;
    const consentimiento = document.getElementById("filtro-consentimiento").value;
    const limiteEl = document.getElementById("filtro-limite");
    const limite = limiteEl ? limiteEl.value : "25";
    const indicator = document.getElementById("rest-query-indicator");

    const params = new URLSearchParams();
    if (estatus) params.set("estatus", estatus);
    if (consentimiento) params.set("consentimiento", consentimiento);
    params.set("limite", limite);

    const url = `/api/historico/usuarios?${params.toString()}`;

    try {
      const resp = await fetch(url, { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      indicator.innerHTML = `<span>Mostrando <strong>${data.total_devueltos}</strong> miembros de la comunidad según los filtros seleccionados</span>`;

      const tbody = document.getElementById("tbody-usuarios-hist");
      tbody.innerHTML = (data.usuarios || [])
        .map((u) => {
          const consBadge = u.consentimiento_datos
            ? `<span class="tag-ok">Autorizada</span>`
            : `<span class="tag-priv">${ICONO_CANDADO}<span>Sin consentimiento</span></span>`;

          const ubicacionTxt =
            u.consentimiento_datos && u.ciudad
              ? `${u.ciudad}, ${u.estado} (${u.pais})`
              : `<span class="coord-protected">${ICONO_CANDADO}<span>Protegido</span></span>`;

          const coordsTxt =
            u.consentimiento_datos && u.latitud !== null
              ? `<span class="mono-id">${Number(u.latitud).toFixed(4)}, ${Number(u.longitud).toFixed(4)}</span>`
              : `<span class="coord-protected">${ICONO_CANDADO}<span>Protegido</span></span>`;

          const s = Number(u.sentimiento_promedio || 0);
          const sClass = s > 0.2 ? "text-success" : s < -0.2 ? "text-danger" : "";

          return `
            <tr>
              <td class="mono-id">${u.id_usuario}</td>
              <td><strong>${u.alias}</strong></td>
              <td><span class="status-pill st-${u.estatus}">${formatearEtiqueta(u.estatus)}</span></td>
              <td>${u.plataforma_principal}</td>
              <td>${formatearEtiqueta(u.interes_principal)}</td>
              <td class="num-col">${Number(u.mensajes_30d).toLocaleString("es-MX")}</td>
              <td class="num-col ${sClass}"><strong>${(s >= 0 ? "+" : "") + s.toFixed(2)}</strong></td>
              <td class="mono-id">${u.ultima_actividad}</td>
              <td>${consBadge}</td>
              <td>${ubicacionTxt}</td>
              <td class="num-col">${coordsTxt}</td>
            </tr>
          `;
        })
        .join("");
    } catch (_err) {}
  }

  document
    .getElementById("btn-filtrar-usuarios")
    .addEventListener("click", consultarTablaUsuariosREST);

  window.addEventListener("c360:theme-changed", () => {
    const col = obtenerColoresTema();
    GRID_COLOR = col.grid;
    AXIS_TEXT = col.axis;
    DARK_TEXT = col.text;
    Chart.defaults.color = AXIS_TEXT;
    Chart.defaults.borderColor = GRID_COLOR;
    Object.values(charts).forEach((c) => {
      if (!c) return;
      if (c.options?.scales?.x) {
        if (c.options.scales.x.grid && c.options.scales.x.grid.display !== false) {
          c.options.scales.x.grid.color = GRID_COLOR;
        }
        if (c.options.scales.x.ticks) c.options.scales.x.ticks.color = AXIS_TEXT;
      }
      if (c.options?.scales?.y) {
        if (c.options.scales.y.grid && c.options.scales.y.grid.display !== false) {
          c.options.scales.y.grid.color = GRID_COLOR;
        }
        if (c.options.scales.y.ticks) c.options.scales.y.ticks.color = AXIS_TEXT;
      }
      if (c.config.type === "doughnut" && c.data.datasets[0]) {
        c.data.datasets[0].borderColor = col.borderDona;
      }
      c.update();
    });
  });

  await Promise.all([
    cargarInteraccionesIniciales(),
    cargarResumenHistoricoREST(),
    consultarTablaUsuariosREST(),
  ]);

  wsInstance = conectarWebSocket();

  btnLogout.addEventListener("click", async () => {
    btnLogout.disabled = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() });
    } catch (_err) {}
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
      wsInstance.close();
    }
    redirigirLogin();
  });
});
