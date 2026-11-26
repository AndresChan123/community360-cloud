/**
 * Efectos visuales interactivos de Community 360:
 * 1) Cambio entre Modo Claro y Modo Oscuro (persistente en localStorage y sincronizado con Chart.js)
 * 2) Fondo animado de constelaciones que se conectan entre si y con el cursor del usuario
 * 3) Efecto 3D de inclinacion (giro) y avance hacia adelante en tarjetas, graficas, tablas y botones
 */
(function () {
  const THEME_KEY = "c360_theme";

  function obtenerTemaInicial() {
    return localStorage.getItem(THEME_KEY) || "dark";
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem(THEME_KEY, tema);

    const iconSun = document.getElementById("theme-icon-sun");
    const iconMoon = document.getElementById("theme-icon-moon");
    const themeLabel = document.getElementById("theme-toggle-label");

    if (iconSun && iconMoon) {
      iconSun.style.display = tema === "dark" ? "inline-block" : "none";
      iconMoon.style.display = tema === "light" ? "inline-block" : "none";
    }
    if (themeLabel) {
      themeLabel.textContent = tema === "dark" ? "Modo claro" : "Modo oscuro";
    }

    window.dispatchEvent(new CustomEvent("c360:theme-changed", { detail: { tema } }));
  }

  // Aplicar tema de inmediato para evitar parpadeo
  aplicarTema(obtenerTemaInicial());

  document.addEventListener("DOMContentLoaded", () => {
    aplicarTema(obtenerTemaInicial());

    // 1) Boton de cambio de tema
    const btnTheme = document.getElementById("btn-theme-toggle");
    if (btnTheme) {
      btnTheme.addEventListener("click", () => {
        const actual = document.documentElement.getAttribute("data-theme") || "dark";
        aplicarTema(actual === "dark" ? "light" : "dark");
      });
    }

    // 2) Canvas interactivo de constelaciones en el fondo
    iniciarConstelaciones();

    // 3) Efecto 3D de giro e impulso hacia adelante en tarjetas, graficas y tablas
    iniciarEfecto3DTilt();
  });

  function iniciarConstelaciones() {
    let canvas = document.getElementById("constellation-bg");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "constellation-bg";
      document.body.prepend(canvas);
    }

    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mouse = { x: null, y: null, radius: 175 };

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener("mouseout", () => {
      mouse.x = null;
      mouse.y = null;
    });

    const numParticulas = Math.min(Math.floor((width * height) / 14000), 95);
    const particulas = [];

    for (let i = 0; i < numParticulas; i++) {
      particulas.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.75,
        vy: (Math.random() - 0.5) * 0.75,
        size: Math.random() * 2 + 1.3,
      });
    }

    function animar() {
      ctx.clearRect(0, 0, width, height);
      const esOscuro = document.documentElement.getAttribute("data-theme") === "dark";
      const rgbNodo = esOscuro ? "99, 140, 255" : "36, 87, 197";
      const rgbCursor = esOscuro ? "52, 211, 153" : "36, 87, 197";

      for (let i = 0; i < particulas.length; i++) {
        const p = particulas[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Dibujar estrella/nodo de la constelacion
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbNodo}, ${esOscuro ? 0.65 : 0.45})`;
        ctx.fill();

        // Conectar con el cursor cuando se acerca
        if (mouse.x !== null && mouse.y !== null) {
          const dxMouse = mouse.x - p.x;
          const dyMouse = mouse.y - p.y;
          const distMouse = Math.hypot(dxMouse, dyMouse);

          if (distMouse < mouse.radius) {
            const alpha = (1 - distMouse / mouse.radius) * (esOscuro ? 0.75 : 0.55);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(${rgbCursor}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1.25;
            ctx.stroke();

            // Ligera atraccion magnetica hacia el cursor
            p.x += dxMouse * 0.008;
            p.y += dyMouse * 0.008;
          }
        }

        // Conectar nodos cercanos entre si
        for (let j = i + 1; j < particulas.length; j++) {
          const p2 = particulas[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * (esOscuro ? 0.26 : 0.18);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${rgbNodo}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }
      }

      // Dibujar nodo luminoso en la posicion del cursor
      if (mouse.x !== null && mouse.y !== null) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbCursor}, 0.85)`;
        ctx.fill();
      }

      requestAnimationFrame(animar);
    }

    animar();
  }

  function iniciarEfecto3DTilt() {
    const selectores = ".metric-card, .panel-card, .hero-mini-card, .login-card";

    function vincularTarjetas() {
      document.querySelectorAll(selectores).forEach((card) => {
        if (card.dataset.tiltBound === "true") return;
        card.dataset.tiltBound = "true";

        card.addEventListener("mousemove", (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          // Limitar angulo maximo segun el tamano de la tarjeta (mas pronunciado en KPIs, suave en tablas grandes)
          const maxAngle = rect.width > 650 ? 4.5 : 10;
          const rotateX = (((centerY - y) / centerY) * maxAngle).toFixed(2);
          const rotateY = (((x - centerX) / centerX) * maxAngle).toFixed(2);

          card.style.transform = `perspective(1100px) translate3d(0, -8px, 26px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.022)`;
          card.style.setProperty("--mouse-x", `${x}px`);
          card.style.setProperty("--mouse-y", `${y}px`);
        });

        card.addEventListener("mouseleave", () => {
          card.style.transform =
            "perspective(1100px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)";
        });
      });
    }

    vincularTarjetas();
  }
})();
