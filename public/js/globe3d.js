/**
 * Globo Terraqueo / Mapa 3D Interactivo de Community 360
 * Renderiza en 3D las 21 ubicaciones reales de los miembros con consentimiento,
 * pilares 3D proporcionales a la actividad, arcos de conexion con paquetes de luz,
 * recorrido automatico entre ciudades y rotacion hacia la ubicacion seleccionada.
 */
(function () {
  const COORDENADAS_ESTADOS = {
    "Yucatán": { ciudad: "Mérida", pais: "México", lat: 20.9721, lon: -89.6172, region: "mexico" },
    "Jalisco": { ciudad: "Guadalajara", pais: "México", lat: 20.6719, lon: -103.3519, region: "mexico" },
    "Nuevo León": { ciudad: "Monterrey", pais: "México", lat: 25.6731, lon: -100.3053, region: "mexico" },
    "CDMX": { ciudad: "Ciudad de México", pais: "México", lat: 19.4298, lon: -99.1343, region: "mexico" },
    "Quintana Roo": { ciudad: "Cancún", pais: "México", lat: 21.1639, lon: -86.8492, region: "mexico" },
    "Veracruz": { ciudad: "Veracruz", pais: "México", lat: 19.1784, lon: -96.1339, region: "mexico" },
    "Guanajuato": { ciudad: "León", pais: "México", lat: 21.1114, lon: -101.6612, region: "mexico" },
    "Baja California": { ciudad: "Tijuana", pais: "México", lat: 32.5111, lon: -117.0393, region: "mexico" },
    "Puebla": { ciudad: "Puebla", pais: "México", lat: 19.0368, lon: -98.2063, region: "mexico" },
    "Tabasco": { ciudad: "Villahermosa", pais: "México", lat: 17.9899, lon: -92.9370, region: "mexico" },
    "Querétaro": { ciudad: "Querétaro", pais: "México", lat: 20.5896, lon: -100.4110, region: "mexico" },
    "Chihuahua": { ciudad: "Chihuahua", pais: "México", lat: 28.6393, lon: -106.0984, region: "mexico" },
    "Campeche": { ciudad: "Campeche", pais: "México", lat: 19.8469, lon: -90.5220, region: "mexico" },
    "Oaxaca": { ciudad: "Oaxaca", pais: "México", lat: 17.0897, lon: -96.7379, region: "mexico" },
    "Texas": { ciudad: "Houston", pais: "Estados Unidos", lat: 29.7575, lon: -95.3893, region: "intl" },
    "California": { ciudad: "Los Ángeles", pais: "Estados Unidos", lat: 34.0399, lon: -118.2472, region: "intl" },
    "Cundinamarca": { ciudad: "Bogotá", pais: "Colombia", lat: 4.7151, lon: -74.0638, region: "latam" },
    "Lima": { ciudad: "Lima", pais: "Perú", lat: -12.0629, lon: -77.0299, region: "latam" },
    "Región Metropolitana": { ciudad: "Santiago", pais: "Chile", lat: -33.4356, lon: -70.6650, region: "latam" },
    "Buenos Aires": { ciudad: "Buenos Aires", pais: "Argentina", lat: -34.6081, lon: -58.3797, region: "latam" },
    "Comunidad de Madrid": { ciudad: "Madrid", pais: "España", lat: 40.4168, lon: -3.7066, region: "intl" },
  };

  // Siluetas continentales aproximadas (cajas [latMin, latMax, lonMin, lonMax]) para matriz de puntos terrestres
  const CONTINENTES_BOXES = [
    // Norteamerica y Mexico
    [50, 68, -165, -60], [32, 50, -125, -65], [24, 33, -117, -80],
    [18, 25, -106, -86], [14, 21, -98, -86], [8, 15, -92, -77],
    // Sudamerica
    [-5, 11, -80, -50], [-22, -5, -78, -35], [-38, -22, -73, -48], [-54, -38, -74, -62],
    // Europa y Espana
    [36, 44, -9, 3], [43, 55, -5, 30], [51, 59, -8, 2], [55, 68, 5, 32],
    // Africaoccidental
    [5, 35, -17, 35], [-34, 5, 10, 42],
  ];

  const puntosTierra = [];
  for (let lat = -54; lat <= 66; lat += 3.5) {
    for (let lon = -165; lon <= 40; lon += 3.5) {
      if (
        CONTINENTES_BOXES.some(
          ([la1, la2, lo1, lo2]) => lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2
        )
      ) {
        puntosTierra.push({ lat, lon });
      }
    }
  }

  const DEG2RAD = Math.PI / 180;

  function latLonToXYZ(lat, lon, radius) {
    const phi = lat * DEG2RAD;
    const lam = lon * DEG2RAD;
    return {
      x: radius * Math.cos(phi) * Math.sin(lam),
      y: -radius * Math.sin(phi),
      z: radius * Math.cos(phi) * Math.cos(lam),
    };
  }

  function rotarPunto(p, yaw, pitch) {
    // Rotacion en Y (longitud / yaw)
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const x1 = p.x * cosY + p.z * sinY;
    const z1 = -p.x * sinY + p.z * cosY;

    // Rotacion en X (latitud / pitch)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const y2 = p.y * cosP - z1 * sinP;
    const z2 = p.y * sinP + z1 * cosP;

    return { x: x1, y: y2, z: z2 };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("globe-3d-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Estado de camara centrado inicialmente en Mexico (-99 lon, 21 lat)
    let yaw = 99 * DEG2RAD;
    let pitch = 21 * DEG2RAD;
    let targetYaw = yaw;
    let targetPitch = pitch;

    let autoTour = true;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let estadoSeleccionado = "Jalisco";
    let pulsoOnda = 0;
    let tick = 0;

    const datosPorEstado = {};
    Object.keys(COORDENADAS_ESTADOS).forEach((est) => {
      datosPorEstado[est] = {
        ...COORDENADAS_ESTADOS[est],
        estado: est,
        interacciones: 0,
        miembros: 0,
      };
    });

    function actualizarHUD(estadoKey) {
      const info = datosPorEstado[estadoKey];
      if (!info) return;
      const elCiudad = document.getElementById("globe-hud-city");
      const elCoords = document.getElementById("globe-hud-coords");
      const elInter = document.getElementById("globe-hud-inter");
      const elMiembros = document.getElementById("globe-hud-members");

      if (elCiudad) elCiudad.textContent = `${info.ciudad}, ${info.estado} (${info.pais})`;
      if (elCoords) {
        const ns = info.lat >= 0 ? "N" : "S";
        const eo = info.lon >= 0 ? "E" : "O";
        elCoords.textContent = `${Math.abs(info.lat).toFixed(4)}° ${ns}, ${Math.abs(info.lon).toFixed(4)}° ${eo}`;
      }
      if (elInter) elInter.textContent = `${info.interacciones} publicaciones`;
      if (elMiembros) {
        elMiembros.textContent = info.miembros
          ? `${info.miembros} miembros`
          : "Ubicación verificada";
      }

      // Resaltar celda en el heatmap lateral
      document.querySelectorAll(".heatmap-cell").forEach((cell) => {
        cell.classList.toggle("active-state", cell.dataset.estado === estadoKey);
      });
    }

    function enfocarEstado(estadoKey, pausarTour = false) {
      const info = datosPorEstado[estadoKey];
      if (!info) return;
      estadoSeleccionado = estadoKey;
      targetYaw = -info.lon * DEG2RAD;
      targetPitch = info.lat * DEG2RAD;
      pulsoOnda = 0;
      if (pausarTour) {
        autoTour = false;
        const btnTour = document.getElementById("btn-globe-tour");
        if (btnTour) {
          btnTour.classList.remove("active");
          btnTour.textContent = "Reanudar recorrido 3D";
        }
      }
      actualizarHUD(estadoKey);
    }

    function enfocarCoordenadas(lat, lon, etiqueta) {
      targetYaw = -Number(lon) * DEG2RAD;
      targetPitch = Number(lat) * DEG2RAD;
      pulsoOnda = 0;
      const match = Object.keys(datosPorEstado).find(
        (k) =>
          Math.abs(datosPorEstado[k].lat - lat) < 1.5 &&
          Math.abs(datosPorEstado[k].lon - lon) < 1.5
      );
      if (match) {
        estadoSeleccionado = match;
        actualizarHUD(match);
      } else if (etiqueta) {
        const elCiudad = document.getElementById("globe-hud-city");
        if (elCiudad) elCiudad.textContent = etiqueta;
      }
    }

    // Recorrido automatico cada 3.8 segundos entre las ubicaciones con actividad
    let tourIdx = 0;
    setInterval(() => {
      if (!autoTour || isDragging) return;
      const activos = Object.keys(datosPorEstado).sort(
        (a, b) => datosPorEstado[b].interacciones - datosPorEstado[a].interacciones
      );
      if (!activos.length) return;
      tourIdx = (tourIdx + 1) % activos.length;
      enfocarEstado(activos[tourIdx], false);
    }, 3800);

    // Eventos de raton sobre el globo 3D
    let nodosEnPantalla = [];

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      targetYaw -= dx * 0.007;
      targetPitch = Math.max(-1.2, Math.min(1.2, targetPitch + dy * 0.007));
      yaw = targetYaw;
      pitch = targetPitch;
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Clic sobre un marcador en el globo 3D
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let mejor = null;
      let minDist = 24;
      for (const n of nodosEnPantalla) {
        const d = Math.hypot(n.sx - mx, n.sy - my);
        if (d < minDist) {
          minDist = d;
          mejor = n.estado;
        }
      }
      if (mejor) {
        enfocarEstado(mejor, true);
      }
    });

    // Botones de control del mapa 3D
    const btnTour = document.getElementById("btn-globe-tour");
    if (btnTour) {
      btnTour.addEventListener("click", () => {
        autoTour = !autoTour;
        btnTour.classList.toggle("active", autoTour);
        btnTour.textContent = autoTour ? "Recorrido 3D activo" : "Reanudar recorrido 3D";
      });
    }

    document.querySelectorAll("[data-globe-region]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reg = btn.getAttribute("data-globe-region");
        if (reg === "mexico") enfocarEstado("CDMX", true);
        else if (reg === "sur") enfocarEstado("Yucatán", true);
        else if (reg === "latam") enfocarEstado("Cundinamarca", true);
        else if (reg === "espana") enfocarEstado("Comunidad de Madrid", true);
      });
    });

    function ajustarCanvas() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth || 560;
      const h = parent.clientHeight || 420;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
    }

    window.addEventListener("resize", ajustarCanvas);

    function renderizarGlobo() {
      ajustarCanvas();
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Interpolacion suave de camara hacia la ubicacion objetivo
      if (!isDragging) {
        let diffYaw = targetYaw - yaw;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        yaw += diffYaw * 0.065;
        pitch += (targetPitch - pitch) * 0.065;
      }

      tick += 0.025;
      pulsoOnda = (pulsoOnda + 0.025) % 1;

      const cx = width / 2;
      const cy = height / 2 + 6;
      const radius = Math.min(width, height) * 0.39;
      const dark = document.documentElement.getAttribute("data-theme") === "dark";

      // 1) Halo atmosferico exterior
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.82, cx, cy, radius * 1.24);
      haloGrad.addColorStop(0, dark ? "rgba(59, 130, 246, 0.22)" : "rgba(36, 87, 197, 0.14)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.24, 0, Math.PI * 2);
      ctx.fill();

      // 2) Esfera base 3D con iluminacion
      const sphereGrad = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.1,
        cx,
        cy,
        radius
      );
      if (dark) {
        sphereGrad.addColorStop(0, "#132242");
        sphereGrad.addColorStop(0.7, "#0b1428");
        sphereGrad.addColorStop(1, "#060b17");
      } else {
        sphereGrad.addColorStop(0, "#FFFFFF");
        sphereGrad.addColorStop(0.75, "#EBF2FC");
        sphereGrad.addColorStop(1, "#D6E4F7");
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = dark ? "rgba(56, 189, 248, 0.38)" : "rgba(36, 87, 197, 0.32)";
      ctx.stroke();

      // 3) Paralelos y meridianos 3D
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = dark ? "rgba(148, 163, 184, 0.12)" : "rgba(36, 87, 197, 0.11)";

      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 6) {
          const p = rotarPunto(latLonToXYZ(lat, lon, radius), yaw, pitch);
          if (p.z > 0) {
            if (!started) {
              ctx.moveTo(cx + p.x, cy + p.y);
              started = true;
            } else {
              ctx.lineTo(cx + p.x, cy + p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const p = rotarPunto(latLonToXYZ(lat, lon, radius), yaw, pitch);
          if (p.z > 0) {
            if (!started) {
              ctx.moveTo(cx + p.x, cy + p.y);
              started = true;
            } else {
              ctx.lineTo(cx + p.x, cy + p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // 4) Matriz de puntos continentales en 3D
      ctx.fillStyle = dark ? "rgba(148, 163, 184, 0.25)" : "rgba(36, 87, 197, 0.22)";
      for (let i = 0; i < puntosTierra.length; i++) {
        const pt = puntosTierra[i];
        const p = rotarPunto(latLonToXYZ(pt.lat, pt.lon, radius), yaw, pitch);
        if (p.z > 0) {
          ctx.beginPath();
          ctx.arc(cx + p.x, cy + p.y, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5) Arcos 3D de actividad entre CDMX y las demas ubicaciones activas
      const centroHub = datosPorEstado["CDMX"];
      if (centroHub) {
        const pHubSurf = rotarPunto(
          latLonToXYZ(centroHub.lat, centroHub.lon, radius),
          yaw,
          pitch
        );

        Object.values(datosPorEstado).forEach((dest, idx) => {
          if (dest.estado === "CDMX" || dest.interacciones <= 0) return;
          const pDestSurf = rotarPunto(
            latLonToXYZ(dest.lat, dest.lon, radius),
            yaw,
            pitch
          );
          if (pHubSurf.z < -radius * 0.2 || pDestSurf.z < -radius * 0.2) return;

          const midLat = (centroHub.lat + dest.lat) / 2;
          const midLon = (centroHub.lon + dest.lon) / 2;
          const pMid = rotarPunto(
            latLonToXYZ(midLat, midLon, radius * 1.24),
            yaw,
            pitch
          );

          const x0 = cx + pHubSurf.x;
          const y0 = cy + pHubSurf.y;
          const xm = cx + pMid.x;
          const ym = cy + pMid.y;
          const x1 = cx + pDestSurf.x;
          const y1 = cy + pDestSurf.y;

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(xm, ym, x1, y1);
          ctx.strokeStyle =
            dest.estado === estadoSeleccionado
              ? dark
                ? "rgba(52, 211, 153, 0.75)"
                : "rgba(30, 142, 90, 0.7)"
              : dark
              ? "rgba(56, 189, 248, 0.24)"
              : "rgba(36, 87, 197, 0.20)";
          ctx.lineWidth = dest.estado === estadoSeleccionado ? 1.8 : 1;
          ctx.stroke();

          // Paquete luminoso viajando por el arco
          const tPkt = (tick * 0.55 + idx * 0.17) % 1;
          const inv = 1 - tPkt;
          const px = inv * inv * x0 + 2 * inv * tPkt * xm + tPkt * tPkt * x1;
          const py = inv * inv * y0 + 2 * inv * tPkt * ym + tPkt * tPkt * y1;
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "#38BDF8" : "#2457C5";
          ctx.fill();
        });
      }

      // 6) Pilares 3D, marcadores pulsantes y etiquetas de las 21 ubicaciones
      const maxInter = Math.max(
        1,
        ...Object.values(datosPorEstado).map((d) => d.interacciones || 1)
      );
      nodosEnPantalla = [];

      Object.values(datosPorEstado).forEach((loc) => {
        const pBase = rotarPunto(latLonToXYZ(loc.lat, loc.lon, radius), yaw, pitch);
        if (pBase.z < 0) return; // Lado oculto del planeta

        const ratio = (loc.interacciones || 1) / maxInter;
        const alturaPilar = 10 + ratio * 28;
        const pTop = rotarPunto(
          latLonToXYZ(loc.lat, loc.lon, radius + alturaPilar),
          yaw,
          pitch
        );

        const bx = cx + pBase.x;
        const by = cy + pBase.y;
        const tx = cx + pTop.x;
        const ty = cy + pTop.y;
        const esActivo = loc.estado === estadoSeleccionado;

        nodosEnPantalla.push({
          estado: loc.estado,
          sx: bx,
          sy: by,
        });

        // Pilar 3D que sobresale de la superficie
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = esActivo
          ? "#10B981"
          : dark
          ? "rgba(56, 189, 248, 0.85)"
          : "rgba(36, 87, 197, 0.85)";
        ctx.lineWidth = esActivo ? 3 : 2;
        ctx.stroke();

        // Base en la superficie
        ctx.beginPath();
        ctx.arc(bx, by, esActivo ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#10B981" : dark ? "#38BDF8" : "#2457C5";
        ctx.fill();

        // Punta luminosa del pilar 3D
        ctx.beginPath();
        ctx.arc(tx, ty, esActivo ? 4 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#34D399" : dark ? "#F8FAFC" : "#1D49A6";
        ctx.fill();

        // Onda de sonar en la ubicacion enfocada
        if (esActivo) {
          const rOnda = 6 + pulsoOnda * 24;
          ctx.beginPath();
          ctx.arc(bx, by, rOnda, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(16, 185, 129, ${(1 - pulsoOnda).toFixed(2)})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        // Etiqueta flotante para la ubicacion enfocada o las de mayor actividad cercanas al frente
        if (esActivo || (pBase.z > radius * 0.65 && loc.interacciones >= 12)) {
          ctx.font = esActivo
            ? "700 11.5px 'Inter', sans-serif"
            : "600 10.5px 'Inter', sans-serif";
          const labelTxt = `${loc.ciudad} (${loc.interacciones})`;
          ctx.fillStyle = esActivo
            ? dark
              ? "#34D399"
              : "#1E8E5A"
            : dark
            ? "#E2E8F0"
            : "#1B2430";
          ctx.fillText(labelTxt, tx + 7, ty + 3);
        }
      });

      ctx.restore();
      requestAnimationFrame(renderizarGlobo);
    }

    requestAnimationFrame(renderizarGlobo);

    // Exponer API para dashboard.js
    window.c360Globe = {
      actualizarDatos(mapaCalorEstado, catalogoUbicaciones) {
        if (mapaCalorEstado) {
          Object.keys(datosPorEstado).forEach((est) => {
            datosPorEstado[est].interacciones = Number(mapaCalorEstado[est] || 0);
          });
        }
        if (Array.isArray(catalogoUbicaciones)) {
          catalogoUbicaciones.forEach((u) => {
            if (datosPorEstado[u.estado]) {
              datosPorEstado[u.estado].miembros = Number(u.usuarios || 0);
            }
          });
        }
        actualizarHUD(estadoSeleccionado);
      },
      enfocarEstado,
      enfocarCoordenadas,
    };
  });
})();
