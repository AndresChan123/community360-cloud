/**
 * Globo 3D Fotorealista de Community 360 (Three.js + NASA Blue Marble + BumpMap + SpecularMap)
 * - Texturas cargadas desde /textures/earth-blue-marble.jpg, /textures/earth-topology.png, /textures/earth-water.png
 * - Halo atmosferico Fresnel en azul celeste (#38BDF8) e iluminacion direccional/ambiental equilibrada
 * - Pines minimalistas 3D, arcos sutiles y etiquetas flotantes glassmorphism (cero emojis, cero bordes neon)
 * - Rotacion libre de 360 grados completos, zoom profundo, fly-to por regiones, selector de miembros y gestos de mano
 */
(function () {
  const TEXTURE_URLS = {
    colorLocal: "/textures/earth-blue-marble.jpg",
    bumpLocal: "/textures/earth-topology.png",
    specLocal: "/textures/earth-water.png",
    colorCDN: "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
    bumpCDN: "https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png",
    specCDN: "https://unpkg.com/three-globe@2.31.1/example/img/earth-water.png"
  };

  const COORDENADAS_ESTADOS = {
    "Yucatán": { ciudad: "Mérida", pais: "México", lat: 20.9721, lon: -89.6172, region: "sur" },
    "Jalisco": { ciudad: "Guadalajara", pais: "México", lat: 20.6719, lon: -103.3519, region: "mexico" },
    "Nuevo León": { ciudad: "Monterrey", pais: "México", lat: 25.6731, lon: -100.3053, region: "mexico" },
    "CDMX": { ciudad: "Ciudad de México", pais: "México", lat: 19.4298, lon: -99.1343, region: "mexico" },
    "Quintana Roo": { ciudad: "Cancún", pais: "México", lat: 21.1639, lon: -86.8492, region: "sur" },
    "Veracruz": { ciudad: "Veracruz", pais: "México", lat: 19.1784, lon: -96.1339, region: "sur" },
    "Guanajuato": { ciudad: "León", pais: "México", lat: 21.1114, lon: -101.6612, region: "mexico" },
    "Baja California": { ciudad: "Tijuana", pais: "México", lat: 32.5111, lon: -117.0393, region: "mexico" },
    "Puebla": { ciudad: "Puebla", pais: "México", lat: 19.0368, lon: -98.2063, region: "mexico" },
    "Tabasco": { ciudad: "Villahermosa", pais: "México", lat: 17.9899, lon: -92.9370, region: "sur" },
    "Querétaro": { ciudad: "Querétaro", pais: "México", lat: 20.5896, lon: -100.4110, region: "mexico" },
    "Chihuahua": { ciudad: "Chihuahua", pais: "México", lat: 28.6393, lon: -106.0984, region: "mexico" },
    "Campeche": { ciudad: "Campeche", pais: "México", lat: 19.8469, lon: -90.5220, region: "sur" },
    "Oaxaca": { ciudad: "Oaxaca", pais: "México", lat: 17.0897, lon: -96.7379, region: "sur" },
    "Texas": { ciudad: "Houston", pais: "Estados Unidos", lat: 29.7575, lon: -95.3893, region: "intl" },
    "California": { ciudad: "Los Ángeles", pais: "Estados Unidos", lat: 34.0399, lon: -118.2472, region: "intl" },
    "Cundinamarca": { ciudad: "Bogotá", pais: "Colombia", lat: 4.7151, lon: -74.0638, region: "latam" },
    "Lima": { ciudad: "Lima", pais: "Perú", lat: -12.0629, lon: -77.0299, region: "latam" },
    "Región Metropolitana": { ciudad: "Santiago", pais: "Chile", lat: -33.4356, lon: -70.6650, region: "latam" },
    "Buenos Aires": { ciudad: "Buenos Aires", pais: "Argentina", lat: -34.6081, lon: -58.3797, region: "latam" },
    "Comunidad de Madrid": { ciudad: "Madrid", pais: "España", lat: 40.4168, lon: -3.7066, region: "espana" }
  };

  const DEG2RAD = Math.PI / 180;
  const ZOOM_MIN = 0.65;
  const ZOOM_MAX = 6.5;

  // Convierte (lat, lon) al sistema de coordenadas esferico de Three.js SphereGeometry
  // En Three.js SphereGeometry:
  // u = 0.5 + lon / 360 -> en lon = 0 (Greenwich), phi_three = PI -> x = -R * cos(lat) * sin(lon)?
  // Exactamente para Three.js SphereGeometry(R):
  // phi = (90 - lat) * DEG2RAD, theta = (lon + 180) * DEG2RAD
  // x = -R * sin(phi) * cos(theta)
  // y =  R * cos(phi)
  // z =  R * sin(phi) * sin(theta)
  function latLonToThreeVec3(lat, lon, radius = 1) {
    const phi = (90 - lat) * DEG2RAD;
    const theta = (lon + 180) * DEG2RAD;
    return {
      x: -radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.cos(phi),
      z: radius * Math.sin(phi) * Math.sin(theta)
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("globe-3d-canvas");
    const labelsLayer = document.getElementById("globe-labels-layer");
    const vistaActividadEl = document.getElementById("vista-actividad");
    if (!canvas) return;

    // Ping keep-alive cada 4 minutos
    setInterval(() => {
      fetch("/healthz").catch(() => {});
    }, 4 * 60 * 1000);

    let backdropEl = document.getElementById("globe-backdrop-overlay");
    if (!backdropEl) {
      backdropEl = document.createElement("div");
      backdropEl.id = "globe-backdrop-overlay";
      backdropEl.className = "globe-backdrop-overlay";
      document.body.appendChild(backdropEl);
    }

    // En Three.js SphereGeometry, lon = -90 (Mexico/Yucatan) tiene z = +R (frente a la camara en +Z)
    // Por tanto, para centrar una longitud `lon`, rotY = (-90 - lon) * DEG2RAD
    // Y para inclinar la latitud `lat` hacia la camara (+Z), rotX = lat * DEG2RAD
    let rotY = (-90 - -89.6172) * DEG2RAD;
    let rotX = 20.9721 * DEG2RAD;
    let targetRotY = rotY;
    let targetRotX = rotX;
    let velY = 0;
    let velX = 0;

    let zoom = 1.22;
    let targetZoom = 1.22;

    let autoTour = true;
    let isDragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let estadoSeleccionado = "Yucatán";
    let usuarioEnfocado = null;
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

    function actualizarIconoTour() {
      const btnTour = document.getElementById("btn-globe-tour");
      const iconPause = document.getElementById("icon-tour-pause");
      const iconPlay = document.getElementById("icon-tour-play");
      if (btnTour) btnTour.classList.toggle("active", autoTour);
      if (iconPause) iconPause.style.display = autoTour ? "inline-block" : "none";
      if (iconPlay) iconPlay.style.display = autoTour ? "none" : "inline-block";
    }

    function pausarRecorridoAutomatico() {
      if (!autoTour) return;
      autoTour = false;
      actualizarIconoTour();
    }

    function actualizarHUD(estadoKey, usuarioCustom = null) {
      const info = datosPorEstado[estadoKey];
      if (!info && !usuarioCustom) return;

      const elTag = document.getElementById("globe-hud-tag");
      const elCiudad = document.getElementById("globe-hud-city");
      const elUser = document.getElementById("globe-hud-user");
      const elInter = document.getElementById("globe-hud-inter");
      const elMiembros = document.getElementById("globe-hud-members");

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
          elUser.textContent = `@${usuarioCustom.alias} · ${usuarioCustom.plataforma_principal || "Comunidad"}`;
        } else {
          elUser.textContent = "Comunidad activa en esta región";
        }
      }
      if (elInter && info) {
        elInter.textContent = `${info.interacciones} publicaciones`;
      }
      if (elMiembros) {
        if (usuarioCustom) {
          elMiembros.textContent = "Ubicación verificada";
        } else if (info && info.miembros) {
          elMiembros.textContent = `${info.miembros} miembros`;
        } else {
          elMiembros.textContent = "Nodo activo";
        }
      }

      document.querySelectorAll(".heatmap-cell").forEach((cell) => {
        cell.classList.toggle("active-state", cell.dataset.estado === estadoKey);
      });
    }

    function enfocarAnglesSuave(latDeg, lonDeg) {
      const desiredY = (-90 - lonDeg) * DEG2RAD;
      const desiredX = latDeg * DEG2RAD;

      let dY = (desiredY - targetRotY) % (Math.PI * 2);
      if (dY > Math.PI) dY -= Math.PI * 2;
      if (dY < -Math.PI) dY += Math.PI * 2;
      targetRotY += dY;

      let dX = (desiredX - targetRotX) % (Math.PI * 2);
      if (dX > Math.PI) dX -= Math.PI * 2;
      if (dX < -Math.PI) dX += Math.PI * 2;
      targetRotX += dX;
    }

    function enfocarEstado(estadoKey, manual = false, opciones = {}) {
      const info = datosPorEstado[estadoKey];
      if (!info) return;
      estadoSeleccionado = estadoKey;
      usuarioEnfocado = opciones.usuario || null;
      velY = 0;
      velX = 0;

      const latObjetivo = usuarioEnfocado ? Number(usuarioEnfocado.latitud) : info.lat;
      const lonObjetivo = usuarioEnfocado ? Number(usuarioEnfocado.longitud) : info.lon;

      enfocarAnglesSuave(latObjetivo, lonObjetivo);

      if (manual) {
        pausarRecorridoAutomatico();
        targetZoom = opciones.zoom || (usuarioEnfocado ? 2.15 : 1.72);
        if (opciones.centrarVista !== false) {
          centrarVistaPrincipalEnPantalla();
        }
      }

      // Actualizar segmented control si corresponde
      document.querySelectorAll(".globe-segmented-control .seg-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-globe-region") === info.region);
      });

      actualizarHUD(estadoKey, usuarioEnfocado);
      actualizarMaterialesPines3D();
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
      velY = 0;
      velX = 0;
      enfocarAnglesSuave(Number(lat), Number(lon));
      targetZoom = 2.15;

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
        plataforma_principal: "Sesión activa"
      };
      actualizarHUD(estadoSeleccionado, usuarioEnfocado);
      actualizarMaterialesPines3D();
      centrarVistaPrincipalEnPantalla();
    }

    // Ciclo de actualizacion de ciudad en HUD durante el giro 360 automatico
    let tourIdx = 0;
    setInterval(() => {
      if (!autoTour || isDragging || handModeActive) return;
      const activos = Object.keys(datosPorEstado).sort(
        (a, b) => datosPorEstado[b].interacciones - datosPorEstado[a].interacciones
      );
      if (!activos.length) return;
      tourIdx = (tourIdx + 1) % activos.length;
      estadoSeleccionado = activos[tourIdx];
      actualizarHUD(estadoSeleccionado, null);
      actualizarMaterialesPines3D();
    }, 4200);

    // =========================================================================
    // MOTOR THREE.JS WEBGL CON TEXTURAS SATELITALES NASA BLUE MARBLE + BUMP + SPECULAR
    // =========================================================================
    const THREE = window.THREE;
    let renderer = null;
    let scene = null;
    let camera = null;
    let pivotPitch = null;
    let earthGroup = null;
    let pulseRingMesh = null;
    const pinMeshes = {};
    let webglDisponible = false;

    if (THREE) {
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        if (THREE.SRGBColorSpace) {
          renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0, 3.1);

        // Iluminacion equilibrada (Ambient + Hemisphere + Directional Sunlight)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x18181b, 0.85);
        scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
        sunLight.position.set(5, 2.8, 5);
        scene.add(sunLight);

        // Estrellas tenues en el espacio profundo
        const starsGeo = new THREE.BufferGeometry();
        const starPositions = new Float32Array(260 * 3);
        for (let i = 0; i < 260; i++) {
          const r = 14 + Math.random() * 18;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
          starPositions[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) - 3;
        }
        starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
        const starsMat = new THREE.PointsMaterial({
          color: 0xa1a1aa,
          size: 0.06,
          transparent: true,
          opacity: 0.38
        });
        scene.add(new THREE.Points(starsGeo, starsMat));

        // Grupo de inclinacion (pitch en X) y rotacion (yaw en Y) para giro 360 limpio
        pivotPitch = new THREE.Group();
        scene.add(pivotPitch);

        earthGroup = new THREE.Group();
        pivotPitch.add(earthGroup);

        // Material fotorealista de la Tierra con NASA Blue Marble + Topografia + Reflejo de Agua
        const texLoader = new THREE.TextureLoader();
        texLoader.setCrossOrigin("anonymous");

        const earthMat = new THREE.MeshPhongMaterial({
          color: 0xffffff,
          bumpScale: 0.038,
          specular: new THREE.Color(0x243447),
          shininess: 16
        });

        const maxAniso = renderer.capabilities.getMaxAnisotropy
          ? renderer.capabilities.getMaxAnisotropy()
          : 4;

        texLoader.load(
          TEXTURE_URLS.colorLocal,
          (tex) => {
            if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = maxAniso;
            earthMat.map = tex;
            earthMat.needsUpdate = true;
          },
          undefined,
          () => {
            texLoader.load(TEXTURE_URLS.colorCDN, (tex) => {
              if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = maxAniso;
              earthMat.map = tex;
              earthMat.needsUpdate = true;
            });
          }
        );

        texLoader.load(
          TEXTURE_URLS.bumpLocal,
          (tex) => {
            tex.anisotropy = maxAniso;
            earthMat.bumpMap = tex;
            earthMat.needsUpdate = true;
          },
          undefined,
          () => {
            texLoader.load(TEXTURE_URLS.bumpCDN, (tex) => {
              earthMat.bumpMap = tex;
              earthMat.needsUpdate = true;
            });
          }
        );

        texLoader.load(
          TEXTURE_URLS.specLocal,
          (tex) => {
            earthMat.specularMap = tex;
            earthMat.needsUpdate = true;
          },
          undefined,
          () => {
            texLoader.load(TEXTURE_URLS.specCDN, (tex) => {
              earthMat.specularMap = tex;
              earthMat.needsUpdate = true;
            });
          }
        );

        const earthGeo = new THREE.SphereGeometry(1, 64, 64);
        const earthMesh = new THREE.Mesh(earthGeo, earthMat);
        earthGroup.add(earthMesh);

        // Halo atmosferico Fresnel sutil en azul celeste (#38BDF8) alrededor del borde del planeta
        const atmosGeo = new THREE.SphereGeometry(1.042, 64, 64);
        const atmosMat = new THREE.ShaderMaterial({
          vertexShader: `
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
              gl_FragColor = vec4(0.22, 0.74, 0.97, 1.0) * intensity * 0.72;
            }
          `,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          transparent: true,
          depthWrite: false
        });
        scene.add(new THREE.Mesh(atmosGeo, atmosMat));

        // Pines 3D minimalistas y arcos sutiles para las 21 ciudades
        const pinGeo = new THREE.SphereGeometry(0.015, 16, 16);
        const hubCoords = COORDENADAS_ESTADOS["Yucatán"];
        const hubVec = new THREE.Vector3().copy(latLonToThreeVec3(hubCoords.lat, hubCoords.lon, 1.003));

        Object.entries(COORDENADAS_ESTADOS).forEach(([estado, info]) => {
          const pos = latLonToThreeVec3(info.lat, info.lon, 1.004);
          const mat = new THREE.MeshBasicMaterial({
            color: estado === estadoSeleccionado ? 0x10b981 : 0x38bdf8
          });
          const mesh = new THREE.Mesh(pinGeo, mat);
          mesh.position.set(pos.x, pos.y, pos.z);
          earthGroup.add(mesh);
          pinMeshes[estado] = mesh;

          // Arco sutil 3D desde el nodo principal
          if (estado !== "Yucatán") {
            const destVec = new THREE.Vector3(pos.x, pos.y, pos.z);
            const midVec = hubVec.clone().add(destVec).multiplyScalar(0.5);
            const dist = hubVec.distanceTo(destVec);
            midVec.normalize().multiplyScalar(1 + Math.min(0.32, dist * 0.24));

            const curve = new THREE.QuadraticBezierCurve3(hubVec, midVec, destVec);
            const points = curve.getPoints(36);
            const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
            const arcMat = new THREE.LineBasicMaterial({
              color: 0x38bdf8,
              transparent: true,
              opacity: 0.22
            });
            earthGroup.add(new THREE.Line(arcGeo, arcMat));
          }
        });

        // Anillo de pulso sutil para la ciudad seleccionada
        const ringGeo = new THREE.RingGeometry(0.02, 0.032, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        pulseRingMesh = new THREE.Mesh(ringGeo, ringMat);
        earthGroup.add(pulseRingMesh);

        webglDisponible = true;
      } catch (_err) {
        webglDisponible = false;
      }
    }

    function actualizarMaterialesPines3D() {
      if (!webglDisponible || !THREE) return;
      Object.entries(pinMeshes).forEach(([est, mesh]) => {
        const activo = est === estadoSeleccionado;
        mesh.material.color.setHex(activo ? 0x10b981 : 0x38bdf8);
        mesh.scale.setScalar(activo ? 1.35 : 1.0);
        if (activo && pulseRingMesh) {
          pulseRingMesh.position.copy(mesh.position).multiplyScalar(1.002);
          pulseRingMesh.lookAt(new THREE.Vector3(0, 0, 0));
        }
      });
    }
    actualizarMaterialesPines3D();

    // =========================================================================
    // FALLBACK SOFTWARE TEXTURIZADO (Por si un navegador headless desactiva WebGL)
    // Carga exactamente /textures/earth-blue-marble.jpg y proyecta sus pixeles en 3D
    // =========================================================================
    let swColorData = null;
    let swTexW = 0;
    let swTexH = 0;
    const swOffCanvas = document.createElement("canvas");
    const swOffCtx = swOffCanvas.getContext("2d");

    if (!webglDisponible) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        swTexW = 720;
        swTexH = 360;
        const tmp = document.createElement("canvas");
        tmp.width = swTexW;
        tmp.height = swTexH;
        const tCtx = tmp.getContext("2d");
        tCtx.drawImage(img, 0, 0, swTexW, swTexH);
        swColorData = tCtx.getImageData(0, 0, swTexW, swTexH).data;
      };
      img.src = TEXTURE_URLS.colorLocal;
    }

    // =========================================================================
    // CONTROLES DE CAMARA, TRACKPAD, TOUCH Y GESTOS DE MANO (GIRO 360 LIBRE)
    // =========================================================================
    let nodosEnPantalla = [];
    let pinchStartDist = 0;
    let pinchStartZoom = 1;

    function aplicarDeltaRotacion(dx, dy) {
      pausarRecorridoAutomatico();
      const sensibilidad = 0.008 / Math.max(0.8, Math.sqrt(zoom) * 0.72);
      const signY = Math.cos(rotX) >= 0 ? 1 : -1;
      const dY = dx * sensibilidad * signY;
      const dX = dy * sensibilidad;
      targetRotY += dY;
      targetRotX += dX;
      rotY = targetRotY;
      rotX = targetRotX;
      velY = dY * 0.72;
      velX = dX * 0.72;
    }

    canvas.addEventListener("mousedown", (e) => {
      isDragging = true;
      dragMoved = false;
      pausarRecorridoAutomatico();
      velY = 0;
      velX = 0;
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
        velY = 0;
        velX = 0;
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
          targetZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom * (dist / pinchStartDist)));
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
        const step = e.ctrlKey ? -e.deltaY * 0.018 : e.deltaY < 0 ? 0.25 : -0.25;
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

    canvas.addEventListener("dblclick", () => {
      targetZoom = Math.min(ZOOM_MAX, targetZoom * 1.38);
    });

    // =========================================================================
    // CONTROL POR GESTOS DE LA MANO FRENTE A LA CAMARA (SIN EMOJIS)
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
        if (btnHand) btnHand.classList.add("active");
      } catch (_err) {
        if (handBox) {
          handBox.style.display = "block";
          if (handHint) handHint.textContent = "Cámara no disponible en este dispositivo";
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
      if (btnHand) btnHand.classList.remove("active");
    }

    function procesarGestoMano() {
      if (!handModeActive || !handVideo || handVideo.readyState < 2) return;
      const w = procCanvas.width;
      const h = procCanvas.height;
      procCtx.drawImage(handVideo, 0, 0, w, h);
      const frame = procCtx.getImageData(0, 0, w, h).data;

      if (handOverlay) {
        handOverlay.width = 184;
        handOverlay.height = 112;
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
            const diff =
              Math.abs(r - prevHandFrame[idx]) +
              Math.abs(g - prevHandFrame[idx + 1]) +
              Math.abs(b - prevHandFrame[idx + 2]);
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
            if (handHint) handHint.textContent = "Acercando vista";
          } else if (handHint) {
            handHint.textContent = "Rotando globo con tu mano";
          }
        }

        smoothHandX = smoothHandX === null ? cxHand : smoothHandX * 0.55 + cxHand * 0.45;
        smoothHandY = smoothHandY === null ? cyHand : smoothHandY * 0.55 + cyHand * 0.45;

        if (oCtx && handOverlay) {
          const ox = (smoothHandX / w) * handOverlay.width;
          const oy = (smoothHandY / h) * handOverlay.height;
          oCtx.beginPath();
          oCtx.arc(ox, oy, 14, 0, Math.PI * 2);
          oCtx.strokeStyle = "#38BDF8";
          oCtx.lineWidth = 2;
          oCtx.stroke();
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
    // BOTONES DEL DOCK FLOTANTE Y CONTROLES SEGMENTADOS
    // =========================================================================
    const btnTour = document.getElementById("btn-globe-tour");
    if (btnTour) {
      btnTour.addEventListener("click", () => {
        autoTour = !autoTour;
        if (autoTour) {
          usuarioEnfocado = null;
          targetZoom = 1.22;
        }
        actualizarIconoTour();
      });
    }

    const btnMyLoc = document.getElementById("btn-globe-my-loc");
    if (btnMyLoc) {
      btnMyLoc.addEventListener("click", () => {
        const emailActual = localStorage.getItem("c360_email") || "Mi cuenta";
        const nombreLimpio = emailActual.split("@")[0];
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => enfocarCoordenadas(pos.coords.latitude, pos.coords.longitude, nombreLimpio),
            () => enfocarCoordenadas(20.9721, -89.6172, nombreLimpio),
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
    const btnExpand = document.getElementById("btn-globe-expand");

    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => {
        pausarRecorridoAutomatico();
        targetZoom = Math.min(ZOOM_MAX, targetZoom * 1.32);
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => {
        pausarRecorridoAutomatico();
        targetZoom = Math.max(ZOOM_MIN, targetZoom / 1.32);
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
      if (btnExpand) btnExpand.classList.toggle("active", nuevoEstado);
      setTimeout(ajustarDimensiones, 50);
    }

    if (btnExpand) btnExpand.addEventListener("click", () => alternarModoExpandido());
    backdropEl.addEventListener("click", () => alternarModoExpandido(false));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") alternarModoExpandido(false);
    });

    document.querySelectorAll("[data-globe-region]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const reg = btn.getAttribute("data-globe-region");
        usuarioEnfocado = null;
        document.querySelectorAll(".globe-segmented-control .seg-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        if (reg === "mexico") enfocarEstado("CDMX", true);
        else if (reg === "sur") enfocarEstado("Yucatán", true);
        else if (reg === "latam") enfocarEstado("Cundinamarca", true);
        else if (reg === "espana") enfocarEstado("Comunidad de Madrid", true);
      });
    });

    let viewW = 800;
    let viewH = 600;

    function ajustarDimensiones() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth || 800;
      const h = parent.clientHeight || 600;
      if (w !== viewW || h !== viewH) {
        viewW = w;
        viewH = h;
        if (webglDisponible && renderer && camera) {
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        } else {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }
      }
    }
    window.addEventListener("resize", ajustarDimensiones);
    ajustarDimensiones();

    // =========================================================================
    // ETIQUETAS GLASSMORPHISM SIN SUPERPOSICION (DOM LAYER)
    // =========================================================================
    const labelDomMap = {};
    function actualizarEtiquetasFlotantes(candidatos) {
      if (!labelsLayer) return;
      const dibujadas = [];
      const activosSet = new Set();

      candidatos.sort((a, b) => {
        if (a.esActivo) return -1;
        if (b.esActivo) return 1;
        return (b.loc.interacciones || 0) - (a.loc.interacciones || 0);
      });

      candidatos.forEach((n) => {
        const { loc, sx, sy, nz, esActivo } = n;
        if (!esActivo && nz < 0.36 && zoom < 2.1) return;
        if (!esActivo && loc.interacciones < 10 && zoom < 1.8) return;

        const choca =
          !esActivo &&
          dibujadas.some((prev) => Math.abs(prev.x - sx) < 92 && Math.abs(prev.y - sy) < 26);
        if (choca) return;

        dibujadas.push({ x: sx, y: sy });
        activosSet.add(loc.estado);

        let el = labelDomMap[loc.estado];
        if (!el) {
          el = document.createElement("div");
          el.className = "globe-pin-label";
          labelsLayer.appendChild(el);
          labelDomMap[loc.estado] = el;
        }

        el.className = `globe-pin-label${esActivo ? " is-focused" : ""}`;
        const textoNombre =
          esActivo && usuarioEnfocado ? `@${usuarioEnfocado.alias} · ${loc.ciudad}` : loc.ciudad;
        el.innerHTML = `<span class="pin-dot"></span><span>${textoNombre}</span><span class="pin-count">${loc.interacciones}</span>`;
        el.style.left = `${sx.toFixed(1)}px`;
        el.style.top = `${sy.toFixed(1)}px`;
        el.style.display = "inline-flex";
      });

      Object.keys(labelDomMap).forEach((est) => {
        if (!activosSet.has(est)) {
          labelDomMap[est].style.display = "none";
        }
      });
    }

    // =========================================================================
    // RENDERIZADO DE BUCLE PRINCIPAL (WEBGL THREE.JS + FALLBACK RAYCAST)
    // =========================================================================
    function renderizarFrame() {
      if (
        document.hidden ||
        (vistaActividadEl && !vistaActividadEl.classList.contains("active"))
      ) {
        requestAnimationFrame(renderizarFrame);
        return;
      }

      ajustarDimensiones();
      if (handModeActive && Math.round(tick * 50) % 2 === 0) {
        procesarGestoMano();
      }

      if (!isDragging) {
        if (autoTour && !handModeActive) {
          targetRotY += 0.0042;
          rotY = targetRotY;
          rotX += (20.5 * DEG2RAD - rotX) * 0.05;
          targetRotX = rotX;
        } else {
          if (Math.abs(velY) > 0.00008 || Math.abs(velX) > 0.00008) {
            targetRotY += velY;
            targetRotX += velX;
            velY *= 0.94;
            velX *= 0.94;
          }
          rotY += (targetRotY - rotY) * 0.11;
          rotX += (targetRotX - rotX) * 0.11;
        }
      }
      zoom += (targetZoom - zoom) * 0.11;
      tick += 0.025;

      if (webglDisponible && renderer && scene && camera && earthGroup && pivotPitch) {
        earthGroup.rotation.y = rotY;
        pivotPitch.rotation.x = rotX;
        camera.position.z = 3.35 / Math.pow(zoom, 0.58);

        if (pulseRingMesh) {
          const s = 1 + (tick % 1) * 1.4;
          pulseRingMesh.scale.setScalar(s);
          pulseRingMesh.material.opacity = (1 - (tick % 1)) * 0.85;
        }

        renderer.render(scene, camera);

        // Proyectar pines 3D visibles a coordenadas 2D de pantalla
        nodosEnPantalla = [];
        const candidatos = [];
        const tempVec = new THREE.Vector3();
        const camDir = new THREE.Vector3(0, 0, 1);

        Object.entries(pinMeshes).forEach(([estado, mesh]) => {
          mesh.getWorldPosition(tempVec);
          const normalDot = tempVec.clone().normalize().dot(camDir);
          if (normalDot < 0.12) return; // Cara oculta del planeta

          const projected = tempVec.clone().project(camera);
          const sx = (projected.x * 0.5 + 0.5) * viewW;
          const sy = (-(projected.y * 0.5) + 0.5) * viewH;
          const esActivo = estado === estadoSeleccionado;

          nodosEnPantalla.push({ estado, sx, sy });
          candidatos.push({
            loc: datosPorEstado[estado],
            sx,
            sy,
            nz: normalDot,
            esActivo
          });
        });

        actualizarEtiquetasFlotantes(candidatos);
      } else {
        renderizarFallbackTexturizado();
      }

      requestAnimationFrame(renderizarFrame);
    }

    function renderizarFallbackTexturizado() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.36 * zoom;

      // Halo Fresnel azul celeste (#38BDF8)
      const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.18);
      haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.32)");
      haloGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.08)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
      ctx.fill();

      if (swColorData) {
        const diam = Math.min(340, Math.max(160, Math.round(radius * 1.15)));
        if (swOffCanvas.width !== diam || swOffCanvas.height !== diam) {
          swOffCanvas.width = diam;
          swOffCanvas.height = diam;
        }
        const imgData = swOffCtx.createImageData(diam, diam);
        const out = imgData.data;
        const half = diam / 2;
        const cosX = Math.cos(-rotX);
        const sinX = Math.sin(-rotX);
        const cosY = Math.cos(-rotY);
        const sinY = Math.sin(-rotY);

        for (let py = 0; py < diam; py++) {
          const ny = (py - half) / half;
          for (let px = 0; px < diam; px++) {
            const nx = (px - half) / half;
            const r2 = nx * nx + ny * ny;
            if (r2 > 1) continue;
            const nz = Math.sqrt(1 - r2);

            // Inversa de rotX luego rotY para hallar coordenada esferica en textura NASA Blue Marble
            const y1 = ny * cosX - nz * sinX;
            const z1 = ny * sinX + nz * cosX;
            const x2 = nx * cosY + z1 * sinY;
            const z2 = -nx * sinY + z1 * cosY;

            const lat = Math.asin(Math.max(-1, Math.min(1, -y1)));
            const lon = Math.atan2(z2, -x2) - Math.PI;

            let u = (lon + Math.PI * 2) / (Math.PI * 2);
            u = u - Math.floor(u);
            const v = 0.5 - lat / Math.PI;

            const tx = Math.min(swTexW - 1, Math.max(0, Math.floor(u * swTexW)));
            const ty = Math.min(swTexH - 1, Math.max(0, Math.floor(v * swTexH)));
            const sIdx = (ty * swTexW + tx) * 4;

            // Iluminacion solar + Fresnel
            const light = Math.max(0.32, Math.min(1.18, 0.55 + (-nx * 0.35 - ny * 0.3 + nz * 0.65)));
            const fresnel = Math.pow(1 - nz, 3.2) * 55;

            const oIdx = (py * diam + px) * 4;
            out[oIdx] = Math.min(255, swColorData[sIdx] * light + fresnel * 0.35);
            out[oIdx + 1] = Math.min(255, swColorData[sIdx + 1] * light + fresnel * 0.75);
            out[oIdx + 2] = Math.min(255, swColorData[sIdx + 2] * light + fresnel);
            out[oIdx + 3] = 255;
          }
        }
        swOffCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(swOffCanvas, cx - radius, cy - radius, radius * 2, radius * 2);
      }

      // Proyectar pines y etiquetas
      nodosEnPantalla = [];
      const candidatos = [];
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      Object.values(datosPorEstado).forEach((loc) => {
        const p = latLonToThreeVec3(loc.lat, loc.lon, 1);
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        if (z2 < 0.12) return;
        const sx = cx + x1 * radius;
        const sy = cy - y2 * radius;
        const esActivo = loc.estado === estadoSeleccionado;

        ctx.beginPath();
        ctx.arc(sx, sy, esActivo ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = esActivo ? "#10B981" : "#38BDF8";
        ctx.fill();

        nodosEnPantalla.push({ estado: loc.estado, sx, sy });
        candidatos.push({ loc, sx, sy, nz: z2, esActivo });
      });

      actualizarEtiquetasFlotantes(candidatos);
      ctx.restore();
    }

    requestAnimationFrame(renderizarFrame);

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
            `<option value="">Elegir miembro...</option>` +
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
