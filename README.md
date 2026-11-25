# Community 360 — Arquitectura de Datos en la Nube y Dashboard Analítico en Tiempo Real

## 1. Fase 2: Limpieza, Transformación y Carga (ETL en Python)
1. Coloca los dos CSV originales en `datos/`.
2. Instala las dependencias de Python:
   ```bash
   pip install -r requirements.txt
   ```
3. Ejecuta el script ETL y carga a CockroachDB + Firestore:
   ```bash
   python etl_community360.py --usuarios datos/comunidad_virtual_usuarios.csv --interacciones datos/comunidad_virtual_interacciones_1000.csv --cargar todo
   ```

---

## 2. Fases 3 a 6: Servidor Node.js (Express + WebSockets), API REST y Dashboard

### Variables de entorno (`.env`)
```env
COCKROACH_DATABASE_URL=postgresql://USUARIO:CONTRASENA@HOST:26257/defaultdb?sslmode=verify-full
GOOGLE_APPLICATION_CREDENTIALS=./credenciales/firebase-admin.json
FIREBASE_WEB_API_KEY=TU_FIREBASE_WEB_API_KEY
PORT=3000
```

### Aprovisionar el usuario docente y administradores en Firebase Auth + Firestore (`administradores`)
```bash
npm run seed:admin
```
Esto crea y habilita en **Firebase Authentication** y en la colección **`administradores`** de Firestore:
- **Usuario docente obligatorio:**
  - **Usuario:** `lizandro.reyes`
  - **Correo:** `lizandro.reyes@utmetropolitana.edu.mx`
  - **Contraseña:** `lizandr0_reye$`
  - **Rol:** `admin`

### Iniciar el servidor
```bash
npm start
```
Abre `http://localhost:3000` (redirige a `/login` si no hay sesión activa y a `/dashboard` tras autenticarse).

---

## 3. Resumen de Endpoints REST Desarrollados (7 Endpoints)

| # | Método | Ruta | Propósito |
|---|--------|------|-----------|
| 1 | `POST` | `/api/auth/login` | Valida usuario/correo y contraseña contra Firebase Auth, verifica el ID Token con Admin SDK y consulta el rol en Firestore (`administradores/{uid}`). |
| 2 | `GET` | `/api/auth/sesion` | Verifica la vigencia del ID Token y devuelve `{ uid, email, rol }` del usuario autenticado. |
| 3 | `POST` | `/api/auth/logout` | Revoca los refresh tokens en Firebase Auth y limpia la cookie de sesión. |
| 4 | `GET` | `/api/historico/resumen` | Consulta en CockroachDB las métricas históricas del padrón (`1,068` usuarios, estatus, intereses, edad, ubicaciones con consentimiento y verificación de privacidad `0` violaciones) y en Firestore la auditoría (`cuarentena_interacciones` y `bitacora_etl`). |
| 5 | `GET` | `/api/historico/usuarios` | Consulta filtrable del padrón en CockroachDB (`estatus`, `plataforma`, `consentimiento`) demostrando que quienes tienen `consentimiento_datos = false` tienen ubicación y coordenadas en `NULL`. |
| 6 | `GET` | `/api/interacciones` | Obtiene las interacciones válidas desde Firestore y los indicadores matemáticos calculados en `metricas_vivas/actuales`. |
| 7 | `POST` | `/api/interacciones` | *(Rol `admin` · Postman)* Crea una interacción en Firestore tras validar que `id_usuario` exista en CockroachDB, recalcula `metricas_vivas/actuales` y emite el evento `interaccion_creada` por WebSocket. |
| 8 | `PUT` | `/api/interacciones/:id` | *(Rol `admin` · Postman)* Modifica una interacción en Firestore, recalcula `metricas_vivas/actuales` y emite el evento `interaccion_actualizada` por WebSocket. |
| 9 | `DELETE` | `/api/interacciones/:id` | *(Rol `admin` · Postman)* Elimina una interacción de Firestore, recalcula `metricas_vivas/actuales` y emite el evento `interaccion_eliminada` por WebSocket. |
