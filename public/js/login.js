document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const btnTogglePass = document.getElementById("btn-toggle-pass");
  const eyeOpen = document.getElementById("eye-open");
  const eyeClosed = document.getElementById("eye-closed");
  const btnSubmit = document.getElementById("btn-submit");
  const btnSpinner = document.getElementById("btn-spinner");
  const btnText = document.getElementById("btn-text");
  const alertBox = document.getElementById("alert-box");

  function mostrarAlerta(mensaje, tipo = "error") {
    alertBox.textContent = mensaje;
    alertBox.className = `alert-box ${tipo}`;
  }

  function setCargando(activo) {
    btnSubmit.disabled = activo;
    if (btnSpinner) btnSpinner.style.display = activo ? "inline-block" : "none";
    if (btnText) btnText.textContent = activo ? "Verificando credenciales..." : "Acceder al panel";
  }

  if (btnTogglePass) {
    btnTogglePass.addEventListener("click", () => {
      const esPassword = passwordInput.type === "password";
      passwordInput.type = esPassword ? "text" : "password";
      if (eyeOpen && eyeClosed) {
        eyeOpen.style.display = esPassword ? "none" : "block";
        eyeClosed.style.display = esPassword ? "block" : "none";
      }
      passwordInput.focus();
    });
  }

  const tokenExistente = sessionStorage.getItem("c360_id_token");
  if (tokenExistente) {
    fetch("/api/auth/sesion", {
      headers: { Authorization: `Bearer ${tokenExistente}` },
    })
      .then((r) => {
        if (r.ok) window.location.replace("/dashboard");
      })
      .catch(() => {});
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.className = "alert-box";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      mostrarAlerta("Ingresa tu usuario o correo electrónico y tu contraseña.");
      return;
    }

    setCargando(true);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        mostrarAlerta(data.error || "No fue posible iniciar sesión. Verifica tus datos.");
        setCargando(false);
        return;
      }

      sessionStorage.setItem("c360_id_token", data.token);
      sessionStorage.setItem("c360_usuario", JSON.stringify(data.usuario));

      mostrarAlerta("Acceso verificado. Entrando al panel...", "success");
      window.location.replace("/dashboard");
    } catch (_err) {
      mostrarAlerta("No se pudo conectar con el servidor. Intenta de nuevo.");
      setCargando(false);
    }
  });
});
