/**
 * Planeta Tierra 3D Interactivo de Community 360
 * Renderiza el planeta Tierra con continentes realistas, oceanos con reflejo solar,
 * plataforma continental turquesa, capa de nubes atmosfericas, estrellas de fondo,
 * rotacion exacta hacia la localizacion del usuario centrada en pantalla,
 * zoom interactivo y modo expandido a vista principal de pantalla completa.
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

  // Poligonos continentales detallados [lat, lon] para renderizar la Tierra en 3D
  const CONTINENTES_TIERRA = [
    {
      nombre: "Norteamérica, México y Centroamérica",
      bioma: "templado",
      coords: [
        [70, -162], [71, -156], [69, -138], [68, -125], [64, -110], [60, -95],
        [63, -82], [61, -77], [58, -64], [52, -56], [47, -61], [44, -66],
        [41, -70], [39, -74], [35, -76], [31, -81], [25, -80], [25, -82],
        [29, -84], [30, -89], [29, -95], [26, -97], [22, -98], [19, -96],
        [18, -94], [18.5, -91.5], [21.3, -90], [21.5, -87], [18.5, -88],
        [16, -88.5], [15.5, -85], [14, -83.5], [11, -83.5], [9.5, -82.5],
        [8.5, -79.5], [7.8, -77.5], [8.2, -79], [8.5, -83], [11, -86],
        [13.5, -88], [14.5, -92.5], [16, -95], [16, -98], [18, -103],
        [20.5, -105.5], [23, -106.5], [26, -109.5], [29, -112.5], [31.5, -114.5],
        [28, -114], [23, -110], [24.5, -112], [28, -115], [32.5, -117.2],
        [34.5, -120.5], [38, -123], [43, -124.5], [48, -124.7], [54, -130],
        [59, -138], [61, -149], [55, -162], [60, -165], [65, -168]
      ]
    },
    {
      nombre: "Cuba",
      bioma: "tropical",
      coords: [
        [22, -84.8], [23.1, -82], [22.5, -79], [21, -76], [20, -74.2],
        [19.9, -77.5], [21.5, -80], [21.8, -83.5]
      ]
    },
    {
      nombre: "La Española y Caribe",
      bioma: "tropical",
      coords: [
        [19.9, -73.4], [19.7, -70.5], [18.6, -68.4], [18, -71.5], [18.4, -74.4]
      ]
    },
    {
      nombre: "Sudamérica",
      bioma: "tropical",
      coords: [
        [11, -75], [12, -71.5], [10.5, -67], [10.5, -62], [8.5, -60],
        [6, -55], [4.5, -51.5], [1, -50], [-1.5, -45], [-3.5, -38.5],
        [-6, -35], [-10, -36], [-13, -38.5], [-18, -39.5], [-23, -42],
        [-25, -48], [-30, -50], [-34.5, -54], [-35.5, -57], [-38.5, -58],
        [-41, -63], [-46, -67], [-52, -69], [-55, -67], [-53, -73],
        [-46, -75], [-39, -73.5], [-33, -71.8], [-27, -71], [-21, -70.2],
        [-18, -71], [-14, -76], [-11, -78], [-5, -81.3], [-1, -80.8],
        [2, -78.8], [5, -77.5], [8, -77.2]
      ]
    },
    {
      nombre: "Groenlandia",
      bioma: "polar",
      coords: [
        [60, -44], [65, -38], [70, -23], [77, -19], [82, -30],
        [81, -55], [76, -68], [70, -54], [64, -52]
      ]
    },
    {
      nombre: "Europa y Península Ibérica",
      bioma: "templado",
      coords: [
        [36.1, -5.6], [37, -8.9], [41.8, -8.9], [43.4, -8.4], [43.4, -1.8],
        [46, -1.3], [48.5, -4.5], [49.5, -1.5], [51, 1.8], [53.5, 6.5],
        [57, 8.5], [55, 10.5], [54.5, 14], [55, 20], [59.5, 24],
        [60.5, 28], [66, 25], [70, 28], [71, 24], [68, 15],
        [62, 5], [58, 7], [60, 11], [65, 21], [59, 18],
        [56, 15.5], [54, 11], [54, 9], [48, 8], [44.5, 9],
        [41, 14], [38, 15.8], [40.5, 18], [44, 13], [45.5, 13.5],
        [42, 19], [38, 21], [37.5, 24], [40.5, 23], [41, 29],
        [45, 30], [46, 35], [42, 28], [37, 27], [36, 22],
        [44, 7], [43.2, 5.4], [42.5, 3.2], [40.6, 0.6], [38.8, 0.1],
        [36.7, -2.2]
      ]
    },
    {
      nombre: "Islas Británicas",
      bioma: "templado",
      coords: [
        [50.1, -5.2], [51.4, 1.3], [53.6, 0.1], [56, -2.8],
        [58.6, -3.1], [57.5, -5.8], [55, -5], [53.3, -4.5], [51.5, -5]
      ]
    },
    {
      nombre: "África",
      bioma: "continental",
      coords: [
        [35.8, -5.8], [36.9, 3], [37.2, 10.2], [33, 11.5], [32.5, 22],
        [31.5, 32], [28, 34], [22, 37], [12, 43.5], [11.8, 51.2],
        [4, 48], [-1, 41.5], [-7, 39.5], [-15, 40.7], [-20, 35],
        [-26, 32.8], [-34, 25.5], [-34.8, 19.5], [-30, 17], [-22, 14.3],
        [-15, 12], [-6, 12.2], [0, 9.4], [4.2, 8.8], [6.4, 3.4],
        [4.8, -2], [4.5, -7.5], [8.5, -13.3], [14.7, -17.4], [21, -17],
        [27.5, -13], [32, -9.5]
      ]
    },
    {
      nombre: "Asia y Oriente",
      bioma: "continental",
      coords: [
        [41, 29], [42, 41], [46, 48], [68, 68], [72, 105], [70, 140],
        [66, 175], [60, 162], [52, 141], [43, 132], [38, 125], [35, 120],
        [31, 121.5], [24, 118], [22, 114], [20, 106], [12, 109], [9, 105],
        [13.5, 100.5], [3, 101.5], [1.3, 103.8], [7, 99], [16, 97],
        [22, 91.5], [16, 81], [8, 77.5], [15, 74], [22, 69], [25, 66],
        [25.5, 57], [29.5, 48], [24, 54], [21, 59], [14, 49], [12.8, 43.4],
        [20, 40], [29, 34.8], [31.5, 34.5], [36, 36], [37, 27]
      ]
    },
    {
      nombre: "Japón",
      bioma: "templado",
      coords: [
        [31.5, 130.5], [34.5, 136], [35.6, 140.5], [39.5, 142],
        [43.5, 145], [41, 140], [37, 137], [34, 131]
      ]
    },
    {
      nombre: "Australia",
      bioma: "continental",
      coords: [
        [-12, 131], [-12, 136], [-11, 142.5], [-18, 146], [-25, 153],
        [-33.8, 151.2], [-38, 145], [-35, 136], [-32, 128], [-34, 115],
        [-26, 113.5], [-21, 114.5], [-16, 123]
      ]
    },
    {
      nombre: "Antártida",
      bioma: "polar",
      coords: [
        [-66, -180], [-65, -140], [-71, -100], [-64, -60], [-70, -20],
        [-68, 20], [-66, 60], [-66, 100], [-67, 140], [-66, 180],
        [-84, 180], [-84, -180]
      ]
    }
  ];

  // Bandas de nubes atmosfericas que flotan suavemente sobre la Tierra
  const NUBES_ATMOSFERA = [
    { lat: 24, lon: -92, rx: 14, ry: 4.5, alpha: 0.16 },
    { lat: 12, lon: -78, rx: 18, ry: 5, alpha: 0.15 },
    { lat: -8, lon: -58, rx: 20, ry: 6, alpha: 0.16 },
    { lat: 36, lon: -42, rx: 22, ry: 5.5, alpha: 0.14 },
    { lat: 46, lon: -12, rx: 16, ry: 4.5, alpha: 0.15 },
    { lat: -24, lon: -66, rx: 16, ry: 4.5, alpha: 0.14 },
    { lat: 40, lon: -108, rx: 17, ry: 5, alpha: 0.14 },
    { lat: 2, lon: -25, rx: 24, ry: 5, alpha: 0.15 }
  ];

  // Estrellas de espacio profundo
  const ESTRELLAS_FONDO = Array.from({ length: 85 }, (_, i) => ({
    u: ((i * 73 + 19) % 100) / 100,
    v: ((i * 41 + 37) % 100) / 100,
    r: 0.6 + (i % 3) * 0.55,
    phase: i * 0.8
  }));

  const DEG2RAD = Math.PI / 180;

  function latLonToXYZ(lat, lon, radius) {
    const phi = lat * DEG2RAD;
    const lam = lon * DEG2RAD;
    return {
      x: radius * Math.cos(phi) * Math.sin(lam),
      y: -radius * Math.sin(phi),
      z: radius * Math.cos(phi) * Math.cos(lam)
    };
  }

  /**
   * Rotacion esferica 3D corregida:
   * Cuando yaw = -lon * DEG2RAD y pitch = +lat * DEG2RAD,
   * el punto (lat, lon) queda exactamente en (x = 0, y = 0, z = +radius),
   * es decir, 100% centrado frente al usuario.
   */
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

    // Crear backdrop para el modo expandido a pantalla completa
    let backdropEl = document.getElementById("globe-backdrop-overlay");
    if (!backdropEl) {
      backdropEl = document.createElement("div");
      backdropEl.id = "globe-backdrop-overlay";
      backdropEl.className = "globe-backdrop-overlay";
      document.body.appendChild(backdropEl);
    }

    // Estado de camara centrado inicialmente en Yucatan, Mexico (20.97 N, -89.62 O)
    let yaw = 89.6172 * DEG2RAD;
    let pitch = 20.9721 * DEG2RAD;
    let targetYaw = yaw;
    let targetPitch = pitch;

    let zoom = 1.08;
    let targetZoom = 1.08;

    let autoTour = true;
    let isDragging = false;
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
      const elCoords = document.getElementById("globe-hud-coords");
      const elInter = document.getElementById("globe-hud-inter");
      const elMiembros = document.getElementById("globe-hud-members");
      const elStatusText = document.getElementById("globe-status-text");

      const lat = usuarioCustom ? Number(usuarioCustom.latitud) : info.lat;
      const lon = usuarioCustom ? Number(usuarioCustom.longitud) : info.lon;
      const ciudad = usuarioCustom ? usuarioCustom.ciudad : info.ciudad;
      const estado = usuarioCustom ? usuarioCustom.estado : info.estado;
      const pais = usuarioCustom ? usuarioCustom.pais : info.pais;

      if (elTag) {
        elTag.textContent = usuarioCustom
          ? `LOCALIZACIÓN DE MIEMBRO (${usuarioCustom.id_usuario})`
          : "LOCALIZACIÓN CENTRADA EN 3D";
      }
      if (elCiudad) {
        elCiudad.textContent = `${ciudad}, ${estado} (${pais})`;
      }
      if (elUser) {
        if (usuarioCustom) {
          elUser.textContent = `👤 @${usuarioCustom.alias} · ${usuarioCustom.plataforma_principal || "Comunidad"} · ${usuarioCustom.mensajes_30d || 0} msjs`;
        } else {
          elUser.textContent = `Región activa de Community 360`;
        }
      }
      if (elCoords) {
        const ns = lat >= 0 ? "N" : "S";
        const eo = lon >= 0 ? "E" : "O";
        elCoords.textContent = `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${eo}`;
      }
      if (elInter && info) {
        elInter.textContent = `${info.interacciones} publicaciones`;
      }
      if (elMiembros) {
        if (usuarioCustom) {
          elMiembros.textContent = `Consentimiento verificado`;
        } else if (info && info.miembros) {
          elMiembros.textContent = `${info.miembros} miembros`;
        } else {
          elMiembros.textContent = "Ubicación verificada";
        }
      }
      if (elStatusText) {
        elStatusText.textContent = usuarioCustom
          ? `Enfocando a @${usuarioCustom.alias} en ${ciudad}, ${estado} (${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "O"})`
          : `Planeta Tierra centrado en ${ciudad}, ${estado} · Zoom ${targetZoom.toFixed(1)}x`;
      }

      document.querySelectorAll(".heatmap-cell").forEach((cell) => {
        cell.classList.toggle("active-state", cell.dataset.estado === estadoKey);
      });
    }

    function pausarRecorridoAutomatico() {
      autoTour = false;
      const btnTour = document.getElementById("btn-globe-tour");
      if (btnTour) {
        btnTour.classList.remove("active");
        btnTour.textContent = "Reanudar recorrido 3D";
      }
    }

    function enfocarEstado(estadoKey, manual = false, opciones = {}) {
      const info = datosPorEstado[estadoKey];
      if (!info) return;
      estadoSeleccionado = estadoKey;
      usuarioEnfocado = opciones.usuario || null;

      const latObjetivo = usuarioEnfocado ? Number(usuarioEnfocado.latitud) : info.lat;
      const lonObjetivo = usuarioEnfocado ? Number(usuarioEnfocado.longitud) : info.lon;

      targetYaw = -lonObjetivo * DEG2RAD;
      targetPitch = latObjetivo * DEG2RAD;
      pulsoOnda = 0;

      if (manual) {
        pausarRecorridoAutomatico();
        targetZoom = opciones.zoom || (usuarioEnfocado ? 1.62 : 1.42);
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
        zoom: 1.68,
        centrarVista: true
      });
    }

    function enfocarCoordenadas(lat, lon, etiqueta) {
      pausarRecorridoAutomatico();
      targetYaw = -Number(lon) * DEG2RAD;
      targetPitch = Number(lat) * DEG2RAD;
      targetZoom = 1.58;
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
        id_usuario: "GPS-LOCAL",
        alias: etiqueta || "Mi ubicación actual",
        ciudad: match ? datosPorEstado[match].ciudad : "Ubicación local",
        estado: match || "Mérida / Yucatán",
        pais: "México",
        latitud: lat,
        longitud: lon,
        plataforma_principal: "Sesión activa",
        mensajes_30d: 1
      };
      actualizarHUD(estadoSeleccionado, usuarioEnfocado);
      centrarVistaPrincipalEnPantalla();
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
      usuarioEnfocado = null;
      targetZoom = 1.12;
      enfocarEstado(activos[tourIdx], false);
    }, 3800);

    // Eventos de raton y rueda de zoom sobre el planeta Tierra 3D
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
      targetYaw -= (dx * 0.0065) / Math.max(1, zoom * 0.7);
      targetPitch = Math.max(-1.35, Math.min(1.35, targetPitch + (dy * 0.0065) / Math.max(1, zoom * 0.7)));
      yaw = targetYaw;
      pitch = targetPitch;
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 0.16 : -0.16;
        targetZoom = Math.max(0.82, Math.min(2.85, targetZoom + factor));
      },
      { passive: false }
    );

    // Clic sobre un marcador en la Tierra 3D
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let mejor = null;
      let minDist = 26;
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

    // Doble clic en el planeta alterna pantalla completa / vista expandida
    canvas.addEventListener("dblclick", () => {
      alternarModoExpandido();
    });

    // Botones de control del mapa 3D
    const btnTour = document.getElementById("btn-globe-tour");
    if (btnTour) {
      btnTour.addEventListener("click", () => {
        autoTour = !autoTour;
        if (autoTour) {
          usuarioEnfocado = null;
          targetZoom = 1.12;
        }
        btnTour.classList.toggle("active", autoTour);
        btnTour.textContent = autoTour ? "Recorrido 3D activo" : "Reanudar recorrido 3D";
      });
    }

    // Boton "Mi ubicacion"
    const btnMyLoc = document.getElementById("btn-globe-my-loc");
    if (btnMyLoc) {
      btnMyLoc.addEventListener("click", () => {
        const emailActual = localStorage.getItem("c360_email") || "Mi ubicación";
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              enfocarCoordenadas(
                pos.coords.latitude,
                pos.coords.longitude,
                `${emailActual.split("@")[0]} (GPS actual)`
              );
            },
            () => {
              // Fallback inmediato a Merida, Yucatan (UT Metropolitana)
              enfocarCoordenadas(20.9721, -89.6172, `${emailActual.split("@")[0]} (Mérida, Yucatán)`);
            },
            { timeout: 2200 }
          );
        } else {
          enfocarCoordenadas(20.9721, -89.6172, `${emailActual.split("@")[0]} (Mérida, Yucatán)`);
        }
      });
    }

    // Selector de miembros con ubicacion autorizada
    const selectUser = document.getElementById("select-globe-user");
    let listaUsuariosAutorizados = [];
    if (selectUser) {
      selectUser.addEventListener("change", () => {
        const idSel = selectUser.value;
        if (!idSel) return;
        const usr = listaUsuariosAutorizados.find((u) => u.id_usuario === idSel);
        if (usr) {
          enfocarUsuario(usr);
        }
      });
    }

    // Botones de Zoom (+ / - / Centrar / Expandir)
    const btnZoomIn = document.getElementById("btn-globe-zoom-in");
    const btnZoomOut = document.getElementById("btn-globe-zoom-out");
    const btnCenter = document.getElementById("btn-globe-center");
    const btnExpand = document.getElementById("btn-globe-expand");
    const btnExpandFloat = document.getElementById("btn-globe-fullscreen-float");

    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => {
        targetZoom = Math.min(2.85, targetZoom + 0.25);
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => {
        targetZoom = Math.max(0.82, targetZoom - 0.25);
      });
    }
    if (btnCenter) {
      btnCenter.addEventListener("click", () => {
        enfocarEstado(estadoSeleccionado, true, {
          usuario: usuarioEnfocado,
          zoom: 1.48,
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
        btnExpand.textContent = nuevoEstado ? "✕ Cerrar vista expandida" : "⛶ Expandir Mapa 3D";
      }
      setTimeout(ajustarCanvas, 50);
    }

    if (btnExpand) {
      btnExpand.addEventListener("click", () => alternarModoExpandido());
    }
    if (btnExpandFloat) {
      btnExpandFloat.addEventListener("click", () => alternarModoExpandido());
    }
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

    // Dibuja un poligono terrestre proyectado sobre la esfera 3D
    function dibujarContinente3D(coords, radius, cx, cy, bioma) {
      const proyectados = [];
      let visibles = 0;

      for (let i = 0; i < coords.length; i++) {
        const [lat, lon] = coords[i];
        const p = rotarPunto(latLonToXYZ(lat, lon, radius), yaw, pitch);
        if (p.z > 0) visibles++;
        // Si un vertice pasa ligeramente al hemisferio trasero, proyectarlo sobre el borde del horizonte
        if (p.z < 0) {
          const mag = Math.hypot(p.x, p.y) || 1;
          proyectados.push({
            x: cx + (p.x / mag) * radius,
            y: cy + (p.y / mag) * radius,
            z: 0
          });
        } else {
          proyectados.push({
            x: cx + p.x,
            y: cy + p.y,
            z: p.z
          });
        }
      }

      if (visibles < 2) return;

      ctx.beginPath();
      for (let i = 0; i < proyectados.length; i++) {
        const pt = proyectados[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();

      // 1) Plataforma continental (aguas poco profundas color turquesa satelital)
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineWidth = 7 * Math.min(1.4, zoom);
      ctx.strokeStyle = "rgba(14, 165, 233, 0.26)";
      ctx.stroke();
      ctx.restore();

      // 2) Relleno de masa continental con gradiente natural de la Tierra
      const landGrad = ctx.createLinearGradient(
        cx - radius * 0.7,
        cy - radius * 0.7,
        cx + radius * 0.7,
        cy + radius * 0.7
      );

      if (bioma === "polar") {
        landGrad.addColorStop(0, "#E0F2FE");
        landGrad.addColorStop(1, "#93C5FD");
      } else if (bioma === "tropical") {
        landGrad.addColorStop(0, "#15803D");
        landGrad.addColorStop(0.55, "#166534");
        landGrad.addColorStop(1, "#3F6212");
      } else {
        landGrad.addColorStop(0, "#2E8B57");
        landGrad.addColorStop(0.45, "#1F6F43");
        landGrad.addColorStop(0.8, "#5C7A3B");
        landGrad.addColorStop(1, "#365314");
      }

      ctx.fillStyle = landGrad;
      ctx.fill();

      // 3) Contorno costero definido
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = bioma === "polar" ? "rgba(224, 242, 254, 0.85)" : "rgba(74, 222, 128, 0.55)";
      ctx.stroke();
    }

    function renderizarGlobo() {
      ajustarCanvas();
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Interpolacion suave de camara y zoom hacia la localizacion del usuario
      if (!isDragging) {
        let diffYaw = targetYaw - yaw;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        yaw += diffYaw * 0.08;
        pitch += (targetPitch - pitch) * 0.08;
      }
      zoom += (targetZoom - zoom) * 0.09;

      tick += 0.022;
      pulsoOnda = (pulsoOnda + 0.022) % 1;

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.37;
      const radius = baseRadius * zoom;

      // 0) Campo de estrellas de espacio profundo
      for (let i = 0; i < ESTRELLAS_FONDO.length; i++) {
        const st = ESTRELLAS_FONDO[i];
        const sx = st.u * width;
        const sy = st.v * height;
        const distCentro = Math.hypot(sx - cx, sy - cy);
        if (distCentro < radius * 1.03) continue;
        const twinkle = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(tick * 1.6 + st.phase));
        ctx.fillStyle = `rgba(226, 232, 240, ${twinkle.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 1) Corona y atmosfera azul exterior de la Tierra (Rayleigh scattering)
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.24);
      haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.42)");
      haloGrad.addColorStop(0.45, "rgba(14, 165, 233, 0.16)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.24, 0, Math.PI * 2);
      ctx.fill();

      // 2) Esfera Oceanica del Planeta Tierra con reflejo solar especular
      const oceanGrad = ctx.createRadialGradient(
        cx - radius * 0.32,
        cy - radius * 0.32,
        radius * 0.06,
        cx,
        cy,
        radius
      );
      oceanGrad.addColorStop(0, "#1E88E5");
      oceanGrad.addColorStop(0.32, "#0D5C9E");
      oceanGrad.addColorStop(0.72, "#073464");
      oceanGrad.addColorStop(1, "#031833");

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = oceanGrad;
      ctx.fill();

      // Recorte circular de la esfera terrestre para que los continentes y nubes se curven dentro del planeta
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // 3) Paralelos, meridianos y Linea del Ecuador
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -80; lat <= 80; lat += 5) {
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
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = "rgba(125, 211, 252, 0.14)";
        ctx.stroke();
      }

      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
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
        ctx.lineWidth = lat === 0 ? 1.2 : 0.7;
        ctx.strokeStyle = lat === 0 ? "rgba(56, 189, 248, 0.28)" : "rgba(125, 211, 252, 0.14)";
        ctx.stroke();
      }

      // 4) Continentes e Islas del Planeta Tierra en 3D
      for (let i = 0; i < CONTINENTES_TIERRA.length; i++) {
        const cont = CONTINENTES_TIERRA[i];
        dibujarContinente3D(cont.coords, radius, cx, cy, cont.bioma);
      }

      // 5) Capa de nubes atmosfericas en movimiento suave
      const lonOffsetNubes = (tick * 2.2) % 360;
      for (let i = 0; i < NUBES_ATMOSFERA.length; i++) {
        const nb = NUBES_ATMOSFERA[i];
        const pNube = rotarPunto(
          latLonToXYZ(nb.lat, nb.lon + lonOffsetNubes, radius * 1.01),
          yaw,
          pitch
        );
        if (pNube.z > radius * 0.15) {
          const visFactor = pNube.z / radius;
          ctx.save();
          ctx.translate(cx + pNube.x, cy + pNube.y);
          ctx.scale(1, 0.55);
          const cGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, nb.rx * 2.2 * zoom);
          cGrad.addColorStop(0, `rgba(255, 255, 255, ${(nb.alpha * visFactor).toFixed(3)})`);
          cGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.arc(0, 0, nb.rx * 2.2 * zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 6) Sombreado esferico 3D (iluminacion dia/noche y atmosfera interna en el borde)
      const shadeGrad = ctx.createRadialGradient(
        cx - radius * 0.35,
        cy - radius * 0.35,
        radius * 0.2,
        cx,
        cy,
        radius
      );
      shadeGrad.addColorStop(0, "rgba(255, 255, 255, 0.10)");
      shadeGrad.addColorStop(0.65, "rgba(0, 0, 0, 0)");
      shadeGrad.addColorStop(1, "rgba(2, 6, 23, 0.55)");
      ctx.fillStyle = shadeGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // Fin del clip circular de la superficie terrestre

      // Borde luminoso de la atmosfera terrestre
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.65)";
      ctx.stroke();

      // 7) Arcos 3D de actividad entre el nodo central y las demas ubicaciones activas
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
          const pMid = rotarPunto(
            latLonToXYZ(midLat, midLon, radius * 1.22),
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
            ? "rgba(52, 211, 153, 0.88)"
            : "rgba(56, 189, 248, 0.30)";
          ctx.lineWidth = esDestinoActivo ? 2.2 : 1.1;
          ctx.stroke();

          // Paquete luminoso viajando por el arco
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

      // 8) Pilares 3D, marcadores pulsantes, mira GPS y etiquetas de las 21 ubicaciones
      const maxInter = Math.max(
        1,
        ...Object.values(datosPorEstado).map((d) => d.interacciones || 1)
      );
      nodosEnPantalla = [];

      Object.values(datosPorEstado).forEach((loc) => {
        const pBase = rotarPunto(latLonToXYZ(loc.lat, loc.lon, radius), yaw, pitch);
        if (pBase.z < 0) return;

        const ratio = (loc.interacciones || 1) / maxInter;
        const alturaPilar = (10 + ratio * 28) * Math.min(1.35, zoom);
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
          sy: by
        });

        // Luces doradas de ciudad alrededor del marcador
        ctx.fillStyle = "rgba(251, 191, 36, 0.65)";
        ctx.beginPath();
        ctx.arc(bx + 3, by - 2, 1.3, 0, Math.PI * 2);
        ctx.arc(bx - 3.5, by + 2, 1.1, 0, Math.PI * 2);
        ctx.fill();

        // Pilar 3D
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = esActivo ? "#34D399" : "rgba(56, 189, 248, 0.9)";
        ctx.lineWidth = esActivo ? 3.4 : 2;
        ctx.stroke();

        // Base en la superficie de la Tierra
        ctx.beginPath();
        ctx.arc(bx, by, esActivo ? 5.5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#10B981" : "#FBBF24";
        ctx.fill();

        // Punta luminosa del pilar
        ctx.beginPath();
        ctx.arc(tx, ty, esActivo ? 4.5 : 2.8, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#A7F3D0" : "#F8FAFC";
        ctx.fill();

        // Mira GPS de localizacion + onda de sonar en la ubicacion enfocada
        if (esActivo) {
          const rOnda = 8 + pulsoOnda * 30;
          ctx.beginPath();
          ctx.arc(bx, by, rOnda, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - pulsoOnda).toFixed(2)})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Mira de bloqueo GPS (reticula circular)
          const rMira = 16;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(tick * 0.9);
          ctx.strokeStyle = "rgba(52, 211, 153, 0.88)";
          ctx.lineWidth = 1.5;
          for (let a = 0; a < 4; a++) {
            ctx.beginPath();
            ctx.arc(0, 0, rMira, a * (Math.PI / 2) + 0.2, (a + 1) * (Math.PI / 2) - 0.2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Etiqueta flotante clara sobre el planeta
        if (esActivo || (pBase.z > radius * 0.55 && (loc.interacciones >= 10 || zoom >= 1.35))) {
          ctx.font = esActivo
            ? "700 12.5px 'Inter', sans-serif"
            : "600 10.5px 'Inter', sans-serif";
          const labelTxt =
            esActivo && usuarioEnfocado
              ? `📍 @${usuarioEnfocado.alias} · ${loc.ciudad}`
              : `${loc.ciudad} (${loc.interacciones})`;

          const textW = ctx.measureText(labelTxt).width;
          ctx.fillStyle = esActivo ? "rgba(6, 78, 59, 0.88)" : "rgba(15, 23, 42, 0.78)";
          ctx.beginPath();
          ctx.roundRect(tx + 7, ty - 11, textW + 12, 20, 6);
          ctx.fill();
          ctx.strokeStyle = esActivo ? "#34D399" : "rgba(56, 189, 248, 0.4)";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = esActivo ? "#A7F3D0" : "#F8FAFC";
          ctx.fillText(labelTxt, tx + 13, ty + 3);
        }
      });

      ctx.restore();
      requestAnimationFrame(renderizarGlobo);
    }

    requestAnimationFrame(renderizarGlobo);

    // Exponer API global para dashboard.js
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
            `<option value="">👤 Localizar miembro en la Tierra (${conPermiso.length})...</option>` +
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
