document.addEventListener("DOMContentLoaded", async () => {
  const token = sessionStorage.getItem("c360_id_token");
  const userEmailEl = document.getElementById("user-email");
  const userRolEl = document.getElementById("user-rol");
  const userAvatarEl = document.getElementById("user-avatar");
  const wsDotEl = document.getElementById("ws-dot");
  const wsStatusEl = document.getElementById("ws-status");
  const wsHeaderDotEl = document.getElementById("ws-header-dot");
  const wsHeaderTextEl = document.getElementById("ws-header-text");
  const versionBadgeEl = document.getElementById("version-badge");
  const btnLogout = document.getElementById("btn-logout");

  const charts = {};
  const kpiPrevios = {};
  let ultimoIdModificado = null;

  function authHeaders() {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function redirigirLogin() {
    sessionStorage.removeItem("c360_id_token");
    sessionStorage.removeItem("c360_usuario");
    window.location.replace("/login");
  }

  // Formateo Unicode sin romper acentos (evita "CóMics" o "MúSica")
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
      respuesta_encuesta: "Respuesta a encuesta",
      rsvp_evento: "Confirmación RSVP",
      reaccion: "Reacción",
      musica: "Música",
      comics: "Cómics",
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

  // Navegacion activa en menu lateral
  const navLinks = document.querySelectorAll(".sidebar-nav .nav-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  // Animacion de transicion numerica y destello en tarjeta KPI cuando cambia por WebSocket
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

    const duracion = 650;
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

  // 1) Validar sesion activa
  try {
    const respSesion = await fetch("/api/auth/sesion", { headers: authHeaders() });
    if (!respSesion.ok) {
      redirigirLogin();
      return;
    }
    const { usuario } = await respSesion.json();
    userEmailEl.textContent = usuario.email;
    userRolEl.textContent = usuario.rol === "admin" ? "Administrador" : "Lector";
    const iniciales = (usuario.email || "U")
      .split("@")[0]
      .split(/[._-]/)
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
    if (userAvatarEl && iniciales) userAvatarEl.textContent = iniciales;
  } catch (_err) {
    redirigirLogin();
    return;
  }

  // Paleta coherente basada en Indigo + colores semanticos
  const PALETA_CATEGORIAS = [
    "#6366f1",
    "#3b82f6",
    "#06b6d4",
    "#8b5cf6",
    "#a855f7",
    "#10b981",
    "#64748b",
  ];

  const COLORES_ESTATUS = {
    activo: "#10b981",     // Verde
    en_riesgo: "#f59e0b",  // Ambar
    inactivo: "#ef4444",   // Rojo
  };

  Chart.defaults.color = "#94a3b8";
  Chart.defaults.borderColor = "rgba(148, 163, 184, 0.07)";
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

  // Plugin 1: Mostrar el valor numerico al final de cada barra
  const barValueLabelsPlugin = {
    id: "barValueLabels",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "bar") return;
      const { ctx } = chart;
      const isHorizontal = chart.config.options?.indexAxis === "y";
      ctx.save();
      ctx.font = "600 11px 'Inter', sans-serif";
      ctx.fillStyle = "#cbd5e1";

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
            ctx.fillText(val.toLocaleString("es-MX"), bar.x, bar.y - 6);
          }
        });
      });
      ctx.restore();
    },
  };

  // Plugin 2: Mostrar el total en el centro de las graficas de dona
  const doughnutCenterTextPlugin = {
    id: "doughnutCenterText",
    afterDraw(chart) {
      if (chart.config.type !== "doughnut") return;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data || !meta.data.length) return;
      const { ctx } = chart;
      const centerX = meta.data[0].x;
      const centerY = meta.data[0].y;
      const total = (chart.data.datasets[0]?.data || []).reduce((acc, v) => acc + Number(v || 0), 0);
      const centerLabel = chart.config.options?.plugins?.centerLabel || "Total";

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 20px 'Inter', sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(total.toLocaleString("es-MX"), centerX, centerY - 7);

      ctx.font = "500 11px 'Inter', sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(centerLabel, centerX, centerY + 13);
      ctx.restore();
    },
  };

  Chart.register(barValueLabelsPlugin, doughnutCenterTextPlugin);

  function opcionesDona(centerLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      animation: { duration: 600, easing: "easeOutQuart" },
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
                  strokeStyle: ds.backgroundColor[i],
                  fontColor: "#cbd5e1",
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

  // =========================================================================
  // RENDERIZADO DE PULSO EN TIEMPO REAL
  // =========================================================================
  function renderizarMetricasVivas(metricas, interaccionesRecientes = null, esEventoWS = false) {
    if (!metricas) return;

    versionBadgeEl.textContent = `Revisión #${metricas.version || 1}`;

    actualizarKPI(
      "kpi-total-inter",
      "card-kpi-total",
      Number(metricas.total_interacciones || 0),
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
      (v) => (v >= 0 ? "+" : "") + v.toFixed(3),
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

    // 1) Temas de conversacion (barras horizontales ordenadas de mayor a menor)
    const temasEntries = Object.entries(metricas.por_tema || {}).sort((a, b) => b[1] - a[1]);
    crearOActualizarChart("wsTema", "chart-ws-tema", {
      type: "bar",
      data: {
        labels: temasEntries.map(([k]) => formatearEtiqueta(k)),
        datasets: [
          {
            label: "Interacciones",
            data: temasEntries.map(([, v]) => v),
            backgroundColor: "#6366f1",
            hoverBackgroundColor: "#818cf8",
            borderRadius: 6,
            maxBarThickness: 24,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 36 } },
        animation: { duration: 600, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(148, 163, 184, 0.06)" } },
          y: { grid: { display: false } },
        },
      },
    });

    // 2) Canal digital (dona con total en el centro y porcentajes)
    const canalEntries = Object.entries(metricas.por_canal || {}).sort((a, b) => b[1] - a[1]);
    crearOActualizarChart("wsCanal", "chart-ws-canal", {
      type: "doughnut",
      data: {
        labels: canalEntries.map(([k]) => k),
        datasets: [
          {
            data: canalEntries.map(([, v]) => v),
            backgroundColor: PALETA_CATEGORIAS,
            borderWidth: 2,
            borderColor: "#111827",
          },
        ],
      },
      options: opcionesDona("Interacciones"),
    });

    // 3) Formato de interaccion (barras horizontales con valor al final)
    const tipoEntries = Object.entries(metricas.por_tipo || {}).sort((a, b) => b[1] - a[1]);
    crearOActualizarChart("wsTipo", "chart-ws-tipo", {
      type: "bar",
      data: {
        labels: tipoEntries.map(([k]) => formatearEtiqueta(k)),
        datasets: [
          {
            label: "Interacciones",
            data: tipoEntries.map(([, v]) => v),
            backgroundColor: "#818cf8",
            hoverBackgroundColor: "#a5b4fc",
            borderRadius: 6,
            maxBarThickness: 24,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 36 } },
        animation: { duration: 600, easing: "easeOutQuart" },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(148, 163, 184, 0.06)" } },
          y: { grid: { display: false } },
        },
      },
    });

    // 4) Balance de sentimiento (colores semanticos: verde, gris, rojo)
    crearOActualizarChart("wsPolaridad", "chart-ws-polaridad", {
      type: "doughnut",
      data: {
        labels: ["Positivo", "Neutro", "Crítico"],
        datasets: [
          {
            data: [distSent.positivas || 0, distSent.neutras || 0, distSent.negativas || 0],
            backgroundColor: ["#10b981", "#64748b", "#ef4444"],
            borderWidth: 2,
            borderColor: "#111827",
          },
        ],
      },
      options: opcionesDona("Analizadas"),
    });

    // 5) Mapa de calor geografico
    const heatmapContainer = document.getElementById("heatmap-estados");
    const estadosEntries = Object.entries(metricas.mapa_calor_estado || {}).sort((a, b) => b[1] - a[1]);
    const maxEstado = estadosEntries.length ? estadosEntries[0][1] : 1;

    heatmapContainer.innerHTML = estadosEntries
      .map(([estado, conteo]) => {
        const intensidad = Math.max(0.16, conteo / maxEstado);
        const bg = `rgba(99, 102, 241, ${(intensidad * 0.42).toFixed(2)})`;
        const border = `rgba(99, 102, 241, ${Math.min(0.85, intensidad + 0.22).toFixed(2)})`;
        return `
          <div class="heatmap-cell" style="background:${bg}; border-color:${border};">
            <div class="heatmap-state">${estado}</div>
            <div class="heatmap-count">${conteo}</div>
          </div>
        `;
      })
      .join("");

    // 6) Tabla de actividad reciente
    if (Array.isArray(interaccionesRecientes)) {
      const tbody = document.getElementById("tbody-interacciones");
      tbody.innerHTML = interaccionesRecientes
        .slice(0, 20)
        .map((i) => {
          const highlightClass = i.id_interaccion === ultimoIdModificado ? "row-highlight" : "";
          const s = Number(i.sentimiento || 0);
          const sColor = s > 0.2 ? "text-success" : s < -0.2 ? "text-danger" : "";
          const tags = Array.isArray(i.etiquetas) && i.etiquetas.length
            ? i.etiquetas.map((t) => formatearEtiqueta(t)).join(", ")
            : "Sin etiquetas";
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
    const accionTexto =
      op === "POST"
        ? "Nueva interacción registrada"
        : op === "PUT"
        ? "Interacción actualizada"
        : "Interacción eliminada";

    titleEl.textContent = `${accionTexto} (${id}) · Total activo: ${datos.metricas?.total_interacciones} · Índice de sentimiento: ${datos.metricas?.sentimiento_promedio}`;
    timeEl.textContent = hora;

    const detalle = datos.interaccion
      ? `Miembro ${datos.interaccion.id_usuario} en ${datos.interaccion.canal} · Tema: ${formatearEtiqueta(datos.interaccion.tema)} · Sentimiento: ${datos.interaccion.sentimiento}`
      : datos.interaccion_eliminada
      ? `Miembro ${datos.interaccion_eliminada.id_usuario} · Registro eliminado`
      : "";

    const item = document.createElement("div");
    item.className = "ws-event-item";
    item.innerHTML = `
      <span class="op-badge ${op.toLowerCase()}">${op}</span>
      <span class="mono-id">${id}</span>
      <span>${detalle}</span>
      <span class="ticker-time" style="margin-left:auto;">${hora}</span>
    `;
    listEl.prepend(item);
    while (listEl.children.length > 4) {
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
      setTimeout(conectarWebSocket, 3500);
    });

    return ws;
  }

  // =========================================================================
  // RADIOGRAFIA DE LA COMUNIDAD
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
      document.getElementById("kpi-hist-artistas").textContent = `${r.total_artistas || 0} creadores digitales · ${Number(r.total_mensajes_30d || 0).toLocaleString("es-MX")} mensajes (30d)`;

      const enRiesgo = data.por_estatus?.en_riesgo || 0;
      document.getElementById("kpi-hist-riesgo").textContent = Number(enRiesgo).toLocaleString("es-MX");

      document.getElementById("kpi-hist-sin-cons").textContent = Number(
        r.sin_consentimiento || 0
      ).toLocaleString("es-MX");
      document.getElementById("kpi-hist-violaciones").textContent = `${data.privacidad?.usuarios_sin_consentimiento_con_geo ?? 0} exposiciones geográficas no autorizadas`;

      document.getElementById("kpi-hist-cuarentena").textContent = Number(
        data.auditoria_etl?.total_cuarentena_firestore || 793
      ).toLocaleString("es-MX");

      // 1) Estado de retencion: orden y colores semanticos FIJOS (Activo = Verde, En riesgo = Ambar, Inactivo = Rojo)
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
              backgroundColor: ordenEstatus.map((k) => COLORES_ESTATUS[k] || "#64748b"),
              borderWidth: 2,
              borderColor: "#111827",
            },
          ],
        },
        options: opcionesDona("Miembros"),
      });

      // 2) Intereses culturales: barras horizontales ordenadas de mayor a menor con valor al final
      const intEntries = Object.entries(data.por_interes || {}).sort((a, b) => b[1] - a[1]);
      crearOActualizarChart("restInteres", "chart-rest-interes", {
        type: "bar",
        data: {
          labels: intEntries.map(([k]) => formatearEtiqueta(k)),
          datasets: [
            {
              label: "Miembros",
              data: intEntries.map(([, v]) => v),
              backgroundColor: "#6366f1",
              hoverBackgroundColor: "#818cf8",
              borderRadius: 6,
              maxBarThickness: 22,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 36 } },
          animation: { duration: 600, easing: "easeOutQuart" },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: "rgba(148, 163, 184, 0.06)" } },
            y: { grid: { display: false } },
          },
        },
      });

      // 3) Segmentos de edad
      const edadEntries = Object.entries(data.por_rango_edad || {});
      crearOActualizarChart("restEdad", "chart-rest-edad", {
        type: "bar",
        data: {
          labels: edadEntries.map(([k]) => `${k} años`),
          datasets: [
            {
              label: "Miembros",
              data: edadEntries.map(([, v]) => v),
              backgroundColor: "#818cf8",
              hoverBackgroundColor: "#a5b4fc",
              borderRadius: 6,
              maxBarThickness: 38,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 20 } },
          animation: { duration: 600, easing: "easeOutQuart" },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: "rgba(148, 163, 184, 0.06)" } },
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
      indicator.innerHTML = `
        <span>Mostrando <strong>${data.total_devueltos}</strong> perfiles del padrón comunitario</span>
        <span class="endpoint-chip">GET ${url}</span>
      `;

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

  await Promise.all([
    cargarInteraccionesIniciales(),
    cargarResumenHistoricoREST(),
    consultarTablaUsuariosREST(),
  ]);

  const ws = conectarWebSocket();

  btnLogout.addEventListener("click", async () => {
    btnLogout.disabled = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() });
    } catch (_err) {}
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    redirigirLogin();
  });
});
