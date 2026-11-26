/**
 * Planeta Tierra 3D Satelital Fotorrealista con Relieve Topografico — Community 360
 * - Texturas satelitales reales NASA Blue Marble (/img/earth-blue-marble.jpg)
 * - Mapa de relieve topografico 3D (/img/earth-topology.png) para sombras de cordilleras y montañas
 * - Mascara especular oceanica (/img/earth-water.png) para reflejo solar en mares
 * - Etiquetas geograficas de paises + las 21 ciudades reales de la comunidad
 * - Soporte completo para escritorio, pantallas tactiles moviles (1 dedo gira, 2 dedos zoom)
 *   y control por gestos de la mano frente a la camara ("Girar con la mano")
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
    "Comunidad de Madrid": { ciudad: "Madrid", pais: "España", lat: 40.4168, lon: -3.7066, region: "intl" }
  };

  // Etiquetas geograficas de paises para orientacion tipo Google Earth / Earth 3D Map
  const PAISES_ETIQUETAS = [
    { nombre: "MÉXICO", lat: 23.6, lon: -102.5, principal: true },
    { nombre: "ESTADOS UNIDOS", lat: 39.5, lon: -98.3, principal: true },
    { nombre: "CANADÁ", lat: 56.1, lon: -106.3, principal: false },
    { nombre: "COLOMBIA", lat: 4.1, lon: -72.9, principal: true },
    { nombre: "PERÚ", lat: -9.2, lon: -75.0, principal: true },
    { nombre: "BRASIL", lat: -10.8, lon: -52.9, principal: true },
    { nombre: "CHILE", lat: -35.7, lon: -71.5, principal: true },
    { nombre: "ARGENTINA", lat: -38.4, lon: -63.6, principal: true },
    { nombre: "BOLIVIA", lat: -16.3, lon: -63.6, principal: false },
    { nombre: "VENEZUELA", lat: 6.4, lon: -66.6, principal: false },
    { nombre: "CUBA", lat: 21.5, lon: -79.5, principal: false },
    { nombre: "ESPAÑA", lat: 40.2, lon: -3.7, principal: true },
    { nombre: "FRANCIA", lat: 46.6, lon: 2.2, principal: false },
    { nombre: "REINO UNIDO", lat: 54.0, lon: -2.0, principal: false },
    { nombre: "ITALIA", lat: 42.8, lon: 12.6, principal: false },
    { nombre: "ALEMANIA", lat: 51.2, lon: 10.4, principal: false },
    { nombre: "MARRUECOS", lat: 31.8, lon: -7.1, principal: false },
    { nombre: "ARGELIA", lat: 28.0, lon: 1.7, principal: false },
    { nombre: "EGIPTO", lat: 26.8, lon: 30.8, principal: false },
    { nombre: "NIGERIA", lat: 9.1, lon: 8.7, principal: false },
    { nombre: "SUDÁFRICA", lat: -30.6, lon: 22.9, principal: false },
    { nombre: "TURQUÍA", lat: 38.9, lon: 35.2, principal: false },
    { nombre: "ARABIA SAUDITA", lat: 23.9, lon: 45.1, principal: false },
    { nombre: "INDIA", lat: 21.1, lon: 78.9, principal: true },
    { nombre: "CHINA", lat: 35.8, lon: 104.2, principal: true },
    { nombre: "JAPÓN", lat: 36.2, lon: 138.2, principal: false },
    { nombre: "AUSTRALIA", lat: -25.3, lon: 133.8, principal: true }
  ];

  const ESTRELLAS_FONDO = Array.from({ length: 95 }, (_, i) => ({
    u: ((i * 73 + 19) % 100) / 100,
    v: ((i * 41 + 37) % 100) / 100,
    r: 0.6 + (i % 3) * 0.55,
    phase: i * 0.8
  }));

  const DEG2RAD = Math.PI / 180;
  const INV_PI = 1 / Math.PI;
  const INV_2PI = 1 / (Math.PI * 2);
  const ZOOM_MIN = 0.62;
  const ZOOM_MAX = 7.5;

  function latLonToXYZ(lat, lon, radius) {
    const phi = lat * DEG2RAD;
    const lam = lon * DEG2RAD;
    return {
      x: radius * Math.cos(phi) * Math.sin(lam),
      y: -radius * Math.sin(phi),
      z: radius * Math.cos(phi) * Math.cos(lam)
    };
  }

  function rotarPunto(p, yaw, pitch) {
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const x1 = p.x * cosY + p.z * sinY;
    const z1 = -p.x * sinY + p.z * cosY;

    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const y2 = p.y * cosP + z1 * sinP;
    const z2 = -p.y * sinP + z1 * cosP;

    return { x: x1, y: y2, z: z2 };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("globe-3d-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let backdropEl = document.getElementById("globe-backdrop-overlay");
    if (!backdropEl) {
      backdropEl = document.createElement("div");
      backdropEl.id = "globe-backdrop-overlay";
      backdropEl.className = "globe-backdrop-overlay";
      document.body.appendChild(backdropEl);
    }

    // =========================================================================
    // MOTOR DE TEXTURAS SATELITALES NASA BLUE MARBLE + RELIEVE TOPOGRAFICO 3D
    // =========================================================================
    const TEX_W = 1024;
    const TEX_H = 512;
    let colorPixels = null;
    let bumpPixels = null;
    let waterPixels = null;
    let texturasListas = false;

    function extraerBufferImagen(img) {
      const c = document.createElement("canvas");
      c.width = TEX_W;
      c.height = TEX_H;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0, TEX_W, TEX_H);
      return cx.getImageData(0, 0, TEX_W, TEX_H).data;
    }

    function cargarImagenPromesa(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    }

    Promise.all([
      cargarImagenPromesa("/img/earth-blue-marble.jpg"),
      cargarImagenPromesa("/img/earth-topology.png"),
      cargarImagenPromesa("/img/earth-water.png")
    ])
      .then(([imgColor, imgBump, imgWater]) => {
        colorPixels = extraerBufferImagen(imgColor);
        bumpPixels = extraerBufferImagen(imgBump);
        waterPixels = extraerBufferImagen(imgWater);
        texturasListas = true;
      })
      .catch(() => {
        texturasListas = false;
      });

    // Buffer esferico 3D de alta velocidad con tabla precalculada de normales y iluminacion
    const SPHERE_RES = 360;
    const sphereCanvas = document.createElement("canvas");
    sphereCanvas.width = SPHERE_RES;
    sphereCanvas.height = SPHERE_RES;
    const sphereCtx = sphereCanvas.getContext("2d");
    const sphereImgData = sphereCtx.createImageData(SPHERE_RES, SPHERE_RES);
    const sphereOut32 = new Uint32Array(sphereImgData.data.buffer);

    // Precalcular pixeles dentro del disco esferico para que el raytracer tarde < 1.8 ms por frame
    const sphereLut = [];
    const halfRes = SPHERE_RES / 2;
    const invHalf = 1 / (halfRes - 2);
    // Direccion de luz solar (arriba-izquierda-frente)
    const sunX = -0.42;
    const sunY = -0.35;
    const sunZ = 0.837;

    for (let py = 0; py < SPHERE_RES; py++) {
      const ny = (py - halfRes) * invHalf;
      for (let px = 0; px < SPHERE_RES; px++) {
        const nx = (px - halfRes) * invHalf;
        const r2 = nx * nx + ny * ny;
        if (r2 <= 1.0) {
          const nz = Math.sqrt(1.0 - r2);
          // Iluminacion difusa solar + fresnel atmosferico en el borde
          const dotSun = Math.max(0.18, nx * sunX + ny * sunY + nz * sunZ);
          const specBase = Math.pow(Math.max(0, dotSun), 16);
          const rim = Math.pow(1.0 - nz, 3.1);
          sphereLut.push({
            idx: py * SPHERE_RES + px,
            nx,
            ny,
            nz,
            dotSun,
            specBase,
            rim
          });
        }
      }
    }

    function renderizarEsferaSatelital3D(yawAngle, pitchAngle) {
      if (!texturasListas || !colorPixels) return false;

      const cosY = Math.cos(yawAngle);
      const sinY = Math.sin(yawAngle);
      const cosP = Math.cos(pitchAngle);
      const sinP = Math.sin(pitchAngle);

      sphereOut32.fill(0);
      const nPts = sphereLut.length;

      for (let i = 0; i < nPts; i++) {
        const pt = sphereLut[i];
        const nx = pt.nx;
        const y2 = pt.ny;
        const z2 = pt.nz;

        // Rotacion inversa exacta de pantalla a coordenadas terrestres
        const ey = y2 * cosP - z2 * sinP;
        const z1 = y2 * sinP + z2 * cosP;
        const ex = nx * cosY - z1 * sinY;
        const ez = nx * sinY + z1 * cosY;

        const lat = Math.asin(ey < -1 ? -1 : ey > 1 ? 1 : -ey);
        const lon = Math.atan2(ex, ez);

        let u = lon * INV_2PI + 0.5;
        if (u < 0) u += 1;
        else if (u >= 1) u -= 1;
        let v = 0.5 - lat * INV_PI;
        if (v < 0) v = 0;
        else if (v >= 1) v = 0.9999;

        const tx = (u * TEX_W) | 0;
        const ty = (v * TEX_H) | 0;
        const tIdx = (ty * TEX_W + tx) << 2;

        let r = colorPixels[tIdx];
        let g = colorPixels[tIdx + 1];
        let b = colorPixels[tIdx + 2];

        const esAgua = waterPixels ? waterPixels[tIdx] > 110 : b > r * 1.25;

        // Relieve topografico 3D (sombras y crestas de cordilleras en tierra firme)
        let reliefFactor = 1.0;
        if (!esAgua && bumpPixels) {
          const txNext = tx + 2 < TEX_W ? tx + 2 : tx;
          const tyNext = ty + 2 < TEX_H ? ty + 2 : ty;
          const h0 = bumpPixels[tIdx];
          const hX = bumpPixels[(ty * TEX_W + txNext) << 2];
          const hY = bumpPixels[(tyNext * TEX_W + tx) << 2];
          const slope = (hX - h0) * 0.011 + (hY - h0) * 0.011;
          reliefFactor = 1.0 + Math.max(-0.42, Math.min(0.48, slope));

          // Realzar ligeramente la saturacion natural de bosques, selvas y desiertos
          const elevBoost = (h0 / 255) * 22;
          r = Math.min(255, r * 1.12 + elevBoost * 0.8);
          g = Math.min(255, g * 1.14 + elevBoost * 0.45);
          b = Math.min(255, b * 1.02);
        } else if (esAgua) {
          // Oceano profundo con batimetria turquesa costera y brillo solar
          const spec = pt.specBase * 68;
          r = Math.min(255, r * 0.92 + spec * 0.55);
          g = Math.min(255, g * 1.08 + spec * 0.82);
          b = Math.min(255, Math.max(b * 1.18, 42) + spec);
        }

        const light = (0.28 + pt.dotSun * 0.84) * reliefFactor;
        const rimGlow = pt.rim;

        const outR = Math.max(0, Math.min(255, (r * light + rimGlow * 45) | 0));
        const outG = Math.max(0, Math.min(255, (g * light + rimGlow * 155) | 0));
        const outB = Math.max(0, Math.min(255, (b * light + rimGlow * 235) | 0));

        // Little-endian ABGR en Uint32Array
        sphereOut32[pt.idx] = (255 << 24) | (outB << 16) | (outG << 8) | outR;
      }

      sphereCtx.putImageData(sphereImgData, 0, 0);
      return true;
    }

    // Estado de camara centrado inicialmente en Merida, Yucatan
    let yaw = 89.6172 * DEG2RAD;
    let pitch = 20.9721 * DEG2RAD;
    let targetYaw = yaw;
    let targetPitch = pitch;

    let velYaw = 0;
    let velPitch = 0;

    let zoom = 1.14;
    let targetZoom = 1.14;

    let autoTour = true;
    let isDragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let estadoSeleccionado = "Yucatán";
    let usuarioEnfocado = null;
    let pulsoOnda = 0;
    let tick = 0;

    const datosPorEstado = {};
    Object.keys(COORDENADAS_ESTADOS).forEach((est) => {
      datosPorEstado[est] = {
        ...COORDENADAS_ESTADOS[est],
        estado: est,
        interacciones: 0,
        miembros: 0
      };
    });

    function centrarVistaPrincipalEnPantalla() {
      const panel = document.getElementById("globe-main-panel");
      if (!panel || panel.classList.contains("is-expanded")) return;
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function actualizarHUD(estadoKey, usuarioCustom = null) {
      const info = datosPorEstado[estadoKey];
      if (!info && !usuarioCustom) return;

      const elTag = document.getElementById("globe-hud-tag");
      const elCiudad = document.getElementById("globe-hud-city");
      const elUser = document.getElementById("globe-hud-user");
      const elInter = document.getElementById("globe-hud-inter");
      const elMiembros = document.getElementById("globe-hud-members");
      const elStatusText = document.getElementById("globe-status-text");

      const ciudad = usuarioCustom ? usuarioCustom.ciudad : info.ciudad;
      const estado = usuarioCustom ? usuarioCustom.estado : info.estado;
      const pais = usuarioCustom ? usuarioCustom.pais : info.pais;

      if (elTag) {
        elTag.textContent = usuarioCustom ? "Miembro localizado" : "Ciudad seleccionada";
      }
      if (elCiudad) {
        elCiudad.textContent = `${ciudad}, ${estado} · ${pais}`;
      }
      if (elUser) {
        if (usuarioCustom) {
          elUser.textContent = `👤 @${usuarioCustom.alias} · Participa en ${usuarioCustom.plataforma_principal || "la comunidad"}`;
        } else {
          elUser.textContent = "Comunidad activa en esta región";
        }
      }
      if (elInter && info) {
        elInter.textContent = `${info.interacciones} publicaciones`;
      }
      if (elMiembros) {
        if (usuarioCustom) {
          elMiembros.textContent = "Ubicación compartida";
        } else if (info && info.miembros) {
          elMiembros.textContent = `${info.miembros} miembros`;
        } else {
          elMiembros.textContent = "Comunidad activa";
        }
      }
      if (elStatusText) {
        elStatusText.textContent = usuarioCustom
          ? `Viendo la ciudad de @${usuarioCustom.alias} en ${ciudad}, ${estado}`
          : `Explorando ${ciudad}, ${estado} · Gira con tus dedos, tu mano o acércate con +`;
      }

      document.querySelectorAll(".heatmap-cell").forEach((cell) => {
        cell.classList.toggle("active-state", cell.dataset.estado === estadoKey);
      });
    }

    function pausarRecorridoAutomatico() {
      if (!autoTour) return;
      autoTour = false;
      const btnTour = document.getElementById("btn-globe-tour");
      if (btnTour) {
        btnTour.classList.remove("active");
        btnTour.textContent = "▶️ Reanudar giro";
      }
    }

    function enfocarEstado(estadoKey, manual = false, opciones = {}) {
      const info = datosPorEstado[estadoKey];
      if (!info) return;
      estadoSeleccionado = estadoKey;
      usuarioEnfocado = opciones.usuario || null;
      velYaw = 0;
      velPitch = 0;

      const latObjetivo = usuarioEnfocado ? Number(usuarioEnfocado.latitud) : info.lat;
      const lonObjetivo = usuarioEnfocado ? Number(usuarioEnfocado.longitud) : info.lon;

      targetYaw = -lonObjetivo * DEG2RAD;
      targetPitch = latObjetivo * DEG2RAD;
      pulsoOnda = 0;

      if (manual) {
        pausarRecorridoAutomatico();
        targetZoom = opciones.zoom || (usuarioEnfocado ? 2.15 : 1.75);
        if (opciones.centrarVista !== false) {
          centrarVistaPrincipalEnPantalla();
        }
      }

      actualizarHUD(estadoKey, usuarioEnfocado);
    }

    function enfocarUsuario(usuario) {
      if (!usuario || !usuario.consentimiento_datos || usuario.latitud === null) return;
      const estadoKey = datosPorEstado[usuario.estado] ? usuario.estado : "Yucatán";
      enfocarEstado(estadoKey, true, {
        usuario,
        zoom: 2.35,
        centrarVista: true
      });
    }

    function enfocarCoordenadas(lat, lon, etiqueta) {
      pausarRecorridoAutomatico();
      velYaw = 0;
      velPitch = 0;
      targetYaw = -Number(lon) * DEG2RAD;
      targetPitch = Number(lat) * DEG2RAD;
      targetZoom = 2.2;
      pulsoOnda = 0;

      const match = Object.keys(datosPorEstado).find(
        (k) =>
          Math.abs(datosPorEstado[k].lat - lat) < 2.2 &&
          Math.abs(datosPorEstado[k].lon - lon) < 2.2
      );
      if (match) {
        estadoSeleccionado = match;
      }
      usuarioEnfocado = {
        alias: etiqueta || "Mi ubicación",
        ciudad: match ? datosPorEstado[match].ciudad : "Mi ciudad",
        estado: match || "Yucatán",
        pais: "México",
        latitud: lat,
        longitud: lon,
        plataforma_principal: "Sesión actual"
      };
      actualizarHUD(estadoSeleccionado, usuarioEnfocado);
      centrarVistaPrincipalEnPantalla();
    }

    let tourIdx = 0;
    setInterval(() => {
      if (!autoTour || isDragging || handModeActive) return;
      const activos = Object.keys(datosPorEstado).sort(
        (a, b) => datosPorEstado[b].interacciones - datosPorEstado[a].interacciones
      );
      if (!activos.length) return;
      tourIdx = (tourIdx + 1) % activos.length;
      usuarioEnfocado = null;
      targetZoom = 1.16;
      enfocarEstado(activos[tourIdx], false);
    }, 3800);

    // =========================================================================
    // CONTROL TACTIL MOVIL, TRACKPAD Y RATON CON INERCIA
    // =========================================================================
    let nodosEnPantalla = [];
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    function aplicarDeltaRotacion(dx, dy) {
      pausarRecorridoAutomatico();
      const sensibilidad = 0.0075 / Math.max(0.85, Math.sqrt(zoom) * 0.75);
      const dYaw = -dx * sensibilidad;
      const dPitch = dy * sensibilidad;
      targetYaw += dYaw;
      targetPitch = Math.max(-1.42, Math.min(1.42, targetPitch + dPitch));
      yaw = targetYaw;
      pitch = targetPitch;
      velYaw = dYaw * 0.65;
      velPitch = dPitch * 0.65;
    }

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragMoved = false;
      pausarRecorridoAutomatico();
      velYaw = 0;
      velPitch = 0;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 3) dragMoved = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      aplicarDeltaRotacion(dx, dy);
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    canvas.addEventListener(
      "touchstart",
      (e) => {
        pausarRecorridoAutomatico();
        velYaw = 0;
        velPitch = 0;
        if (e.touches.length === 1) {
          isDragging = true;
          dragMoved = false;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          isDragging = false;
          pinchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          pinchStartZoom = targetZoom;
        }
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
          const dx = e.touches[0].clientX - dragStartX;
          const dy = e.touches[0].clientY - dragStartY;
          if (Math.hypot(dx, dy) > 3) dragMoved = true;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          aplicarDeltaRotacion(dx, dy);
        } else if (e.touches.length === 2 && pinchStartDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const ratio = dist / pinchStartDist;
          targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom * ratio));
        }
      },
      { passive: false }
    );

    canvas.addEventListener("touchend", () => {
      isDragging = false;
      pinchStartDist = 0;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
          aplicarDeltaRotacion(-e.deltaX * 0.85, -e.deltaY * 0.85);
          return;
        }
        const step = e.ctrlKey ? -e.deltaY * 0.018 : e.deltaY < 0 ? 0.28 : -0.28;
        targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, targetZoom * (1 + step * 0.45)));
      },
      { passive: false }
    );

    canvas.addEventListener("click", (e) => {
      if (dragMoved) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let mejor = null;
      let minDist = 28;
      for (const n of nodosEnPantalla) {
        const d = Math.hypot(n.sx - mx, n.sy - my);
        if (d < minDist) {
          minDist = d;
          mejor = n.estado;
        }
      }
      if (mejor) {
        enfocarEstado(mejor, true, { centrarVista: false });
      }
    });

    canvas.addEventListener("dblclick", () => {
      targetZoom = Math.min(ZOOM_MAX, targetZoom * 1.45);
    });

    // =========================================================================
    // CONTROL POR GESTOS DE LA MANO FRENTE A LA CAMARA ("🖐️ Girar con la mano")
    // =========================================================================
    let handModeActive = false;
    let handStream = null;
    let prevHandFrame = null;
    let smoothHandX = null;
    let smoothHandY = null;
    const btnHand = document.getElementById("btn-globe-hand");
    const handBox = document.getElementById("globe-hand-box");
    const handVideo = document.getElementById("globe-hand-video");
    const handOverlay = document.getElementById("globe-hand-overlay");
    const handHint = document.getElementById("globe-hand-hint");
    const btnHandClose = document.getElementById("btn-globe-hand-close");
    const procCanvas = document.createElement("canvas");
    procCanvas.width = 64;
    procCanvas.height = 48;
    const procCtx = procCanvas.getContext("2d", { willReadFrequently: true });

    async function activarControlMano() {
      if (handModeActive) {
        desactivarControlMano();
        return;
      }
      try {
        handStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false
        });
        handVideo.srcObject = handStream;
        handModeActive = true;
        prevHandFrame = null;
        smoothHandX = null;
        smoothHandY = null;
        pausarRecorridoAutomatico();

        if (handBox) handBox.style.display = "block";
        if (btnHand) {
          btnHand.classList.add("active");
          btnHand.textContent = "🖐️ Mano activa (Detener)";
        }
        const elStatus = document.getElementById("globe-status-text");
        if (elStatus) {
          elStatus.textContent = "Mueve tu mano frente a la cámara hacia los lados o arriba/abajo para girar la Tierra";
        }
      } catch (_err) {
        const elStatus = document.getElementById("globe-status-text");
        if (elStatus) {
          elStatus.textContent = "Cámara no disponible · Gira el planeta deslizando con tus dedos en pantalla o el trackpad";
        }
      }
    }

    function desactivarControlMano() {
      handModeActive = false;
      if (handStream) {
        handStream.getTracks().forEach((t) => t.stop());
        handStream = null;
      }
      if (handBox) handBox.style.display = "none";
      if (btnHand) {
        btnHand.classList.remove("active");
        btnHand.textContent = "🖐️ Girar con la mano";
      }
    }

    function procesarGestoMano() {
      if (!handModeActive || !handVideo || handVideo.readyState < 2) return;
      const w = procCanvas.width;
      const h = procCanvas.height;
      procCtx.drawImage(handVideo, 0, 0, w, h);
      const frame = procCtx.getImageData(0, 0, w, h).data;

      if (handOverlay) {
        handOverlay.width = 180;
        handOverlay.height = 115;
      }
      const oCtx = handOverlay ? handOverlay.getContext("2d") : null;
      if (oCtx) oCtx.clearRect(0, 0, handOverlay.width, handOverlay.height);

      let sumX = 0;
      let sumY = 0;
      let totalWeight = 0;

      if (prevHandFrame) {
        for (let y = 2; y < h - 2; y++) {
          for (let x = 2; x < w - 2; x++) {
            const idx = (y * w + x) * 4;
            const r = frame[idx];
            const g = frame[idx + 1];
            const b = frame[idx + 2];
            const pr = prevHandFrame[idx];
            const pg = prevHandFrame[idx + 1];
            const pb = prevHandFrame[idx + 2];

            const diff = Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb);
            const esPiel = r > 75 && g > 40 && r > g && r > b;
            const peso = diff > 38 ? (esPiel ? diff * 2.2 : diff) : 0;

            if (peso > 0) {
              sumX += x * peso;
              sumY += y * peso;
              totalWeight += peso;
            }
          }
        }
      }

      prevHandFrame = new Uint8ClampedArray(frame);

      if (totalWeight > 1900) {
        const cxHand = sumX / totalWeight;
        const cyHand = sumY / totalWeight;

        if (smoothHandX !== null && smoothHandY !== null) {
          const dx = -(cxHand - smoothHandX);
          const dy = cyHand - smoothHandY;

          if (Math.hypot(dx, dy) > 0.35) {
            aplicarDeltaRotacion(dx * 16, dy * 14);
          }

          if (totalWeight > 28000) {
            targetZoom = Math.min(ZOOM_MAX, targetZoom + 0.025);
            if (handHint) handHint.textContent = "🖐️ Mano cerca: Acercando (+)";
          } else if (handHint) {
            handHint.textContent = "🖐️ Girando la Tierra con tu mano";
          }
        }

        smoothHandX = smoothHandX === null ? cxHand : smoothHandX * 0.55 + cxHand * 0.45;
        smoothHandY = smoothHandY === null ? cyHand : smoothHandY * 0.55 + cyHand * 0.45;

        if (oCtx && handOverlay) {
          const ox = (smoothHandX / w) * handOverlay.width;
          const oy = (smoothHandY / h) * handOverlay.height;
          oCtx.beginPath();
          oCtx.arc(ox, oy, 16, 0, Math.PI * 2);
          oCtx.strokeStyle = "#34D399";
          oCtx.lineWidth = 2.5;
          oCtx.stroke();

          oCtx.beginPath();
          oCtx.arc(ox, oy, 4, 0, Math.PI * 2);
          oCtx.fillStyle = "#38BDF8";
          oCtx.fill();
        }
      } else {
        smoothHandX = null;
        smoothHandY = null;
        if (handHint) handHint.textContent = "Mueve tu mano frente a la cámara";
      }
    }

    if (btnHand) btnHand.addEventListener("click", activarControlMano);
    if (btnHandClose) btnHandClose.addEventListener("click", desactivarControlMano);

    // =========================================================================
    // CONTROLES DE INTERFAZ Y ZOOM
    // =========================================================================
    const btnTour = document.getElementById("btn-globe-tour");
    if (btnTour) {
      btnTour.addEventListener("click", () => {
        autoTour = !autoTour;
        if (autoTour) {
          usuarioEnfocado = null;
          targetZoom = 1.16;
        }
        btnTour.classList.toggle("active", autoTour);
        btnTour.textContent = autoTour ? "🔄 Giro automático" : "▶️ Reanudar giro";
      });
    }

    const btnMyLoc = document.getElementById("btn-globe-my-loc");
    if (btnMyLoc) {
      btnMyLoc.addEventListener("click", () => {
        const emailActual = localStorage.getItem("c360_email") || "Mi cuenta";
        const nombreLimpio = emailActual.split("@")[0];
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              enfocarCoordenadas(pos.coords.latitude, pos.coords.longitude, nombreLimpio);
            },
            () => {
              enfocarCoordenadas(20.9721, -89.6172, nombreLimpio);
            },
            { timeout: 2200 }
          );
        } else {
          enfocarCoordenadas(20.9721, -89.6172, nombreLimpio);
        }
      });
    }

    const selectUser = document.getElementById("select-globe-user");
    let listaUsuariosAutorizados = [];
    if (selectUser) {
      selectUser.addEventListener("change", () => {
        const idSel = selectUser.value;
        if (!idSel) return;
        const usr = listaUsuariosAutorizados.find((u) => u.id_usuario === idSel);
        if (usr) enfocarUsuario(usr);
      });
    }

    const btnZoomIn = document.getElementById("btn-globe-zoom-in");
    const btnZoomOut = document.getElementById("btn-globe-zoom-out");
    const btnCenter = document.getElementById("btn-globe-center");
    const btnExpand = document.getElementById("btn-globe-expand");
    const btnExpandFloat = document.getElementById("btn-globe-fullscreen-float");

    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => {
        pausarRecorridoAutomatico();
        targetZoom = Math.min(ZOOM_MAX, targetZoom * 1.38);
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => {
        pausarRecorridoAutomatico();
        targetZoom = Math.max(ZOOM_MIN, targetZoom / 1.38);
      });
    }
    if (btnCenter) {
      btnCenter.addEventListener("click", () => {
        enfocarEstado(estadoSeleccionado, true, {
          usuario: usuarioEnfocado,
          zoom: 1.9,
          centrarVista: true
        });
      });
    }

    function alternarModoExpandido(forzarEstado) {
      const panel = document.getElementById("globe-main-panel");
      if (!panel) return;
      const nuevoEstado =
        typeof forzarEstado === "boolean"
          ? forzarEstado
          : !panel.classList.contains("is-expanded");

      panel.classList.toggle("is-expanded", nuevoEstado);
      backdropEl.classList.toggle("visible", nuevoEstado);

      if (btnExpand) {
        btnExpand.textContent = nuevoEstado ? "✕ Salir de pantalla completa" : "⛶ Pantalla completa";
      }
      setTimeout(ajustarCanvas, 50);
    }

    if (btnExpand) btnExpand.addEventListener("click", () => alternarModoExpandido());
    if (btnExpandFloat) btnExpandFloat.addEventListener("click", () => alternarModoExpandido());
    backdropEl.addEventListener("click", () => alternarModoExpandido(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") alternarModoExpandido(false);
    });

    document.querySelectorAll("[data-globe-region]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reg = btn.getAttribute("data-globe-region");
        usuarioEnfocado = null;
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
      const w = parent.clientWidth || 720;
      const h = parent.clientHeight || 520;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
    }

    window.addEventListener("resize", ajustarCanvas);

    const vistaActividadEl = document.getElementById("vista-actividad");

    // Ping ligero cada 4 minutos para mantener despierto el servicio en Render
    setInterval(() => {
      fetch("/healthz").catch(() => {});
    }, 4 * 60 * 1000);

    function renderizarGlobo() {
      if (
        document.hidden ||
        (vistaActividadEl && !vistaActividadEl.classList.contains("active"))
      ) {
        requestAnimationFrame(renderizarGlobo);
        return;
      }

      ajustarCanvas();
      if (handModeActive && Math.round(tick * 50) % 2 === 0) {
        procesarGestoMano();
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (!isDragging) {
        if (Math.abs(velYaw) > 0.0001 || Math.abs(velPitch) > 0.0001) {
          targetYaw += velYaw;
          targetPitch = Math.max(-1.42, Math.min(1.42, targetPitch + velPitch));
          velYaw *= 0.93;
          velPitch *= 0.93;
        }
        let diffYaw = targetYaw - yaw;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        yaw += diffYaw * 0.09;
        pitch += (targetPitch - pitch) * 0.09;
      }
      zoom += (targetZoom - zoom) * 0.11;

      tick += 0.022;
      pulsoOnda = (pulsoOnda + 0.022) % 1;

      const cx = width / 2;
      const cy = height / 2;
      const esMovil = width < 520;
      const baseRadius = Math.min(width, height) * (esMovil ? 0.39 : 0.38);
      const radius = baseRadius * zoom;

      // 0) Estrellas de espacio profundo
      for (let i = 0; i < ESTRELLAS_FONDO.length; i++) {
        const st = ESTRELLAS_FONDO[i];
        const sx = st.u * width;
        const sy = st.v * height;
        const distCentro = Math.hypot(sx - cx, sy - cy);
        if (distCentro < radius * 1.02) continue;
        const twinkle = 0.28 + 0.55 * (0.5 + 0.5 * Math.sin(tick * 1.6 + st.phase));
        ctx.fillStyle = `rgba(226, 232, 240, ${twinkle.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 1) Resplandor atmosferico exterior (halo de dispersion Rayleigh)
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.18);
      haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.38)");
      haloGrad.addColorStop(0.45, "rgba(14, 165, 233, 0.12)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
      ctx.fill();

      // 2) Esfera Satelital 3D Fotorrealista (NASA Blue Marble + Relieve Topografico 3D + Reflejo Solar)
      const okSat = renderizarEsferaSatelital3D(yaw, pitch);
      if (okSat) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const scalePad = radius * 1.012;
        ctx.drawImage(
          sphereCanvas,
          cx - scalePad,
          cy - scalePad,
          scalePad * 2,
          scalePad * 2
        );
        ctx.restore();
      } else {
        // Fallback inmediato mientras termina de decodificar la textura en el primer frame
        const oceanGrad = ctx.createRadialGradient(
          cx - radius * 0.32,
          cy - radius * 0.32,
          radius * 0.06,
          cx,
          cy,
          radius
        );
        oceanGrad.addColorStop(0, "#0F3868");
        oceanGrad.addColorStop(1, "#030B18");
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = oceanGrad;
        ctx.fill();
      }

      // Borde atmosferico nitido del planeta
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "rgba(125, 211, 252, 0.55)";
      ctx.stroke();

      // 3) Nombres geograficos de paises sobre la superficie satelital (estilo Google Earth / Earth 3D Map)
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < PAISES_ETIQUETAS.length; i++) {
        const pais = PAISES_ETIQUETAS[i];
        if (!pais.principal && zoom < 1.35) continue;
        const pPais = rotarPunto(latLonToXYZ(pais.lat, pais.lon, radius), yaw, pitch);
        if (pPais.z < radius * 0.38) continue;

        const px = cx + pPais.x;
        const py = cy + pPais.y;
        const vis = Math.min(1, (pPais.z / radius - 0.35) * 1.8);
        ctx.font = pais.principal
          ? "700 10px 'Inter', sans-serif"
          : "600 9px 'Inter', sans-serif";
        ctx.fillStyle = `rgba(248, 250, 252, ${(0.68 * vis).toFixed(2)})`;
        ctx.strokeStyle = `rgba(2, 6, 23, ${(0.85 * vis).toFixed(2)})`;
        ctx.lineWidth = 2.6;
        ctx.strokeText(pais.nombre, px, py);
        ctx.fillText(pais.nombre, px, py);
      }
      ctx.restore();

      // 4) Arcos 3D de conexion entre ciudades de la comunidad
      const centroHub = datosPorEstado["Yucatán"] || datosPorEstado["CDMX"];
      if (centroHub) {
        const pHubSurf = rotarPunto(
          latLonToXYZ(centroHub.lat, centroHub.lon, radius),
          yaw,
          pitch
        );

        Object.values(datosPorEstado).forEach((dest, idx) => {
          if (dest.estado === centroHub.estado || dest.interacciones <= 0) return;
          const pDestSurf = rotarPunto(
            latLonToXYZ(dest.lat, dest.lon, radius),
            yaw,
            pitch
          );
          if (pHubSurf.z < -radius * 0.15 || pDestSurf.z < -radius * 0.15) return;

          const midLat = (centroHub.lat + dest.lat) / 2;
          const midLon = (centroHub.lon + dest.lon) / 2;
          const arcLift = 1 + 0.16 / Math.max(1, zoom * 0.55);
          const pMid = rotarPunto(
            latLonToXYZ(midLat, midLon, radius * arcLift),
            yaw,
            pitch
          );

          const x0 = cx + pHubSurf.x;
          const y0 = cy + pHubSurf.y;
          const xm = cx + pMid.x;
          const ym = cy + pMid.y;
          const x1 = cx + pDestSurf.x;
          const y1 = cy + pDestSurf.y;

          const esDestinoActivo = dest.estado === estadoSeleccionado;

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(xm, ym, x1, y1);
          ctx.strokeStyle = esDestinoActivo
            ? "rgba(52, 211, 153, 0.92)"
            : "rgba(56, 189, 248, 0.35)";
          ctx.lineWidth = esDestinoActivo ? 2.2 : 1.1;
          ctx.stroke();

          const tPkt = (tick * 0.6 + idx * 0.17) % 1;
          const inv = 1 - tPkt;
          const px = inv * inv * x0 + 2 * inv * tPkt * xm + tPkt * tPkt * x1;
          const py = inv * inv * y0 + 2 * inv * tPkt * ym + tPkt * tPkt * y1;
          ctx.beginPath();
          ctx.arc(px, py, esDestinoActivo ? 3 : 2.1, 0, Math.PI * 2);
          ctx.fillStyle = esDestinoActivo ? "#34D399" : "#38BDF8";
          ctx.fill();
        });
      }

      // 5) Marcadores y etiquetas de las 21 ciudades de la comunidad
      const maxInter = Math.max(
        1,
        ...Object.values(datosPorEstado).map((d) => d.interacciones || 1)
      );
      nodosEnPantalla = [];
      const etiquetasDibujadas = [];

      const listaOrdenada = Object.values(datosPorEstado).sort((a, b) => {
        if (a.estado === estadoSeleccionado) return 1;
        if (b.estado === estadoSeleccionado) return -1;
        return (a.interacciones || 0) - (b.interacciones || 0);
      });

      listaOrdenada.forEach((loc) => {
        const pBase = rotarPunto(latLonToXYZ(loc.lat, loc.lon, radius), yaw, pitch);
        if (pBase.z < 0) return;

        const ratio = (loc.interacciones || 1) / maxInter;
        const alturaPilar = 10 + ratio * 22;
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
          tx,
          ty,
          z: pBase.z,
          loc,
          esActivo
        });

        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = esActivo ? "#10B981" : "rgba(56, 189, 248, 0.9)";
        ctx.lineWidth = esActivo ? 3.2 : 1.9;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bx, by, esActivo ? 5.2 : 3.4, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#10B981" : "#38BDF8";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#090D16";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(tx, ty, esActivo ? 4.2 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#A7F3D0" : "#F8FAFC";
        ctx.fill();

        if (esActivo) {
          const rOnda = 8 + pulsoOnda * 30;
          ctx.beginPath();
          ctx.arc(bx, by, rOnda, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - pulsoOnda).toFixed(2)})`;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
      });

      const candidatosEtiqueta = [...nodosEnPantalla].sort((a, b) => {
        if (a.esActivo) return -1;
        if (b.esActivo) return 1;
        return (b.loc.interacciones || 0) - (a.loc.interacciones || 0);
      });

      candidatosEtiqueta.forEach((n) => {
        const { loc, tx, ty, z, esActivo } = n;
        if (!esActivo && z < radius * 0.42 && zoom < 2.2) return;
        if (!esActivo && loc.interacciones < 10 && zoom < 1.9) return;

        const choca =
          !esActivo &&
          etiquetasDibujadas.some(
            (prev) => Math.abs(prev.x - tx) < 88 && Math.abs(prev.y - ty) < 24
          );
        if (choca) return;

        etiquetasDibujadas.push({ x: tx, y: ty });

        ctx.font = esActivo
          ? "700 12px 'Inter', sans-serif"
          : "600 10.5px 'Inter', sans-serif";
        const labelTxt =
          esActivo && usuarioEnfocado
            ? `📍 @${usuarioEnfocado.alias} · ${loc.ciudad}`
            : `${loc.ciudad} (${loc.interacciones})`;

        const textW = ctx.measureText(labelTxt).width;
        ctx.fillStyle = esActivo ? "rgba(6, 78, 59, 0.92)" : "rgba(15, 23, 42, 0.86)";
        ctx.beginPath();
        ctx.roundRect(tx + 7, ty - 11, textW + 12, 20, 6);
        ctx.fill();
        ctx.strokeStyle = esActivo ? "#34D399" : "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = esActivo ? "#A7F3D0" : "#F8FAFC";
        ctx.fillText(labelTxt, tx + 13, ty + 3);
      });

      ctx.restore();
      requestAnimationFrame(renderizarGlobo);
    }

    requestAnimationFrame(renderizarGlobo);

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
        actualizarHUD(estadoSeleccionado, usuarioEnfocado);
      },
      cargarUsuariosConUbicacion(usuarios) {
        if (!Array.isArray(usuarios)) return;
        const conPermiso = usuarios.filter(
          (u) => u.consentimiento_datos && u.latitud !== null && u.estado
        );
        if (!conPermiso.length) return;
        listaUsuariosAutorizados = conPermiso;

        if (selectUser) {
          const valorPrevio = selectUser.value;
          selectUser.innerHTML =
            `<option value="">👤 Elegir miembro...</option>` +
            conPermiso
              .map(
                (u) =>
                  `<option value="${u.id_usuario}">@${u.alias} — ${u.ciudad}, ${u.estado}</option>`
              )
              .join("");
          if (valorPrevio) selectUser.value = valorPrevio;
        }
      },
      enfocarEstado,
      enfocarUsuario,
      enfocarCoordenadas,
      alternarModoExpandido
    };
  });
})();
