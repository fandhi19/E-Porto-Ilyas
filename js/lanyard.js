/**
 * Interactive Lanyard Physics Engine (Full Synchronized Elastic Bounce Edition)
 * Ensures ALL components (Upper Strap, Buckle, Lower Strap, Hook Assembly, and ID Badge)
 * stretch, move downward together, and bounce back synchronously when released.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", initLanyard);

  function initLanyard() {
    const scene = document.getElementById("lanyard-scene");
    const rig = document.getElementById("lanyard-rig");
    const upperStrap = document.querySelector(".upper-strap");
    const buckle = document.querySelector(".lanyard-buckle");
    const lowerStrap = document.querySelector(".lower-strap");
    const hookAssembly = document.querySelector(".lanyard-hook-assembly");
    const badge = document.getElementById("lanyard-badge");
    const hint = document.querySelector(".lanyard-hint");
    const shine = document.querySelector(".badge-shine-overlay");
    const shadow = document.querySelector(".badge-shadow");

    if (!scene || !rig || !badge) return;

    // ==========================================
    // PHYSICS PARAMETERS
    // ==========================================
    // 1. Horizontal Pendulum Physics
    let angle = 0;              // + is RIGHT, - is LEFT
    let angleVelocity = 0;      // Angular velocity
    let angleAccel = 0;         // Angular acceleration
    const gravity = 0.0038;     // Gravity restoring force
    const damping = 0.968;      // Air resistance damping

    // 2. Vertical Elastic Spring Physics (Semua Komponen Melar & Memantul)
    let stretchY = 0;           // Elongasi pertambahan panjang dalam px
    let stretchVelocity = 0;    // Kecepatan vertikal pegas
    const springK = 0.082;      // Konstanta kekakuan pegas elastis
    const springDamping = 0.892; // Faktor redaman kenyal (memantul 4-6 kali)

    // 3. 3D Card Tilt
    let tiltX = 0;
    let tiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;

    // Interaction states
    let isDragging = false;
    let hasInteracted = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartAngle = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let lastTime = 0;

    // Base dimensions for straps
    let baseUpperHeight = 250;
    let baseLowerHeight = 82;

    function updateBaseDimensions() {
      if (upperStrap && lowerStrap) {
        baseUpperHeight = upperStrap.offsetHeight || 250;
        baseLowerHeight = lowerStrap.offsetHeight || 82;
      }
    }
    updateBaseDimensions();
    window.addEventListener("resize", updateBaseDimensions);

    // ==========================================
    // CLICK & DRAG HANDLERS
    // ==========================================
    function startDrag(clientX, clientY) {
      isDragging = true;
      hideHint();

      dragStartX = clientX;
      dragStartY = clientY;
      dragStartAngle = angle;
      lastClientX = clientX;
      lastClientY = clientY;
      lastTime = performance.now();

      angleVelocity = 0;
      stretchVelocity = 0;

      badge.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    }

    function moveDrag(clientX, clientY) {
      if (!isDragging) return;

      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const instantVelocityX = (clientX - lastClientX) / dt;
      const instantVelocityY = (clientY - lastClientY) / dt;

      lastClientX = clientX;
      lastClientY = clientY;
      lastTime = now;

      // 1. AYUNAN HORIZONTAL (Kanan -> Kanan, Kiri -> Kiri)
      const deltaX = clientX - dragStartX;
      const maxAngle = (50 * Math.PI) / 180;
      const calculatedAngle = dragStartAngle + (deltaX / 280);
      angle = Math.max(-maxAngle, Math.min(maxAngle, calculatedAngle));
      angleVelocity = Math.max(-0.05, Math.min(0.05, instantVelocityX * 0.006));

      // 2. ELASTISITAS VERTIKAL (SEMUA KOMPONEN IKUT TERTARIK KE BAWAH)
      const deltaY = clientY - dragStartY;
      if (deltaY >= 0) {
        // Melar ke bawah dengan kurva resistansi karet elastis (maks ~220px)
        stretchY = 220 * (1 - Math.exp(-deltaY / 180));
      } else {
        // Sedikit kompresi jika ditarik ke atas (maks -25px)
        stretchY = -25 * (1 - Math.exp(deltaY / 35));
      }

      // Momentum kecepatan vertikal untuk hentakan memantul saat dilepas
      stretchVelocity = Math.max(-25, Math.min(30, instantVelocityY * 14));

      // 3. 3D CARD TILT
      targetTiltY = (angle * 180) / Math.PI * 0.35;
      targetTiltX = Math.min(22, Math.max(-22, deltaY * 0.06));

      // 4. SHIMMER REFLECTION
      if (shine) {
        const normX = deltaX / 120;
        const shinePos = (normX + 1) * 50;
        shine.style.transform = `translateX(${shinePos - 50}%)`;
        shine.style.opacity = Math.max(0.1, Math.min(0.65, 0.2 + Math.abs(normX) * 0.35));
      }
    }

    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      badge.style.cursor = "grab";
      document.body.style.userSelect = "";

      targetTiltX = 0;
      targetTiltY = 0;

      if (shine) {
        shine.style.opacity = "0";
      }
    }

    function hideHint() {
      if (!hasInteracted) {
        hasInteracted = true;
        if (hint) hint.classList.add("hidden");
      }
    }

    // Mouse Events
    badge.addEventListener("mousedown", function (e) {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    });

    window.addEventListener("mousemove", function (e) {
      if (isDragging) {
        moveDrag(e.clientX, e.clientY);
      }
    });

    window.addEventListener("mouseup", endDrag);

    // Touch Events untuk Mobile
    badge.addEventListener("touchstart", function (e) {
      if (e.touches && e.touches.length > 0) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener("touchmove", function (e) {
      if (isDragging && e.touches && e.touches.length > 0) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener("touchend", endDrag);

    // ==========================================
    // REAL-TIME PHYSICS SIMULATION LOOP (60 FPS)
    // ==========================================
    function animate() {
      if (!isDragging) {
        // --- A. FISIKA AYUNAN BANDUL HORIZONTAL ---
        angleAccel = -gravity * Math.sin(angle);
        angleVelocity += angleAccel;
        angleVelocity *= damping;
        angle += angleVelocity;

        if (Math.abs(angle) < 0.0005 && Math.abs(angleVelocity) < 0.0003) {
          angle = 0;
          angleVelocity = 0;
          angleAccel = 0;
        }

        // --- B. FISIKA PEGAS MEMANTUL VERTIKAL (HOOKES LAW) ---
        const springForce = -springK * stretchY;
        stretchVelocity += springForce;
        stretchVelocity *= springDamping;
        stretchY += stretchVelocity;

        if (Math.abs(stretchY) < 0.25 && Math.abs(stretchVelocity) < 0.15) {
          stretchY = 0;
          stretchVelocity = 0;
        }

        targetTiltX = 0;
        targetTiltY = 0;
      }

      // Smooth interpolation for 3D tilt
      tiltX += (targetTiltX - tiltX) * 0.15;
      tiltY += (targetTiltY - tiltY) * 0.15;

      if (Math.abs(tiltX) < 0.03) tiltX = 0;
      if (Math.abs(tiltY) < 0.03) tiltY = 0;

      // Konversi radian ke derajat
      const deg = (angle * 180) / Math.PI;

      // Rotasi Rig Lanyard Utama (arah searah kursor: -deg)
      const cssRigAngle = -deg;
      rig.style.transform = `rotate(${cssRigAngle}deg)`;

      // ========================================================
      // ELASTISITAS SINKRON SEMUA KOMPONEN (TALI, BUCKLE, HOOK, BADGE)
      // ========================================================
      const halfStretch = stretchY * 0.5;
      const pinch = Math.max(0.85, 1 - (stretchY * 0.0007));

      // 1. Tali Atas: memanjang dari titik atas (0) ke posisi buckle
      if (upperStrap) {
        upperStrap.style.transformOrigin = "50% 0px";
        const scaleUpperY = Math.max(0.2, 1 + (halfStretch / baseUpperHeight));
        upperStrap.style.transform = `scaleY(${scaleUpperY}) scaleX(${pinch})`;
      }

      // 2. Buckle: turun sejauh halfStretch (menempel di ujung tali atas)
      if (buckle) {
        buckle.style.transform = `translateY(${halfStretch}px)`;
      }

      // 3. Tali Bawah: turun sejauh halfStretch dan memanjang lagi sejauh halfStretch
      if (lowerStrap) {
        lowerStrap.style.transformOrigin = "50% 0px";
        const scaleLowerY = Math.max(0.2, 1 + (halfStretch / baseLowerHeight));
        lowerStrap.style.transform = `translateY(${halfStretch}px) scaleY(${scaleLowerY}) scaleX(${pinch})`;
      }

      // 4. Hook Assembly: turun sejauh stretchY PENUH (menempel di ujung tali bawah)
      if (hookAssembly) {
        hookAssembly.style.transform = `translateY(${stretchY}px)`;
      }

      // 5. Kartu ID Badge: turun sejauh stretchY PENUH (ikut ditarik kursor & memantul)
      const bounceTiltX = tiltX + (stretchY * 0.06);
      const hookCounterBalance = -deg * 0.35;
      badge.style.transform = `translateY(${stretchY}px) rotateY(${tiltY}deg) rotateX(${bounceTiltX}deg) rotateZ(${hookCounterBalance}deg) translateZ(${isDragging ? 22 : 0}px)`;

      // 6. Bayangan Realistis (Shadow) turun & memantul mengikuti posisi kartu
      if (shadow) {
        const shadowOffset = deg * 2.2;
        const shadowY = Math.abs(deg) * 0.8 + 20 + (stretchY * 0.4);
        shadow.style.transform = `translate3d(${shadowOffset}px, ${shadowY}px, -40px) scale(${1 - Math.abs(deg) * 0.003 - stretchY * 0.0006})`;
        shadow.style.opacity = Math.max(0.2, 0.7 - Math.abs(deg) * 0.008 - stretchY * 0.001);
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }
})();
