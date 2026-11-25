#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Community 360 - Fase 2: limpieza, transformacion y carga.

Uso (solo local, sin tocar la nube):
    python etl_community360.py --usuarios datos/comunidad_virtual_usuarios.csv \
        --interacciones datos/comunidad_virtual_interacciones_1000.csv

Uso con carga a la nube (necesita el archivo .env con las credenciales):
    python etl_community360.py --usuarios ... --interacciones ... --cargar todo

Las 8 etapas se ejecutan siempre en el mismo orden. Nunca se escriben
contrasenas ni cadenas de conexion en el codigo: se leen de variables de entorno.
"""
import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

# ----------------------------------------------------------------------------
# Constantes del modelo (salen de la Fase 1)
# ----------------------------------------------------------------------------
NULOS = {"", "na", "n/a", "null", "none", "nan", "-"}
CANALES = {"telegram": "Telegram", "discord": "Discord", "tiktok": "TikTok",
           "instagram": "Instagram", "facebook": "Facebook",
           "twitter/x": "Twitter/X", "twitter": "Twitter/X", "x": "Twitter/X"}
TIPOS = {"mensaje", "comentario", "reaccion", "respuesta_encuesta", "rsvp_evento"}
DISPOSITIVOS = {"android": "Android", "ios": "iOS", "web": "Web", "escritorio": "Escritorio"}
ETIQUETAS_VALIDAS = ["arte", "aviso", "evento", "humor", "juegos", "musica", "reglas"]
ESTATUS = {"activo", "en_riesgo", "inactivo"}
RANGOS_EDAD = {"18-24", "25-31", "32-38", "39+"}
RE_USUARIO = re.compile(r"^U\d{6}$")
RE_INTERACCION = re.compile(r"^I\d{7}$")
CAMPOS_GEO_USUARIO = ["pais", "estado", "ciudad", "zona_horaria", "latitud", "longitud"]
CAMPOS_GEO_INTERACCION = ["pais", "estado", "ciudad"]

LOG = []


def log(texto=""):
    print(texto, flush=True)
    LOG.append(texto)


def banner(numero, titulo):
    log("")
    log("=" * 70)
    log(f"ETAPA {numero}: {titulo}")
    log("=" * 70)


# ----------------------------------------------------------------------------
# Utilidades pequenas
# ----------------------------------------------------------------------------
def leer_csv(ruta):
    with open(ruta, newline="", encoding="utf-8-sig") as f:
        lector = csv.DictReader(f)
        filas = []
        for n, fila in enumerate(lector, start=2):   # la fila 1 es el encabezado
            fila["_fila"] = n
            filas.append(fila)
        return filas, lector.fieldnames


def sin_acentos(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto)
                   if unicodedata.category(c) != "Mn")


def compactar(texto):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", texto)).strip()


def parsear_fecha(texto):
    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, formato).date()
        except (ValueError, TypeError):
            continue
    return None


def parsear_timestamp(texto):
    """Devuelve un datetime en UTC. Si no trae zona, supongo que ya es UTC."""
    if not texto:
        return None
    try:
        dt = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = datetime.strptime(texto, "%d/%m/%Y %H:%M:%S")
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def unificar_mayusculas(filas, campo, cambios):
    """Si un mismo valor aparece escrito con distinta capitalizacion, dejo la mas comun."""
    conteo = {}
    for f in filas:
        v = f.get(campo)
        if v:
            conteo.setdefault(v.casefold(), Counter())[v] += 1
    for f in filas:
        v = f.get(campo)
        if v:
            elegido = conteo[v.casefold()].most_common(1)[0][0]
            if elegido != v:
                f[campo] = elegido
                cambios[campo] += 1


# ----------------------------------------------------------------------------
# ETAPA 1: duplicados
# ----------------------------------------------------------------------------
def etapa1_duplicados(usuarios, interacciones, res):
    banner(1, "Eliminacion de registros duplicados")
    # usuarios: fila completa repetida, id_usuario repetido o alias repetido
    vistos_fila, vistos_id, vistos_alias = set(), set(), set()
    unicos, dup = [], Counter()
    for f in usuarios:
        valores = tuple(v for k, v in f.items() if k != "_fila")
        id_ = (f.get("id_usuario") or "").strip().upper()
        alias = (f.get("alias") or "").strip().casefold()
        if valores in vistos_fila:
            dup["fila_completa"] += 1
        elif id_ and id_ in vistos_id:
            dup["id_usuario"] += 1
        elif alias and alias in vistos_alias:
            dup["alias"] += 1
        else:
            unicos.append(f)
            vistos_fila.add(valores)
            vistos_id.add(id_)
            vistos_alias.add(alias)
    res["usuarios"]["duplicados"] = dict(dup)
    res["usuarios"]["duplicados_total"] = sum(dup.values())
    log(f"usuarios: {len(usuarios)} recibidos, {sum(dup.values())} duplicados eliminados {dict(dup)}")

    # interacciones: fila completa repetida o id_interaccion repetido
    vistos_fila, vistos_id = set(), set()
    unicas, dup = [], Counter()
    for f in interacciones:
        valores = tuple(v for k, v in f.items() if k != "_fila")
        id_ = (f.get("id_interaccion") or "").strip().upper()
        if valores in vistos_fila:
            dup["fila_completa"] += 1
        elif id_ and id_ in vistos_id:
            dup["id_interaccion"] += 1
        else:
            unicas.append(f)
            vistos_fila.add(valores)
            vistos_id.add(id_)
    res["interacciones"]["duplicados"] = dict(dup)
    res["interacciones"]["duplicados_total"] = sum(dup.values())
    log(f"interacciones: {len(interacciones)} recibidas, {sum(dup.values())} duplicadas eliminadas {dict(dup)}")
    return unicos, unicas


# ----------------------------------------------------------------------------
# ETAPA 2: vacios y nulos
# ----------------------------------------------------------------------------
def normalizar_nulos(filas, nombre, res):
    nulos, espacios = Counter(), 0
    for f in filas:
        for campo, valor in list(f.items()):
            if campo == "_fila":
                continue
            if valor is None:
                f[campo] = None
                nulos[campo] += 1
                continue
            limpio = valor.strip()
            if limpio != valor:
                espacios += 1
                f.setdefault("_cambios", set()).add(campo)
            if limpio.casefold() in NULOS:
                f[campo] = None
                nulos[campo] += 1
                f.setdefault("_cambios", set()).add(campo)
            else:
                f[campo] = limpio
    res[nombre]["nulos_normalizados"] = dict(nulos)
    res[nombre]["nulos_normalizados_total"] = sum(nulos.values())
    res[nombre]["espacios_recortados"] = espacios
    return nulos


def etapa2_nulos(usuarios, interacciones, res):
    banner(2, "Normalizacion de valores vacios y nulos")
    nu = normalizar_nulos(usuarios, "usuarios", res)
    ni = normalizar_nulos(interacciones, "interacciones", res)
    # las reacciones no traen texto: el texto queda en NULL y la longitud en 0
    corregidas = 0
    for f in interacciones:
        if f["texto"] is None and f["longitud_texto"] not in (None, "0"):
            f["longitud_texto"] = "0"
            f.setdefault("_cambios", set()).add("longitud_texto")
            corregidas += 1
    res["interacciones"]["longitud_texto_corregida"] = corregidas
    log(f"usuarios: {sum(nu.values())} valores vacios pasaron a NULL -> {dict(nu)}")
    log(f"interacciones: {sum(ni.values())} valores vacios pasaron a NULL -> {dict(ni)}")
    log(f"interacciones: {corregidas} reacciones sin texto con longitud_texto corregida a 0")


# ----------------------------------------------------------------------------
# ETAPA 3: estandarizacion
# ----------------------------------------------------------------------------
def estandarizar_usuario(f):
    if f["id_usuario"]:
        f["id_usuario"] = f["id_usuario"].upper()
    for campo in ("fecha_ingreso", "ultima_actividad"):
        d = parsear_fecha(f[campo]) if f[campo] else None
        if d:
            f[campo] = d.isoformat()
    for campo in ("pais", "estado", "ciudad", "especie_fursona", "interes_principal", "alias"):
        if f[campo]:
            f[campo] = compactar(f[campo])
    if f["plataforma_principal"]:
        f["plataforma_principal"] = CANALES.get(f["plataforma_principal"].casefold(),
                                                 compactar(f["plataforma_principal"]))
    if f["estatus"]:
        f["estatus"] = f["estatus"].casefold().replace(" ", "_")
    if f["rango_edad"]:
        f["rango_edad"] = f["rango_edad"].replace("\u2013", "-").replace(" ", "")
    if f["consentimiento_datos"]:
        c = f["consentimiento_datos"].casefold()
        if c in ("si", "s\u00ed", "s", "true", "1", "yes"):
            f["consentimiento_datos"] = "si"
        elif c in ("no", "n", "false", "0"):
            f["consentimiento_datos"] = "no"
    if f["es_artista"]:
        a = f["es_artista"].casefold()
        if a in ("1", "true", "si", "s\u00ed"):
            f["es_artista"] = "1"
        elif a in ("0", "false", "no"):
            f["es_artista"] = "0"
    for campo in ("latitud", "longitud", "sentimiento_promedio"):
        if f[campo]:
            f[campo] = f[campo].replace(",", ".")


def estandarizar_interaccion(f):
    f["_ts_original"] = f["timestamp"]
    if f["id_interaccion"]:
        f["id_interaccion"] = f["id_interaccion"].upper()
    if f["id_usuario"]:
        f["id_usuario"] = f["id_usuario"].upper()
    dt = parsear_timestamp(f["timestamp"])
    if dt:
        f["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S+00")
    if f["canal"]:
        f["canal"] = CANALES.get(f["canal"].casefold(), compactar(f["canal"]))
    if f["dispositivo"]:
        f["dispositivo"] = DISPOSITIVOS.get(f["dispositivo"].casefold(), compactar(f["dispositivo"]))
    for campo in ("tipo", "tema"):
        if f[campo]:
            f[campo] = f[campo].casefold().replace(" ", "_")
    if f["idioma"]:
        f["idioma"] = f["idioma"].casefold()
    for campo in ("pais", "estado", "ciudad"):
        if f[campo]:
            f[campo] = compactar(f[campo])
    if f["sentimiento"]:
        f["sentimiento"] = f["sentimiento"].replace(",", ".")
    # campo multivaluado: "evento|arte|aviso" -> ["evento", "arte", "aviso"]
    etiquetas = []
    for e in (f["etiquetas"] or "").split("|"):
        e = e.strip().casefold()
        if e and e not in etiquetas:
            etiquetas.append(e)
    f["etiquetas"] = etiquetas


def etapa3_estandarizar(usuarios, interacciones, res):
    banner(3, "Estandarizacion de fechas, categorias y formatos")
    cu, ci = Counter(), Counter()
    for f in usuarios:
        antes = {k: v for k, v in f.items() if not k.startswith("_")}
        estandarizar_usuario(f)
        for k, v in antes.items():
            if f[k] != v:
                cu[k] += 1
                f.setdefault("_cambios", set()).add(k)
    for campo in ("especie_fursona", "interes_principal", "pais", "estado", "ciudad"):
        unificar_mayusculas(usuarios, campo, cu)
    for f in interacciones:
        antes = {k: v for k, v in f.items() if not k.startswith("_")}
        estandarizar_interaccion(f)
        for k, v in antes.items():
            if k != "etiquetas" and f[k] != v:
                ci[k] += 1
                f.setdefault("_cambios", set()).add(k)
    for campo in ("pais", "estado", "ciudad"):
        unificar_mayusculas(interacciones, campo, ci)
    res["usuarios"]["estandarizados"] = dict(cu)
    res["interacciones"]["estandarizados"] = dict(ci)
    log(f"usuarios: valores modificados por campo -> {dict(cu)}")
    log(f"interacciones: valores modificados por campo -> {dict(ci)}")
    total_tags = sum(len(f["etiquetas"]) for f in interacciones)
    log(f"interacciones: campo etiquetas separado en lista ({total_tags} etiquetas en total)")


# ----------------------------------------------------------------------------
# ETAPA 4: validacion de tipos
# ----------------------------------------------------------------------------
def entero(texto, minimo=0):
    if texto is None or not re.fullmatch(r"-?\d+", texto):
        raise ValueError("no es entero")
    valor = int(texto)
    if valor < minimo:
        raise ValueError(f"menor que {minimo}")
    return valor


def decimal(texto, minimo, maximo, decimales):
    if texto is None:
        raise ValueError("vacio")
    valor = float(texto)
    if not minimo <= valor <= maximo:
        raise ValueError(f"fuera de [{minimo}, {maximo}]")
    return round(valor, decimales)


def validar_usuario(f):
    """Devuelve (registro_tipado, lista_de_errores)."""
    errores, t = [], {}

    def probar(campo, funcion):
        try:
            t[campo] = funcion()
        except (ValueError, TypeError) as e:
            errores.append(f"{campo}: {e}")

    probar("id_usuario", lambda: f["id_usuario"] if f["id_usuario"] and RE_USUARIO.match(f["id_usuario"]) else (_ for _ in ()).throw(ValueError("formato")))
    probar("alias", lambda: f["alias"] or (_ for _ in ()).throw(ValueError("vacio")))
    probar("fecha_ingreso", lambda: date.fromisoformat(f["fecha_ingreso"]))
    probar("ultima_actividad", lambda: date.fromisoformat(f["ultima_actividad"]))
    probar("rango_edad", lambda: f["rango_edad"] if f["rango_edad"] in RANGOS_EDAD else (_ for _ in ()).throw(ValueError("valor no permitido")))
    for campo in ("especie_fursona", "interes_principal"):
        probar(campo, lambda c=campo: f[c] or (_ for _ in ()).throw(ValueError("vacio")))
    probar("plataforma_principal", lambda: f["plataforma_principal"] if f["plataforma_principal"] in CANALES.values() else (_ for _ in ()).throw(ValueError("valor no permitido")))
    probar("es_artista", lambda: {"1": True, "0": False}[f["es_artista"]])
    for campo in ("mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas"):
        probar(campo, lambda c=campo: entero(f[c]))
    probar("sentimiento_promedio", lambda: decimal(f["sentimiento_promedio"], -1, 1, 3))
    probar("estatus", lambda: f["estatus"] if f["estatus"] in ESTATUS else (_ for _ in ()).throw(ValueError("valor no permitido")))
    probar("consentimiento_datos", lambda: {"si": True, "no": False}[f["consentimiento_datos"]])
    # geografia: puede venir vacia, pero si viene debe ser valida
    t["pais"], t["estado"], t["ciudad"], t["zona_horaria"] = f["pais"], f["estado"], f["ciudad"], f["zona_horaria"]
    for campo, lim in (("latitud", 90), ("longitud", 180)):
        try:
            t[campo] = None if f[campo] is None else decimal(f[campo], -lim, lim, 6)
        except ValueError as e:
            errores.append(f"{campo}: {e}")
    if "fecha_ingreso" in t and "ultima_actividad" in t and t["ultima_actividad"] < t["fecha_ingreso"]:
        errores.append("ultima_actividad anterior a fecha_ingreso")
    t["_fila"] = f["_fila"]
    t["_cambios"] = f.get("_cambios", set())
    return t, errores


def validar_interaccion(f):
    errores, t = [], {}

    def probar(campo, funcion):
        try:
            t[campo] = funcion()
        except (ValueError, TypeError) as e:
            errores.append(f"{campo}: {e}")

    def exigir(condicion, mensaje):
        if not condicion:
            raise ValueError(mensaje)

    probar("id_interaccion", lambda: (exigir(f["id_interaccion"] and RE_INTERACCION.match(f["id_interaccion"]), "formato"), f["id_interaccion"])[1])
    probar("id_usuario", lambda: (exigir(f["id_usuario"] and RE_USUARIO.match(f["id_usuario"]), "formato"), f["id_usuario"])[1])
    probar("fecha_hora", lambda: (exigir(parsear_timestamp(f["timestamp"]), "fecha invalida"), parsear_timestamp(f["timestamp"]))[1])
    probar("canal", lambda: (exigir(f["canal"] in CANALES.values(), "valor no permitido"), f["canal"])[1])
    probar("tipo", lambda: (exigir(f["tipo"] in TIPOS, "valor no permitido"), f["tipo"])[1])
    probar("tema", lambda: (exigir(f["tema"], "vacio"), f["tema"])[1])
    probar("sentimiento", lambda: decimal(f["sentimiento"], -1, 1, 2))
    probar("dispositivo", lambda: (exigir(f["dispositivo"] in DISPOSITIVOS.values(), "valor no permitido"), f["dispositivo"])[1])
    probar("longitud_texto", lambda: entero(f["longitud_texto"]))
    probar("reacciones_recibidas", lambda: entero(f["reacciones_recibidas"]))
    t["idioma"] = f["idioma"] or "es"
    t["texto"] = f["texto"]
    if t["texto"] is None and t.get("longitud_texto", 0) != 0:
        errores.append("texto vacio con longitud_texto distinta de 0")
    t["etiquetas"] = [e for e in f["etiquetas"] if e in ETIQUETAS_VALIDAS]
    if len(t["etiquetas"]) != len(f["etiquetas"]):
        errores.append("etiqueta fuera del catalogo")
    for campo in CAMPOS_GEO_INTERACCION:
        t[campo] = f[campo]
    t["_fila"] = f["_fila"]
    t["_cambios"] = f.get("_cambios", set())
    t["_ts_original"] = f["_ts_original"]
    return t, errores


def marcar_atipicos(usuarios_validos):
    """Marca como atipico al usuario cuyo valor supera el doble del segundo mayor."""
    atipicos = []
    for campo in ("mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas"):
        orden = sorted(usuarios_validos, key=lambda u: u[campo], reverse=True)
        if len(orden) > 1 and orden[1][campo] > 0 and orden[0][campo] > 2 * orden[1][campo]:
            atipicos.append({"id_usuario": orden[0]["id_usuario"], "campo": campo,
                             "valor": orden[0][campo], "segundo_mayor": orden[1][campo]})
    return atipicos


def etapa4_validar(usuarios, interacciones, res):
    banner(4, "Validacion de tipos de datos")
    u_ok, u_mal, i_ok, i_mal = [], [], [], []
    for f in usuarios:
        t, errores = validar_usuario(f)
        (u_mal if errores else u_ok).append((f, errores) if errores else t)
    for f in interacciones:
        t, errores = validar_interaccion(f)
        (i_mal if errores else i_ok).append((f, errores) if errores else t)
    atipicos = marcar_atipicos(u_ok)
    res["usuarios"]["tipos_invalidos"] = len(u_mal)
    res["interacciones"]["tipos_invalidos"] = len(i_mal)
    res["usuarios"]["atipicos"] = atipicos
    log(f"usuarios: {len(u_ok)} validos, {len(u_mal)} con tipos invalidos")
    log(f"interacciones: {len(i_ok)} validas, {len(i_mal)} con tipos invalidos")
    for a in atipicos:
        log(f"valor atipico (se conserva y se anota): {a}")
    return u_ok, u_mal, i_ok, i_mal


# ----------------------------------------------------------------------------
# ETAPA 5: referencias usuario - interaccion
# ----------------------------------------------------------------------------
def etapa5_referencias(usuarios_ok, interacciones_ok, res):
    banner(5, "Verificacion de referencias entre usuarios e interacciones")
    ids = {u["id_usuario"] for u in usuarios_ok}
    validas, huerfanas = [], []
    for i in interacciones_ok:
        (validas if i["id_usuario"] in ids else huerfanas).append(i)
    ids_huerfanos = {i["id_usuario"] for i in huerfanas}
    res["interacciones"]["huerfanas"] = len(huerfanas)
    res["interacciones"]["ids_huerfanos_distintos"] = len(ids_huerfanos)
    res["interacciones"]["con_referencia_valida"] = len(validas)
    res["interacciones"]["usuarios_con_interacciones"] = len({i["id_usuario"] for i in validas})
    log(f"interacciones con usuario existente: {len(validas)} (de {len({i['id_usuario'] for i in validas})} usuarios)")
    log(f"interacciones huerfanas: {len(huerfanas)} ({len(ids_huerfanos)} id_usuario distintos) -> cuarentena")
    return validas, huerfanas


# ----------------------------------------------------------------------------
# ETAPA 6: privacidad geografica
# ----------------------------------------------------------------------------
def tiene_geo(registro, campos):
    return any(registro.get(c) is not None for c in campos)


def etapa6_privacidad(usuarios_ok, validas, huerfanas, res):
    banner(6, "Eliminacion de informacion geografica sin consentimiento")
    sin_consentimiento = [u for u in usuarios_ok if not u["consentimiento_datos"]]
    geo_usuarios = 0
    for u in sin_consentimiento:
        if tiene_geo(u, CAMPOS_GEO_USUARIO):
            geo_usuarios += 1
        for campo in CAMPOS_GEO_USUARIO:
            u[campo] = None
    log(f"usuarios con consentimiento 'no': {len(sin_consentimiento)}")
    log(f"   a {geo_usuarios} se les borro ciudad, estado, pais, zona horaria y coordenadas")

    # catalogo de ubicaciones: solo con lugares de usuarios que SI consintieron
    lugares = {}
    for u in usuarios_ok:
        completo = all(u[c] for c in ("ciudad", "estado", "pais", "zona_horaria"))
        if u["consentimiento_datos"] and completo:
            lugares.setdefault((u["ciudad"], u["estado"], u["pais"]), u["zona_horaria"])
    def clave_orden(k):    # pais, estado y ciudad, sin acentos ni mayusculas
        return tuple(sin_acentos(x).casefold() for x in (k[2], k[1], k[0]))
    orden = sorted(lugares, key=clave_orden)
    ubicaciones = []
    id_por_lugar = {}
    for n, clave in enumerate(orden, start=1):
        ubicaciones.append({"id_ubicacion": n, "ciudad": clave[0], "estado": clave[1],
                            "pais": clave[2], "zona_horaria": lugares[clave]})
        id_por_lugar[clave] = n
    for u in usuarios_ok:
        clave = (u["ciudad"], u["estado"], u["pais"])
        u["id_ubicacion"] = id_por_lugar.get(clave) if u["consentimiento_datos"] else None
    log(f"catalogo de ubicaciones: {len(ubicaciones)} lugares (solo de usuarios con consentimiento)")

    consentimiento = {u["id_usuario"]: u["consentimiento_datos"] for u in usuarios_ok}
    geo_interacciones = 0
    sin_catalogo = 0
    for i in validas:
        i["consentimiento_autor"] = consentimiento[i["id_usuario"]]
        i["id_ubicacion"] = None
        if tiene_geo(i, CAMPOS_GEO_INTERACCION):
            if i["consentimiento_autor"]:
                clave = (i["ciudad"], i["estado"], i["pais"])
                i["id_ubicacion"] = id_por_lugar.get(clave)
                if i["id_ubicacion"] is None:
                    sin_catalogo += 1
            else:
                geo_interacciones += 1
    log(f"interacciones validas de autores sin consentimiento con geo borrada: {geo_interacciones}")
    if sin_catalogo:
        log(f"aviso: {sin_catalogo} interacciones con lugar fuera del catalogo (quedan sin ubicacion)")

    # cuarentena: no se si el autor consintio, asi que tampoco guardo su geografia
    geo_cuarentena = sum(1 for i in huerfanas if tiene_geo(i, CAMPOS_GEO_INTERACCION))
    log(f"interacciones en cuarentena con geo borrada (consentimiento desconocido): {geo_cuarentena}")

    res["usuarios"]["sin_consentimiento"] = len(sin_consentimiento)
    res["usuarios"]["geo_eliminada"] = geo_usuarios
    res["usuarios"]["ubicaciones_catalogo"] = len(ubicaciones)
    res["interacciones"]["geo_eliminada_autores_sin_consentimiento"] = geo_interacciones
    res["interacciones"]["geo_eliminada_cuarentena"] = geo_cuarentena
    res["interacciones"]["geo_eliminada"] = geo_interacciones + geo_cuarentena
    res["interacciones"]["lugar_fuera_de_catalogo"] = sin_catalogo
    return ubicaciones


# ----------------------------------------------------------------------------
# ETAPA 7: archivos depurados
# ----------------------------------------------------------------------------
def escribir_csv(ruta, columnas, filas):
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(columnas)
        for fila in filas:
            w.writerow(["" if fila.get(c) is None else fila[c] for c in columnas])


def construir_cuarentena(huerfanas, malas_i, id_ejecucion, ahora):
    docs = []
    for i in huerfanas:
        docs.append(_doc_cuarentena(i, "usuario_inexistente", id_ejecucion, ahora))
    for f, errores in malas_i:
        docs.append(_doc_cuarentena(f, "tipo_de_dato_invalido: " + "; ".join(errores), id_ejecucion, ahora))
    return docs


def _doc_cuarentena(i, motivo, id_ejecucion, ahora):
    # los registros tipados traen fecha_hora; los crudos traen timestamp
    ts = i.get("_ts_original")
    sent = i.get("sentimiento")
    datos = {"timestamp": ts, "canal": i.get("canal"), "tipo": i.get("tipo"), "tema": i.get("tema"),
             "sentimiento": sent, "texto": i.get("texto"), "idioma": i.get("idioma"),
             "dispositivo": i.get("dispositivo"),
             "longitud_texto": i.get("longitud_texto"),
             "reacciones_recibidas": i.get("reacciones_recibidas"),
             "etiquetas": i.get("etiquetas", [])}
    # sin pais, estado ni ciudad
    return {"id_interaccion": i.get("id_interaccion"), "id_usuario_original": i.get("id_usuario"),
            "motivo_rechazo": motivo, "datos_originales": datos, "fecha_rechazo": ahora,
            "id_ejecucion": id_ejecucion}


def etapa7_exportar(salida, usuarios_ok, ubicaciones, validas, cuarentena, u_mal, res):
    banner(7, "Generacion de archivos depurados")
    salida.mkdir(parents=True, exist_ok=True)
    cols_u = ["id_usuario", "alias", "fecha_ingreso", "rango_edad", "especie_fursona", "interes_principal",
              "plataforma_principal", "es_artista", "mensajes_30d", "reacciones_30d", "eventos_asistidos",
              "comisiones_compradas", "sentimiento_promedio", "ultima_actividad", "estatus",
              "consentimiento_datos", "id_ubicacion", "latitud", "longitud"]
    filas_u = []
    for u in usuarios_ok:
        f = dict(u)
        f["fecha_ingreso"] = u["fecha_ingreso"].isoformat()
        f["ultima_actividad"] = u["ultima_actividad"].isoformat()
        f["es_artista"] = str(u["es_artista"]).lower()
        f["consentimiento_datos"] = str(u["consentimiento_datos"]).lower()
        f["latitud"] = "" if u["latitud"] is None else f"{u['latitud']:.6f}"
        f["longitud"] = "" if u["longitud"] is None else f"{u['longitud']:.6f}"
        filas_u.append(f)
    cols_i = ["id_interaccion", "id_usuario", "fecha_hora", "canal", "tipo", "texto",
              "tema", "sentimiento", "idioma", "dispositivo", "longitud_texto", "reacciones_recibidas",
              "etiquetas"]
    filas_i = []
    for i in validas:
        f = dict(i)
        f["fecha_hora"] = i["fecha_hora"].strftime("%Y-%m-%d %H:%M:%S+00")
        f["sentimiento"] = f"{i['sentimiento']:.2f}"
        f["etiquetas"] = "|".join(i["etiquetas"])
        filas_i.append(f)

    archivos = {
        "usuarios_depurados.csv": (cols_u, filas_u),
        "ubicaciones.csv": (["id_ubicacion", "ciudad", "estado", "pais", "zona_horaria"], ubicaciones),
        "interacciones_depuradas.csv": (cols_i, filas_i),
    }
    for nombre, (cols, filas) in archivos.items():
        escribir_csv(salida / nombre, cols, filas)
        log(f"{nombre}: {len(filas)} filas")
    filas_c = [dict(c, datos_originales=json.dumps(c["datos_originales"], ensure_ascii=False),
                    fecha_rechazo=c["fecha_rechazo"].isoformat()) for c in cuarentena]
    escribir_csv(salida / "cuarentena_interacciones.csv",
                 ["id_interaccion", "id_usuario_original", "motivo_rechazo", "datos_originales",
                  "fecha_rechazo", "id_ejecucion"], filas_c)
    log(f"cuarentena_interacciones.csv: {len(filas_c)} filas")
    if u_mal:
        escribir_csv(salida / "usuarios_rechazados.csv", ["fila_csv", "motivo"],
                     [{"fila_csv": f["_fila"], "motivo": "; ".join(e)} for f, e in u_mal])
        log(f"usuarios_rechazados.csv: {len(u_mal)} filas")
    res["archivos"] = {n: len(f) for n, (c, f) in archivos.items()}
    res["archivos"]["cuarentena_interacciones.csv"] = len(filas_c)


# ----------------------------------------------------------------------------
# Indicadores iniciales para Firestore (documento metricas_vivas/actuales)
# ----------------------------------------------------------------------------
def calcular_metricas(validas, ubicaciones):
    nombre_estado = {u["id_ubicacion"]: u["estado"] for u in ubicaciones}
    total = len(validas)
    prom = round(sum(i["sentimiento"] for i in validas) / total, 3) if total else 0
    return {
        "version": 1,
        "total_interacciones": total,
        "sentimiento_promedio": prom,
        "por_tipo": dict(Counter(i["tipo"] for i in validas)),
        "por_canal": dict(Counter(i["canal"] for i in validas)),
        "por_tema": dict(Counter(i["tema"] for i in validas)),
        "mapa_calor_estado": dict(Counter(nombre_estado[i["id_ubicacion"]]
                                          for i in validas if i["id_ubicacion"])),
    }


# ----------------------------------------------------------------------------
# ETAPA 8: carga en la nube (CockroachDB + Firestore)
# ----------------------------------------------------------------------------
def cargar_cockroach(salida_dir, usuarios_ok, ubicaciones):
    import psycopg2
    from psycopg2.extras import execute_values
    url = os.environ.get("COCKROACH_DATABASE_URL")
    if not url:
        raise RuntimeError("Falta la variable COCKROACH_DATABASE_URL")
    ddl = (Path(__file__).parent / "schema_cockroachdb.sql").read_text(encoding="utf-8")
    con = psycopg2.connect(url)
    try:
        with con, con.cursor() as cur:       # una sola transaccion: todo o nada
            cur.execute(ddl)
            execute_values(cur, "INSERT INTO ubicaciones (id_ubicacion, ciudad, estado, pais, zona_horaria) "
                                "VALUES %s ON CONFLICT DO NOTHING",
                           [(u["id_ubicacion"], u["ciudad"], u["estado"], u["pais"], u["zona_horaria"])
                            for u in ubicaciones])
            execute_values(cur, "INSERT INTO usuarios (id_usuario, alias, fecha_ingreso, rango_edad, "
                                "especie_fursona, interes_principal, plataforma_principal, es_artista, "
                                "mensajes_30d, reacciones_30d, eventos_asistidos, comisiones_compradas, "
                                "sentimiento_promedio, ultima_actividad, estatus, consentimiento_datos, "
                                "id_ubicacion, latitud, longitud) VALUES %s ON CONFLICT DO NOTHING",
                           [(u["id_usuario"], u["alias"], u["fecha_ingreso"], u["rango_edad"],
                             u["especie_fursona"], u["interes_principal"], u["plataforma_principal"],
                             u["es_artista"], u["mensajes_30d"], u["reacciones_30d"],
                             u["eventos_asistidos"], u["comisiones_compradas"], u["sentimiento_promedio"],
                             u["ultima_actividad"], u["estatus"], u["consentimiento_datos"],
                             u["id_ubicacion"], u["latitud"], u["longitud"]) for u in usuarios_ok])
    finally:
        con.close()


def _doc_interaccion(i):
    return {
        "id_usuario": i["id_usuario"],
        "timestamp": i["fecha_hora"],
        "canal": i["canal"],
        "tipo": i["tipo"],
        "texto": i["texto"],
        "tema": i["tema"],
        "sentimiento": i["sentimiento"],
        "idioma": i["idioma"],
        "dispositivo": i["dispositivo"],
        "longitud_texto": i["longitud_texto"],
        "reacciones_recibidas": i["reacciones_recibidas"],
        "etiquetas": list(i["etiquetas"]),
    }


def cargar_firestore(validas, cuarentena, bitacoras, metricas):
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        raise RuntimeError("Falta la variable GOOGLE_APPLICATION_CREDENTIALS")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.ApplicationDefault())
    db = firestore.client()

    def en_lotes(coleccion, documentos):
        lote, n = db.batch(), 0
        for id_doc, datos in documentos:
            # uso set (no add) para que la carga se pueda repetir sin duplicar
            lote.set(db.collection(coleccion).document(id_doc), datos)
            n += 1
            if n % 400 == 0:
                lote.commit()
                lote = db.batch()
        lote.commit()

    en_lotes("interacciones",
             [(i["id_interaccion"], _doc_interaccion(i)) for i in validas])
    en_lotes("cuarentena_interacciones",
             [(c["id_interaccion"], {k: v for k, v in c.items() if k != "id_interaccion"}) for c in cuarentena])
    en_lotes("bitacora_etl", [(b["id_ejecucion"], {k: v for k, v in b.items() if k != "id_ejecucion"})
                              for b in bitacoras])
    metricas = dict(metricas, actualizado_en=datetime.now(timezone.utc))
    db.collection("metricas_vivas").document("actuales").set(metricas)


def etapa8_cargar(modo, salida, usuarios_ok, ubicaciones, validas, cuarentena, bitacoras, res):
    banner(8, "Carga de los registros validos en la nube")
    if modo == "no":
        log("Modo local: no se cargo nada a la nube (usa --cargar todo para cargar).")
        res["carga"] = "omitida"
        return
    if modo in ("sql", "todo"):
        cargar_cockroach(salida, usuarios_ok, ubicaciones)
        log(f"CockroachDB: {len(usuarios_ok)} usuarios y {len(ubicaciones)} ubicaciones cargados")
    if modo in ("firestore", "todo"):
        cargar_firestore(validas, cuarentena, bitacoras, calcular_metricas(validas, ubicaciones))
        log(f"Firestore: {len(validas)} interacciones, {len(cuarentena)} documentos de cuarentena, "
            f"{len(bitacoras)} de bitacora y metricas_vivas/actuales cargados")
    res["carga"] = modo


# ----------------------------------------------------------------------------
# Verificacion final sobre los archivos depurados
# ----------------------------------------------------------------------------
def verificar_salida(salida, res):
    log("")
    log("-" * 70)
    log("VERIFICACION DE LOS ARCHIVOS DEPURADOS")
    log("-" * 70)
    with open(salida / "usuarios_depurados.csv", encoding="utf-8") as f:
        usuarios = list(csv.DictReader(f))
    with open(salida / "interacciones_depuradas.csv", encoding="utf-8") as f:
        inter = list(csv.DictReader(f))
    ids = {u["id_usuario"] for u in usuarios}
    geo_ilegal = [u for u in usuarios if u["consentimiento_datos"] == "false"
                  and (u["id_ubicacion"] or u["latitud"] or u["longitud"])]
    sin_usuario = [i for i in inter if i["id_usuario"] not in ids]
    react_mal = [i for i in inter if not i["texto"] and i["longitud_texto"] != "0"]
    log(f"usuarios sin consentimiento que conservan datos geograficos : {len(geo_ilegal)}")
    log(f"interacciones cuyo id_usuario no existe en usuarios        : {len(sin_usuario)}")
    log(f"interacciones sin texto con longitud_texto distinta de 0   : {len(react_mal)}")
    res["verificacion"] = {"usuarios_sin_consentimiento_con_geo": len(geo_ilegal),
                           "interacciones_sin_usuario": len(sin_usuario),
                           "reacciones_longitud_inconsistente": len(react_mal)}
    return not (geo_ilegal or sin_usuario or react_mal)


# ----------------------------------------------------------------------------
# Programa principal
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="ETL de Community 360 (Fase 2)")
    ap.add_argument("--usuarios", required=True)
    ap.add_argument("--interacciones", required=True)
    ap.add_argument("--salida", default="salida")
    ap.add_argument("--cargar", choices=["no", "sql", "firestore", "todo"], default="no")
    args = ap.parse_args()
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    ahora = datetime.now(timezone.utc).replace(microsecond=0)
    sello = ahora.strftime("%Y%m%d_%H%M%S")
    salida = Path(args.salida)
    res = {"fecha_ejecucion": ahora.isoformat(), "usuarios": {}, "interacciones": {}}

    log(f"ETL Community 360 - ejecucion {sello}")
    usuarios, cols_u = leer_csv(args.usuarios)
    interacciones, cols_i = leer_csv(args.interacciones)
    res["usuarios"]["recibidos"] = len(usuarios)
    res["interacciones"]["recibidos"] = len(interacciones)
    log(f"Leidos: {len(usuarios)} usuarios ({len(cols_u)} columnas) y "
        f"{len(interacciones)} interacciones ({len(cols_i)} columnas)")

    usuarios, interacciones = etapa1_duplicados(usuarios, interacciones, res)
    etapa2_nulos(usuarios, interacciones, res)
    etapa3_estandarizar(usuarios, interacciones, res)
    u_ok, u_mal, i_ok, i_mal = etapa4_validar(usuarios, interacciones, res)
    validas, huerfanas = etapa5_referencias(u_ok, i_ok, res)
    ubicaciones = etapa6_privacidad(u_ok, validas, huerfanas, res)

    id_u, id_i = f"etl_{sello}_usuarios", f"etl_{sello}_interacciones"
    cuarentena = construir_cuarentena(huerfanas, i_mal, id_i, ahora)
    etapa7_exportar(salida, u_ok, ubicaciones, validas, cuarentena, u_mal, res)

    def bitacora(id_ej, archivo, nombre, aceptados, rechazados):
        r = res[nombre]
        transformados = sum(1 for x in (u_ok if nombre == "usuarios" else validas) if x["_cambios"])
        return {"id_ejecucion": id_ej, "fecha_ejecucion": ahora, "archivo_origen": archivo,
                "recibidos": r["recibidos"], "aceptados": aceptados, "transformados": transformados,
                "rechazados": rechazados, "duplicados": r["duplicados_total"],
                "ubicaciones_eliminadas": r.get("geo_eliminada", 0)}
    bitacoras = [bitacora(id_u, Path(args.usuarios).name, "usuarios", len(u_ok), len(u_mal)),
                 bitacora(id_i, Path(args.interacciones).name, "interacciones", len(validas), len(cuarentena))]
    res["usuarios"]["aceptados"] = len(u_ok)
    res["usuarios"]["rechazados"] = len(u_mal)
    res["interacciones"]["aceptadas"] = len(validas)
    res["interacciones"]["cuarentena"] = len(cuarentena)
    res["bitacora"] = [dict(b, fecha_ejecucion=b["fecha_ejecucion"].isoformat()) for b in bitacoras]
    res["metricas_iniciales"] = calcular_metricas(validas, ubicaciones)

    etapa8_cargar(args.cargar, salida, u_ok, ubicaciones, validas, cuarentena, bitacoras, res)
    correcto = verificar_salida(salida, res)

    with open(salida / "bitacora_etl.json", "w", encoding="utf-8") as f:
        json.dump(res["bitacora"], f, ensure_ascii=False, indent=2)
    with open(salida / "resumen_calidad.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2, default=str)
    log("")
    log("RESULTADO: " + ("PROCESO TERMINADO SIN ERRORES" if correcto else "HAY INCONSISTENCIAS, REVISAR"))
    (salida / "ejecucion.log").write_text("\n".join(LOG), encoding="utf-8")
    return 0 if correcto else 1


if __name__ == "__main__":
    sys.exit(main())
