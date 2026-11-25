/**
 * Script de aprovisionamiento para la Fase 3:
 * 1) Crea o actualiza los usuarios autorizados en Firebase Authentication (con hash scrypt seguro de Firebase).
 *    Incluye obligatoriamente el usuario docente solicitado en los lineamientos de entrega:
 *      - Usuario: lizandro.reyes
 *      - Correo: lizandro.reyes@utmetropolitana.edu.mx
 *      - Contrasena: lizandr0_reye$
 * 2) Crea o actualiza sus documentos en Firestore dentro de la coleccion "administradores"
 *    con ID del documento = uid de Firebase Auth y los campos:
 *    - email
 *    - usuario
 *    - rol ("admin" | "lector")
 *    - creado_en
 *    - ultimo_acceso
 */
require("dotenv").config();
const { admin, auth, firestore } = require("../src/config/db");

async function asegurarAdministrador(email, password, rol = "admin", username = null) {
  if (!["admin", "lector"].includes(rol)) {
    throw new Error("El rol debe ser 'admin' o 'lector'");
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    userRecord = await auth.updateUser(userRecord.uid, {
      password,
      displayName: username || email.split("@")[0],
      emailVerified: true,
      disabled: false,
    });
    console.log(`Usuario actualizado en Firebase Auth: ${userRecord.email} (uid: ${userRecord.uid})`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: username || email.split("@")[0],
        emailVerified: true,
        disabled: false,
      });
      console.log(`Usuario creado en Firebase Auth: ${userRecord.email} (uid: ${userRecord.uid})`);
    } else {
      throw err;
    }
  }

  const ref = firestore.collection("administradores").doc(userRecord.uid);
  const snap = await ref.get();
  const ahora = admin.firestore.FieldValue.serverTimestamp();

  const documento = {
    email: userRecord.email,
    rol,
    creado_en: snap.exists && snap.data().creado_en ? snap.data().creado_en : ahora,
    ultimo_acceso: snap.exists && snap.data().ultimo_acceso ? snap.data().ultimo_acceso : ahora,
  };

  await ref.set(documento, { merge: true });
  console.log(`Documento guardado en Firestore -> administradores/${userRecord.uid} (rol: ${rol})`);
  return userRecord;
}

async function main() {
  const emailArg = process.argv[2];
  const passArg = process.argv[3];
  const rolArg = process.argv[4] || "admin";

  if (emailArg && passArg) {
    await asegurarAdministrador(emailArg, passArg, rolArg);
  } else {
    // 1) Usuario docente obligatorio segun lineamientos de entrega
    await asegurarAdministrador(
      "lizandro.reyes@utmetropolitana.edu.mx",
      "lizandr0_reye$",
      "admin",
      "lizandro.reyes"
    );

    // 2) Usuarios adicionales del proyecto (admin y lector)
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@community360.mx";
    const adminPass = process.env.DEFAULT_ADMIN_PASSWORD || "Community360!Admin";
    const lectorEmail = process.env.DEFAULT_LECTOR_EMAIL || "lector@community360.mx";
    const lectorPass = process.env.DEFAULT_LECTOR_PASSWORD || "Community360!Lector";

    await asegurarAdministrador(adminEmail, adminPass, "admin", "admin");
    await asegurarAdministrador(lectorEmail, lectorPass, "lector", "lector");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Error al aprovisionar administradores:", err.message);
  process.exit(1);
});
