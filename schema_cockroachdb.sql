-- Esquema de Community 360 en CockroachDB (sale del modelo de la Fase 1)
CREATE TABLE IF NOT EXISTS ubicaciones (
  id_ubicacion INT PRIMARY KEY,
  ciudad STRING NOT NULL,
  estado STRING NOT NULL,
  pais STRING NOT NULL,
  zona_horaria STRING NOT NULL,
  UNIQUE (ciudad, estado, pais)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario STRING PRIMARY KEY CHECK (id_usuario ~ '^U[0-9]{6}$'),
  alias STRING NOT NULL UNIQUE,
  fecha_ingreso DATE NOT NULL,
  rango_edad STRING NOT NULL
    CHECK (rango_edad IN ('18-24','25-31','32-38','39+')),
  especie_fursona STRING NOT NULL,
  interes_principal STRING NOT NULL,
  plataforma_principal STRING NOT NULL,
  es_artista BOOL NOT NULL,
  mensajes_30d INT NOT NULL CHECK (mensajes_30d >= 0),
  reacciones_30d INT NOT NULL CHECK (reacciones_30d >= 0),
  eventos_asistidos INT NOT NULL CHECK (eventos_asistidos >= 0),
  comisiones_compradas INT NOT NULL CHECK (comisiones_compradas >= 0),
  sentimiento_promedio DECIMAL(4,3) NOT NULL
    CHECK (sentimiento_promedio BETWEEN -1 AND 1),
  ultima_actividad DATE NOT NULL,
  estatus STRING NOT NULL
    CHECK (estatus IN ('activo','en_riesgo','inactivo')),
  consentimiento_datos BOOL NOT NULL,
  id_ubicacion INT REFERENCES ubicaciones (id_ubicacion),
  latitud DECIMAL(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud DECIMAL(9,6) CHECK (longitud BETWEEN -180 AND 180),
  CHECK (ultima_actividad >= fecha_ingreso),
  CONSTRAINT privacidad_usuario CHECK (
    consentimiento_datos
    OR (id_ubicacion IS NULL AND latitud IS NULL AND longitud IS NULL))
);

-- Indices planeados en la Fase 1
CREATE INDEX IF NOT EXISTS idx_usuarios_estatus_actividad ON usuarios (estatus, ultima_actividad DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_ubicacion_estatus ON usuarios (id_ubicacion, estatus);
CREATE INDEX IF NOT EXISTS idx_usuarios_plataforma_estatus ON usuarios (plataforma_principal, estatus);
