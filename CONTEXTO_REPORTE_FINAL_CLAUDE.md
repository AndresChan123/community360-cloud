# Guía y Contexto Completo para Redactar el Reporte Final (`PROY_U3_Final_Ciau_Andres.pdf`)

> **Instrucciones para Claude:**
> Usa toda la información técnica, métricas reales, arquitectura visual y catálogo de capturas de este documento para redactar el reporte final del miniproyecto **Community 360** cumpliendo al 100% los lineamientos oficiales de entrega.
>
> **Regla crítica de estilo y voz (Muy importante para evitar penalización):**
> - Los lineamientos indican: *"Todo el documento debe estar redactado 100% con tus propias palabras... si se detectan rastros evidentes de texto generado por IA (frases genéricas, estructura mecánica de chat, adjetivos exagerados o incoherencias con tu propio proyecto), se aplicará una penalización directa sobre la calificación del reporte. La extensión en páginas no define la calificación; eviten texto de relleno."*
> - **Imita exactamente el estilo de redacción de mi entrega de la Fase 2**: primera persona del singular (*"implementé", "elegí", "comprobé", "configuré", "programé"*), oraciones directas, sobrias y naturales de un estudiante de ingeniería que explica su propio código y sus decisiones con números concretos, sin adjetivos grandilocuentes (*"robusto", "innovador", "revolucionario", "sinérgico", "exhaustivo", "fundamental", "crucial"*).
> - **Formato:** APA 7.ª edición (tablas y figuras numeradas con formato APA 7: **Tabla X** en negritas, título en cursiva debajo, bordes horizontales únicamente y *Nota.* al pie; **Figura X** en negritas, título en cursiva debajo, espacio para la captura y *Nota.* al pie).
> - **Nomenclatura del archivo final:** `PROY_U3_Final_Ciau_Andres.pdf`

---

## 1. Datos de la Portada Institucional (Sección 1 del PDF)

- **Universidad:** Universidad Tecnológica Metropolitana (UTM) — División de Tecnologías de la Información y Comunicación
- **Carrera:** Ingeniería en Tecnologías de la Información y Gestión Digital
- **Asignatura:** Bases de Datos en la Nube (Unidad III. Persistencia en la nube, arquitectura de datos y consumo reactivo)
- **Grupo:** 7B - IDGS
- **Título formal del proyecto:** COMMUNITY 360: Arquitectura de datos en la nube y dashboard analítico en tiempo real
- **Subtítulo:** Entrega Final (Fases 3 a 6): Autenticación, API REST, WebSockets, Globo Terráqueo 3D Interactivo, Dashboard Analítico y Despliegue en la Nube
- **Alumno:** Andres Ernesto Ciau Chan
- **Docente:** Lizandro Israel Reyes Carrillo
- **Fecha de entrega:** Noviembre de 2026

---

## 2. Contexto de lo realizado en las Fases 1 y 2 (Antecedentes reales del proyecto)

Para que todo el documento sea coherente con las entregas anteriores:

1. **Problema y archivos originales:**
   - `comunidad_virtual_usuarios.csv`: 1,068 registros recibidos (22 columnas) con datos demográficos, ubicación, intereses, métricas de actividad de 30 días y estatus (`activo`, `en_riesgo`, `inactivo`).
   - `comunidad_virtual_interacciones_1000.csv`: 1,000 interacciones recibidas (16 columnas) con mensajes, comentarios, reacciones, respuestas a encuestas y confirmaciones RSVP.
2. **Decisión arquitectónica (Esquema Híbrido SQL + NoSQL aprobado en Fase 1 y cargado en Fase 2):**
   - **CockroachDB Cloud (SQL relacional distribuido):** Almacena únicamente el padrón maestro estructurado en dos tablas con restricciones `CHECK` e integridad referencial:
     - `ubicaciones`: **21 registros** (catálogo de ciudades, estados, países y zonas horarias armado exclusivamente con lugares de usuarios que sí dieron consentimiento: Yucatán, Jalisco, Nuevo León, CDMX, Quintana Roo, Veracruz, Guanajuato, Baja California, Puebla, Tabasco, Querétaro, Chihuahua, Campeche, Oaxaca, Texas, California, Cundinamarca, Lima, Región Metropolitana, Buenos Aires y Comunidad de Madrid).
     - `usuarios`: **1,068 registros** (con llave foránea opcional a `ubicaciones` y la restricción `CONSTRAINT privacidad_usuario CHECK (consentimiento_datos OR (id_ubicacion IS NULL AND latitud IS NULL AND longitud IS NULL))`).
   - **Cloud Firestore (NoSQL documental en Firebase):** Almacena las colecciones operativas de alta escritura, auditoría y lectura reactiva:
     - `interacciones`: **207 documentos válidos** (ID del documento = `id_interaccion`, ej. `I0004013`). Solo contiene las interacciones cuyo `id_usuario` sí existe en el padrón de CockroachDB (pertenecen a 136 usuarios distintos). Cada documento guarda: `id_usuario`, `timestamp` (UTC), `canal`, `tipo`, `texto` (`null` en las 144 reacciones), `tema`, `sentimiento`, `idioma`, `dispositivo`, `longitud_texto`, `reacciones_recibidas` y `etiquetas` (como arreglo de strings, ej. `["evento", "arte"]`). **No guarda país, estado, ciudad, `id_ubicacion` ni `consentimiento_autor`**.
     - `cuarentena_interacciones`: **793 documentos** (las 793 interacciones huérfanas que hacían referencia a 614 identificadores `id_usuario` inexistentes del rango `U001071` a `U005997`). Se guardaron con `motivo_rechazo: "usuario_inexistente"` y sin ubicación geográfica (a 646 se les borró país, estado y ciudad porque no se puede verificar el consentimiento de un usuario que no existe).
     - `bitacora_etl`: **4 documentos** (2 ejecuciones del script `etl_community360.py`, cada una genera un documento para `usuarios` y otro para `interacciones`).
     - `metricas_vivas`: **1 documento (`actuales`)** que concentra los indicadores agregados calculados sobre las interacciones activas.
     - `administradores`: **3 documentos** (agregados en la Fase 3 para control de acceso al dashboard; el ID del documento es el `uid` de Firebase Authentication y contiene `email`, `rol` (`"admin"` o `"lector"`), `creado_en` y `ultimo_acceso`). Las tres cuentas aprovisionadas son:
       1. `lizandro.reyes@utmetropolitana.edu.mx` (usuario corto: `lizandro.reyes`, contraseña: `lizandr0_reye$`, rol: `admin` — usuario docente obligatorio).
       2. `admin@community360.mx` (usuario corto: `admin`, contraseña: `Community360!Admin`, rol: `admin`).
       3. `lector@community360.mx` (usuario corto: `lector`, contraseña: `Community360!Lector`, rol: `lector` — solo lectura, rechaza escrituras con `403 Forbidden`).
3. **Regla obligatoria de privacidad geográfica:**
   - De los 1,068 usuarios, **171 tienen `consentimiento_datos = false`** (y 897 tienen `true`). A esos 171 usuarios se les eliminaron ciudad, estado, país, zona horaria, latitud y longitud antes de subirlos a CockroachDB (`id_ubicacion = NULL`, `latitud = NULL`, `longitud = NULL`). La consulta de verificación en CockroachDB devuelve **0 violaciones**.

---

## 3. Contenido Detallado para cada Apartado del Reporte Final

### Apartado 2 del PDF: Descripción General del Sistema y Solución Planteada

1. **Cómo resuelve la aplicación web la integración y análisis de la comunidad:**
   - El sistema web unifica en una sola interfaz la consulta histórica del padrón relacional (CockroachDB Cloud) con el monitoreo en vivo de las interacciones documentales (Cloud Firestore).
   - Dividí el dashboard en **5 vistas independientes** controladas desde una única barra lateral izquierda (`240 px` en escritorio y barra compacta de `56 px` con menú desplegable *drawer* en dispositivos móviles `< 768 px`), eliminando el desbordamiento horizontal y el exceso de información apilada:
     1. **Resumen de áreas (`#vista-inicio`):** Tarjetas de síntesis con los 4 indicadores maestros (`1,068` miembros, `207` publicaciones activas, `21` ciudades con actividad, `171` perfiles con ubicación privada) y accesos directos a cada módulo.
     2. **Pulso en tiempo real (`#vista-pulso`):** 5 KPIs dinámicos y 4 gráficas conectadas por WebSockets (*Temas más comentados*, *Participación por red social*, *Forma de participación* y *Balance de ánimo*).
     3. **Publicaciones y mapa (`#vista-actividad`):** Escenario principal con un **Globo Terráqueo 3D fotorealista** renderizado con **Three.js (WebGL)** y texturas satelitales de la Tierra (NASA Blue Marble + mapa topográfico de relieve + reflejo especular oceánico + atmósfera Fresnel), tarjetas de actividad regional por estado/país y tabla de últimas publicaciones en vivo.
     4. **Perfiles y retención (`#vista-comunidad`):** 4 KPIs históricos y 3 gráficas alimentadas por CockroachDB Cloud (*Permanencia de miembros*, *Intereses principales* y *Grupos de edad*).
     5. **Directorio y privacidad (`#vista-directorio`):** Tabla filtrable bajo demanda (se filtra al seleccionar *Estado*, *Ubicación* y *Cantidad de filas* y presionar el botón **`Actualizar lista`**) que demuestra el resguardo de privacidad (`Sin consentimiento` / `Protegido`) y permite hacer clic en cualquier miembro con ubicación autorizada para volar hacia su ciudad en el Globo 3D.
2. **Descripción de los 4 módulos integrados:**
   - **Módulo de autenticación y cambio rápido de sesión (Login - Fase 3):** Pantalla de acceso que valida usuario/correo y contraseña contra **Firebase Authentication** (hash `scrypt`). En cada petición, el backend de Node.js verifica el JWT (`ID Token`) con el **Firebase Admin SDK** (`auth.verifyIdToken(token, true)`) y consulta `administradores/{uid}` en Firestore para validar su rol (`admin` o `lector`). Incluye protección de `/dashboard`, cookie `HttpOnly` + encabezado `Authorization: Bearer <token>`, cierre de sesión con revocación de tokens (`auth.revokeRefreshTokens(uid)`), renovación automática silenciosa del token si la sesión supera los 60 minutos (`fetchConAuth` y `renovarTokenSilencioso`), y un panel desplegable en el encabezado que permite cambiar de cuenta en un clic entre `lizandro.reyes` (`admin`), `lector@community360.mx` (`lector`) y `admin@community360.mx` (`admin`).
   - **Módulo de consulta histórica y administración (API REST - Fase 4):** Servidor Express con endpoints protegidos por token y rol para consultar el resumen demográfico y el directorio de usuarios desde CockroachDB, así como para listar, crear (`POST`), modificar (`PUT`) y eliminar (`DELETE`) interacciones en Firestore validando previamente en CockroachDB que el `id_usuario` exista.
   - **Módulo de actualización reactiva (WebSockets - Fase 5):** Servidor `ws` montado sobre el servidor HTTP en `/ws` con *heartbeat* (`ping/pong` cada 25 segundos) y reconexión automática. Durante el handshake (`upgrade`), valida el `ID Token` con el Admin SDK. Cumpliendo la restricción del proyecto, el dashboard **no tiene formularios** para crear, editar ni borrar interacciones: cuando se ejecuta un `POST`, `PUT` o `DELETE` desde **Postman**, el servidor actualiza Firestore, recalcula `metricas_vivas/actuales` y transmite el evento (`interaccion_creada`, `interaccion_actualizada` o `interaccion_eliminada`) a todos los clientes conectados para actualizar KPIs, gráficas, globo 3D, mapa de calor y tabla sin recargar la página (`F5`).
   - **Módulo de cumplimiento de privacidad geográfica y Globo 3D:** Garantizado en tres capas: (a) en el ETL de la Fase 2 que dejó en `NULL` la ubicación de los 171 usuarios sin consentimiento, (b) en la restricción `CHECK (privacidad_usuario)` de CockroachDB, y (c) en la API REST y en el Globo 3D, donde las interacciones nunca almacenan ubicación propia y tanto el mapa de calor como los pines 3D sobre la Tierra solo proyectan las 21 ciudades de autores con `consentimiento_datos = true`.
3. **Resumen explícito de la API REST desarrollada (10 Endpoints Business + Health Check):**
   *(Incluir como Tabla 1 en APA 7):*

| # | Método | Ruta del Endpoint | Rol requerido | Motor consultado / afectado | Propósito e interacción con el dashboard o Postman |
|---|---|---|---|---|---|
| 1 | `POST` | `/api/auth/login` | Público | Firebase Auth + Firestore (`administradores`) | Recibe usuario/correo y contraseña, los valida contra Firebase Auth, verifica el `ID Token` con el Admin SDK, lee el rol en `administradores/{uid}`, actualiza `ultimo_acceso` y devuelve el token JWT y cookie `HttpOnly` al login, al selector de cambio rápido de cuenta o a Postman. |
| 2 | `GET` | `/api/auth/sesion` | `admin` / `lector` | Firebase Auth + Firestore (`administradores`) | Verifica en cada carga del dashboard que el token siga vigente y no haya sido revocado, devolviendo `uid`, `email` y `rol`. |
| 3 | `POST` | `/api/auth/logout` | `admin` / `lector` | Firebase Auth | Invalida el caché de token en memoria, revoca los `refreshTokens` del usuario en Firebase Auth mediante el Admin SDK y limpia la cookie de sesión. |
| 4 | `GET` | `/api/estado` | `admin` / `lector` | Firebase Auth + Firestore (`administradores`) | Endpoint protegido de verificación para comprobar que el middleware de autenticación y rol responde `200 OK`. |
| 5 | `GET` | `/api/historico/resumen` | `admin` / `lector` | CockroachDB (`usuarios`, `ubicaciones`) + Firestore (`cuarentena_interacciones`, `bitacora_etl`) | Alimenta la vista *Perfiles y retención* y el catálogo de ubicaciones del Globo 3D: conteo de 1,068 miembros, 288 creadores digitales, distribución por estatus (`activo`: 390, `en_riesgo`: 421, `inactivo`: 257), interés principal, rango de edad, verificación de 0 violaciones de privacidad y 793 registros en cuarentena. Incluye caché en memoria de 45 s para optimizar tiempos de respuesta en Render. |
| 6 | `GET` | `/api/historico/usuarios` | `admin` / `lector` | CockroachDB (`usuarios LEFT JOIN ubicaciones`) | Alimenta la tabla del *Directorio de miembros* cuando el usuario selecciona los filtros (`?estatus=...&consentimiento=...&limite=...`) y presiona **`Actualizar lista`**, además de poblar el selector `Elegir miembro...` del Globo 3D. Muestra `"Protegido"` cuando `consentimiento_datos = false`. |
| 7 | `GET` | `/api/interacciones` | `admin` / `lector` | Firestore (`interacciones`, `metricas_vivas/actuales`) + CockroachDB | Carga el estado inicial del *Pulso en tiempo real* y de la tabla de publicaciones recientes junto con el documento `metricas_vivas/actuales`. |
| 8 | `POST` | `/api/interacciones` | Solo `admin` | CockroachDB (verifica `id_usuario`) + Firestore (`interacciones`, `metricas_vivas`) | Invocado desde **Postman**. Valida catálogos, comprueba que `id_usuario` exista en CockroachDB (`422` si no existe, `409` si el folio ya existe, `403` si el rol es `lector`), guarda el documento en Firestore sin ubicación, recalcula `metricas_vivas/actuales`, emite `interaccion_creada` por WebSocket y responde `201 Created`. |
| 9 | `PUT` | `/api/interacciones/:id` | Solo `admin` | Firestore (`interacciones`, `metricas_vivas`) + CockroachDB | Invocado desde **Postman**. Modifica una interacción existente en Firestore (`404` si no existe), recalcula las métricas, emite `interaccion_actualizada` por WebSocket para actualizar el dashboard en vivo y responde `200 OK`. |
| 10 | `DELETE` | `/api/interacciones/:id` | Solo `admin` | Firestore (`interacciones`, `metricas_vivas`) | Invocado desde **Postman**. Elimina una interacción de Firestore (`404` si no existe), recalcula `metricas_vivas/actuales`, emite `interaccion_eliminada` por WebSocket y responde `200 OK`. |
| 11 | `GET` | `/healthz` | Público | Memoria del proceso Node.js | Endpoint ultraligero (`< 1 ms`) de salud y *keep-alive* anti-hibernación para mantener activa la instancia en Render Free Tier. |

---

### Apartado 3 del PDF: Evolución del Stack Tecnológico

1. **Listado de tecnologías finales utilizadas:**
   - **Bases de datos en la nube (Arquitectura Híbrida):**
     - **CockroachDB Cloud** (PostgreSQL distribuido serverless en GCP `us-east1`, conexión TLS `sslmode=verify-full`): tablas `ubicaciones` (21 filas) y `usuarios` (1,068 filas).
     - **Google Cloud Firestore** (NoSQL documental): colecciones `interacciones` (207 docs), `cuarentena_interacciones` (793 docs), `bitacora_etl` (4 docs), `metricas_vivas` (1 doc `actuales`) y `administradores` (3 docs).
   - **Autenticación:** **Firebase Authentication** (Correo/contraseña con hash `scrypt` + verificación en servidor con `firebase-admin`).
   - **Procesamiento ETL (Fase 2):** **Python 3.13** (`etl_community360.py` + `psycopg2-binary`, `firebase-admin`, `python-dotenv`).
   - **Backend (Fases 3 a 5):** **Node.js** con **Express 4**, cliente **`pg`** (`Pool` resiliente con `max: 5`, `keepAlive: true` y listener `pool.on("error")` para reciclaje seguro de conexiones serverless), **`firebase-admin`** y **`dotenv`**.
   - **Comunicación en tiempo real (Fase 5):** Biblioteca **`ws`** (`WebSocketServer` integrado en `/ws` con *heartbeat* cada 25 segundos).
   - **Frontend, UI/UX y Visualización 3D (Fase 6):**
     - **Sistema de diseño Obsidian / Slate (`public/css/styles.css`):** Interfaz SaaS de alto contraste inspirada en Linear, Vercel y Mapbox Studio (fondo `#09090B`, superficies `#111114`, paneles flotantes glassmorphism `rgba(17, 17, 20, 0.78)` con `backdrop-filter: blur(12px)`, bordes `1px solid rgba(255, 255, 255, 0.08)`, acento cian técnico `#38BDF8`, indicador Live esmeralda `#10B981`, soporte de cambio a Modo Claro neutro, iconografía 100% vectorial estilo **Lucide Icons** de `16 px` sin emojis nativos, tipografía `Inter` y `JetBrains Mono` con `tabular-nums`, y diseño responsivo con *drawer* móvil de `56 px`).
     - **Three.js WebGL (`public/js/vendor/three.min.js` y `public/js/globe3d.js`):** Globo Terráqueo 3D fotorealista con esfera de 64×64 segmentos (`THREE.MeshPhongMaterial`), textura satelital local **NASA Blue Marble** (`/textures/earth-blue-marble.jpg`), mapa topográfico de relieve (`/textures/earth-topology.png`), mapa de reflejo especular en océanos (`/textures/earth-water.png`), halo atmosférico Fresnel (`THREE.ShaderMaterial`), rotación continua libre de **360° completos**, escalado inverso de marcadores al hacer zoom (`clamp` hasta `6.5x`), arcos 3D (`THREE.QuadraticBezierCurve3`), etiquetas flotantes glassmorphism con detección de colisiones, selector de miembros, control segmentado por regiones (*Centro de México*, *Yucatán*, *Sudamérica*, *España*) y **control por gestos de la mano frente a la cámara web** (`getUserMedia` + seguimiento óptico de centroide en tiempo real).
     - **Chart.js 4.4 (`public/js/dashboard.js`):** Gráficas de barras horizontales con `autoSkip: false` (para mostrar siempre todas las categorías en escritorio y móvil) y gráficas de dona con rotación continua automática, anillo HUD interior contrarrotante y bordes oscuros `#111114` integrados a la tarjeta.
   - **Plataforma de despliegue en la nube:** **Render** (`https://community360-cloud.onrender.com`) conectado en despliegue continuo (*Continuous Deployment*) a la rama `main` de **GitHub** (`https://github.com/AndresChan123/community360-cloud`).

---

### Apartado 4 del PDF: Análisis de Base de Datos y Escalabilidad (Enfoque Principal)

1. **Soporte ante grandes volúmenes de información y optimizaciones implementadas:**
   - **Optimizaciones reales aplicadas en el servidor para estabilidad en la nube:**
     - **Caché de corta duración (TTL) en autenticación y resumen histórico:** Cuando un usuario abre `/dashboard`, el navegador solicita simultáneamente la vista HTML, la sesión, las interacciones, el resumen histórico, el directorio y el handshake WebSocket. Para evitar ráfagas repetitivas hacia Firebase Auth, Firestore y CockroachDB, implementé un caché en memoria de `25 s` para tokens verificados (que se invalida al instante en `POST /api/auth/logout` mediante `invalidarCacheToken()`) y un caché de `45 s` en `GET /api/historico/resumen`.
     - **Manejo resiliente del Pool de CockroachDB Serverless:** Ajusté el pool de `pg` a `max: 5` conexiones con `keepAlive: true` y manejador `pool.on("error")`, evitando que el cierre de conexiones inactivas por parte de CockroachDB Serverless reinicie el contenedor en Render.
     - **Ahorro de CPU/GPU en el cliente:** El bucle `requestAnimationFrame` de Three.js pausa automáticamente el renderizado 3D cuando el usuario está consultando otra vista del menú lateral o cuando la pestaña del navegador está en segundo plano (`document.hidden`).
   - **Cuellos de botella si el sistema escalara de 1,000 a cientos de miles de interacciones por minuto:**
     1. Recálculo completo de la colección `interacciones` en `recalcularYGuardarMetricas()` en cada escritura.
     2. Contención de escritura (*hotspotting*) sobre el único documento `metricas_vivas/actuales` en Firestore.
     3. Validación sincrónica de `id_usuario` contra CockroachDB en cada `POST /api/interacciones`.
     4. Estado de clientes WebSocket (`wss.clients`) alojado en la memoria de una sola instancia de Node.js.
2. **Modificaciones técnicas propuestas para escalar a cientos de miles de registros:**
   1. **Agregación incremental (*Delta Aggregation*) con `FieldValue.increment(delta)` y contadores distribuidos (*shards*)** en `metricas_vivas` para actualizar promedios y conteos en $O(1)$ sin releer toda la colección `interacciones`.
   2. **Caché distribuido en Redis** para el diccionario `id_usuario -> { consentimiento_datos, estado }`, resolviendo la validación de integridad híbrida en sub-milisegundos sin golpear CockroachDB en cada interacción.
   3. **Paginación con cursores (`startAfter`)** en Firestore sobre `timestamp DESC`.
   4. **Redis Pub/Sub** para sincronizar eventos WebSocket entre múltiples réplicas horizontales de Node.js en Render.

---

### Apartado 5 del PDF: Evidencias del Sistema Desplegado y Catálogo de las 14 Capturas Oficiales

Todas las capturas reales en resolución Full-HD (**1920 × 1080 px**) están listas en la carpeta local `capturas_reporte/` del proyecto:

| Archivo en `capturas_reporte/` | Figura sugerida en el PDF | Qué evidencia en el reporte |
|---|---|---|
| `01_fase3_login_docente.png` | **Figura 1** | Pantalla de inicio de sesión (`/login`) en Obsidian Dark Mode ingresando con la cuenta docente obligatoria `lizandro.reyes` (`lizandro.reyes@utmetropolitana.edu.mx`). |
| `02_fase4_resumen_general_oscuro.png` | **Figura 2** | Vista *Resumen de áreas* (`#vista-inicio`) con barra lateral única de `240 px`, estado `Conectado en tiempo real`, sesión activa del docente y los 4 contadores maestros (`1,068` miembros, `207` publicaciones, `21` ciudades, `171` perfiles privados). |
| `03_fase4_pulso_tiempo_real_graficas.png` | **Figura 3** | Vista *01 · Pulso en tiempo real* (`#vista-pulso`) alimentada por WebSockets: 5 KPIs dinámicos (`207` publicaciones, `+0.30` ánimo, `549` reacciones, `72.0%` ambiente favorable, `22.2%` moderación) y las 4 gráficas con `autoSkip: false` y bordes `#111114`. |
| `04_fase4_planeta_tierra_3d_yucatan.png` | **Figura 4** | Vista *02 · Publicaciones y mapa* (`#vista-actividad`): **Globo Terráqueo 3D fotorealista** (Three.js + textura satelital local `/textures/earth-blue-marble.jpg` + `bumpMap` + `specularMap` + halo Fresnel) centrado en **Mérida, Yucatán**, con controles flotantes agrupados (selector de miembro + *segmented control* de regiones arriba a la izquierda, dock vertical de cámara/gestos a la derecha y tarjeta glassmorphism abajo a la izquierda). |
| `05_fase4_regiones_y_tabla_publicaciones.png` | **Figura 5** | Mapa de calor regional interactivo por estado/país (Jalisco `31`, Nuevo León `26`, Yucatán `25`, CDMX `21`, Quintana Roo `15`...) y tabla de historial en vivo de publicaciones recientes. |
| `06_fase4_perfiles_retencion_cockroachdb.png` | **Figura 6** | Vista *03 · Perfiles y retención* (`#vista-comunidad`) alimentada por REST desde CockroachDB Cloud: `1,068` miembros, `421` en riesgo, `171` con ubicación privada, `793` en cuarentena y gráficas de permanencia (`36.5%` activo, `39.4%` en riesgo, `24.1%` inactivo), intereses y edades. |
| `07_fase4_directorio_privacidad_usuarios.png` | **Figura 7** | Vista *04 · Directorio y privacidad* (`#vista-directorio`) con filtros manuales accionados mediante el botón **`Actualizar lista`**, scrollbar oscuro personalizado y cumplimiento de privacidad geográfica (`Autorizada` con ciudad vs. `Sin consentimiento` con candado `Protegido`). |
| `08_modo_claro_ejecutivo_y_cambio_cuenta.png` | **Figura 8** | Demostración del cambio a **Modo Claro** y del menú desplegable de sesión que permite alternar entre `lizandro.reyes`, `lector@community360.mx` y `admin@community360.mx`. |
| `09_fase5_websocket_post_en_vivo.png` | **Figura 9 (Pantalla Dividida 1)** | **Mitad izquierda Postman / Mitad derecha Navegador en vivo:** Petición `POST /api/interacciones` (`201 Created`) para el usuario `U000176` y actualización instantánea por WebSocket en el dashboard (`208` publicaciones activas y notificación verde `"Nueva actividad"` sin recargar la página). |
| `10_fase3_y_5_evidencia_pruebas_api_roles.png` | **Figura 10 (Pantalla Dividida 2)** | **Mitad izquierda Postman / Mitad derecha Navegador en vivo:** Petición `PUT /api/interacciones/:id` (`200 OK`) modificando sentimiento y reacciones, reflejada al instante por WebSocket en el dashboard (`"Actividad editada"`). |
| `11_split_postman_delete_200_y_dashboard.png` | **Figura 11 (Pantalla Dividida 3)** | **Mitad izquierda Postman / Mitad derecha Navegador en vivo:** Petición `DELETE /api/interacciones/:id` (`200 OK`) eliminando la interacción de prueba y restaurando en vivo el contador a `207` publicaciones (`"Actividad eliminada"`). |
| `12_split_postman_403_lector_forbidden.png` | **Figura 12 (Pantalla Dividida 4)** | **Mitad izquierda Postman / Mitad derecha Navegador:** Prueba de control de acceso por rol (`Fase 3 y 5`): la cuenta `lector@community360.mx` intenta hacer `POST /api/interacciones` y el servidor rechaza la escritura con **`403 Forbidden`** (`"Acceso denegado. Se requiere rol: admin. Tu rol actual es: lector."`). |
| `13_split_postman_422_integridad_hibrida.png` | **Figura 13 (Pantalla Dividida 5)** | **Mitad izquierda Postman / Mitad derecha Navegador:** Prueba de integridad referencial híbrida CockroachDB ↔ Firestore: intento de `POST /api/interacciones` con `id_usuario: "U999999"` (inexistente en CockroachDB), rechazado con **`422 Unprocessable Entity`**. |
| `14_vista_movil_responsiva_pastel.png` | **Figura 14** | **Vista Móvil Responsiva (`< 768 px`):** Encabezado compacto de `56 px` con logo `C360`, botón de menú hamburguesa para abrir el *drawer* lateral y bitácora de eventos WebSocket en tiempo real. |

---

### Apartado 6 del PDF: Enlaces de Despliegue y Credenciales de Evaluación (Obligatorio)

- **Liga pública del proyecto desplegado y activo en Render:**
  https://community360-cloud.onrender.com
- **Repositorio de código en GitHub:**
  https://github.com/AndresChan123/community360-cloud
- **Credenciales del usuario docente habilitado en Firebase Auth y Firestore (`administradores` con rol `admin`):**
  - **Usuario:** `lizandro.reyes`
  - **Correo (ambos funcionan en el campo de login):** `lizandro.reyes@utmetropolitana.edu.mx`
  - **Contraseña:** `lizandr0_reye$`
- **Cuentas adicionales de prueba configuradas en el proyecto:**
  - **Administrador general (`admin`):** `admin@community360.mx` / `Community360!Admin`
  - **Solo lectura (`lector`):** `lector@community360.mx` / `Community360!Lector`

---

### Apartado 7 del PDF: Conclusiones y Referencias Bibliográficas (APA 7)

1. **Puntos clave para redactar la conclusión personal (en primera persona):**
   - Integrar las seis fases demostró en la práctica por qué convenía separar desde la Fase 1 el padrón relacional en **CockroachDB Cloud** y las interacciones en **Cloud Firestore**: cuando ejecuté las pruebas en pantalla dividida desde Postman, el backend en Node.js pudo verificar en milisegundos que el `id_usuario` existiera en CockroachDB (`422` si no existe) y, al mismo tiempo, almacenar el documento en Firestore y empujar el cambio por **WebSockets** hacia el navegador sin necesidad de formularios en el dashboard ni recargas de página.
   - La regla de privacidad geográfica (`consentimiento_datos = false`) se mantuvo de extremo a extremo desde el ETL en Python hasta la visualización 3D: las interacciones en Firestore no guardan ubicación propia, el directorio muestra el candado `"Protegido"` en los 171 usuarios sin consentimiento, y el **Globo Terráqueo 3D en Three.js** proyecta únicamente las 21 ciudades de miembros que sí autorizaron compartir su ubicación.
   - En el despliegue en **Render** resolví problemas reales de operación en la nube: lectura de credenciales de Firebase Admin desde variables de entorno en memoria (`FIREBASE_SERVICE_ACCOUNT_JSON`), control de desconexiones inactivas en el pool de CockroachDB Serverless, renovación silenciosa de tokens JWT tras 60 minutos, *heartbeat* WebSocket y un endpoint `/healthz` para evitar la suspensión del contenedor.
2. **Referencias bibliográficas sugeridas en formato APA 7:**
   - Cabello, R. [mrdoob]. (2026). *Three.js: JavaScript 3D WebGL library documentation* (r160). https://threejs.org/docs/
   - Cockroach Labs. (2026). *CockroachDB Cloud documentation: SQL statements, indexes and constraints*. https://www.cockroachlabs.com/docs/
   - Google. (2026). *Firebase Admin Node.js SDK: Verify ID tokens and Cloud Firestore documentation*. https://firebase.google.com/docs/admin/setup
   - Internet Engineering Task Force [IETF]. (2011). *The WebSocket Protocol (RFC 6455)*. https://datatracker.ietf.org/doc/html/rfc6455
   - National Aeronautics and Space Administration [NASA]. (2026). *Visible Earth: Blue Marble Next Generation & Topography*. https://visibleearth.nasa.gov/
