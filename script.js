/* ==========================================
   Eric Anthony — Personal Website
   Main JavaScript

   Systems overview:
   - Boot flags + graceful fallbacks (no-GSAP, reduced motion)
   - Preloader → orchestrated hero intro (GSAP SplitText)
   - WebGL aurora shader + interactive 2D node-mesh (hero)
   - Custom cursor, magnetic elements, tilt + spotlight cards
   - Scroll choreography per section (ScrollTrigger)
   - Experience timeline progress line + traveling packet
   - Nav (scroll state, scroll-spy, magic line, mobile drawer)
   - Counters, typed roles, dynamic years
   - Contact form (Web3Forms + mailto fallback) + packet burst
   - PWA service worker
   ========================================== */

(() => {
    'use strict';

    window.__eaBooted = true;

    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const HAS_GSAP = typeof window.gsap !== 'undefined';

    const ACCENT_PRIMARY = '#6c5ce7';
    const ACCENT_SECONDARY = '#a29bfe';
    const ACCENT_BLUE = '#74b9ff';

    /* Anchor/back-to-top scrolls set this so the snap assist never hijacks
       them; it auto-clears shortly after scrolling goes quiet */
    let programmaticScroll = false;
    function markProgrammaticScroll() {
        programmaticScroll = true;
    }

    /* Run an init system in isolation so one failure never blanks the page */
    function safeInit(name, fn) {
        try {
            fn();
        } catch (err) {
            console.warn(`[init:${name}]`, err);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        safeInit('years', setDynamicYears);
        safeInit('nav', initNavigation);
        safeInit('form', initContactForm);
        safeInit('experienceToggle', initExperienceToggle);
        safeInit('sw', registerServiceWorker);

        if (!HAS_GSAP) {
            // Vendor scripts failed: reveal everything via the CSS fallback path
            const pre = document.getElementById('preloader');
            if (pre) pre.remove();
            safeInit('fallbackReveal', fallbackReveal);
            safeInit('countersFallback', () => initCounters(null));
            safeInit('anchors', () => initSmoothAnchors());
            return;
        }

        gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

        if (REDUCED) {
            // CSS already forces content visible; finish states instantly
            const pre = document.getElementById('preloader');
            if (pre) pre.remove();
            safeInit('countersReduced', setCountersInstant);
            safeInit('anchors', () => initSmoothAnchors());
            return;
        }

        safeInit('anchors', () => initSmoothAnchors());
        safeInit('cursor', initCursor);
        safeInit('cursorTrail', initCursorTrail);
        safeInit('magnetic', initMagnetic);
        safeInit('aurora', initHeroAurora);
        safeInit('mesh', initHeroMesh);
        safeInit('heroAmbient', initHeroAmbient);
        safeInit('tilt', initTiltSpotlight);
        safeInit('magicLine', initMagicLine);
        safeInit('progressBar', initScrollProgressBar);
        safeInit('counters', () => initCounters(gsap));
        safeInit('typed', initTypedEffect);
        safeInit('rollingLinks', initRollingLinks);
        safeInit('energyBorders', initEnergyBorders);
        safeInit('gyro', initGyroParallax);
        safeInit('backToTop', initBackToTop);
        safeInit('overloadEgg', initOverloadEasterEgg);

        // Text splitting waits for webfonts (capped) so line/char metrics are final
        const fontsReady = Promise.race([
            document.fonts ? document.fonts.ready : Promise.resolve(),
            new Promise((r) => setTimeout(r, 800))
        ]);
        const preloaderDone = new Promise((resolve) => safeInit('preloader', () => runPreloader(resolve)));

        Promise.all([fontsReady, preloaderDone]).then(() => {
            safeInit('heroIntro', runHeroIntro);
            safeInit('sectionHeaders', initSectionHeaderReveals);
            safeInit('titleParallax', initTitleParallax);
            safeInit('aboutScrub', initAboutScrub);
            safeInit('skillsReveal', initSkillsReveal);
            safeInit('experienceReveal', initExperienceReveal);
            safeInit('portfolioReveal', initPortfolioReveal);
            safeInit('educationReveal', initEducationReveal);
            safeInit('contactReveal', initContactReveal);
            safeInit('catchAllReveal', initCatchAllReveal);
            ScrollTrigger.refresh();
            safeInit('midPageRestore', restoreMidPageLoad);
        });
    });

    /* ==========================================
       MID-PAGE LOAD RESTORE
       On refresh / #hash loads the browser restores scroll before our
       triggers exist. ScrollTrigger baselines triggers born past their
       start without firing them, which would leave everything at or above
       the restored viewport invisible — fast-forward them here.
       ========================================== */
    function restoreMidPageLoad() {
        if (window.scrollY < 10) return;

        ScrollTrigger.getAll().forEach((st) => {
            if (!st.animation || st.vars.scrub) return;
            if (st.progress >= 1) st.animation.progress(1);
            else if (st.progress > 0 && st.animation.paused()) st.animation.play();
        });

        // Batch/callback-based reveals aren't animation-linked — anything
        // still hidden in or above the viewport gets a quick reveal
        const vh = window.innerHeight;
        document.querySelectorAll('.animate-in').forEach((el) => {
            if (el.getBoundingClientRect().top < vh && getComputedStyle(el).opacity === '0') {
                gsap.to(el, {
                    autoAlpha: 1,
                    y: 0,
                    x: 0,
                    scale: 1,
                    duration: 0.6,
                    ease: 'power3.out',
                    overwrite: 'auto'
                });
            }
        });
    }

    /* ==========================================
       FALLBACKS
       ========================================== */
    function fallbackReveal() {
        const els = document.querySelectorAll('.animate-in');
        if (!('IntersectionObserver' in window)) {
            els.forEach((el) => el.classList.add('visible'));
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
        els.forEach((el) => observer.observe(el));
    }

    /* ==========================================
       DYNAMIC YEARS
       ========================================== */
    function yearsOfExperience() {
        return new Date().getFullYear() - 2019;
    }

    function setDynamicYears() {
        document.querySelectorAll('.dynamic-years').forEach((el) => {
            el.textContent = yearsOfExperience();
        });
    }

    /* ==========================================
       PRELOADER
       ========================================== */
    function runPreloader(onDone) {
        const pre = document.getElementById('preloader');
        if (!pre) return onDone();

        let repeatVisit = false;
        try {
            repeatVisit = !!sessionStorage.getItem('ea-visited');
            sessionStorage.setItem('ea-visited', '1');
        } catch (e) { /* storage blocked — treat as first visit */ }

        if (repeatVisit) {
            pre.remove();
            return onDone();
        }

        const bar = document.getElementById('preloaderBar');
        const percent = document.getElementById('preloaderPercent');
        const counter = { value: 0 };

        gsap.timeline({ onComplete: () => { pre.remove(); onDone(); } })
            .from('.preloader__logo', { autoAlpha: 0, y: 14, duration: 0.3, ease: 'power2.out' })
            .to(counter, {
                value: 100,
                duration: 0.7,
                ease: 'power2.inOut',
                onUpdate: () => {
                    const v = Math.round(counter.value);
                    percent.textContent = `${v}%`;
                    bar.style.transform = `scaleX(${v / 100})`;
                }
            }, 0.05)
            .to('.preloader__content', { autoAlpha: 0, y: -18, duration: 0.25, ease: 'power2.in' }, '+=0.05')
            .to(pre, { yPercent: -100, duration: 0.6, ease: 'power4.inOut' }, '-=0.1');
    }

    /* ==========================================
       HERO INTRO TIMELINE
       ========================================== */
    function runHeroIntro() {
        const titleLine = document.querySelector('.hero__title-line:not(.hero__title-line--sub)');
        const subLine = document.querySelector('.hero__title-line--sub');
        const heroEls = {
            badge: '.hero__badge',
            title: '.hero__title',
            desc: '.hero__description',
            actions: '.hero__actions',
            stats: '.hero__stats',
            lottie: '.hero__lottie'
        };

        document.querySelectorAll('.hero .animate-in').forEach((el) => { el.dataset.revealed = '1'; });

        let chars = null;
        try {
            const split = SplitText.create(titleLine, { type: 'chars,words', mask: 'chars', charsClass: 'hero-char' });
            chars = split.chars;
            preserveNameGradient();
        } catch (e) {
            chars = null; // font quirk — animate the whole line instead
        }

        // Pre-set every start state so nothing flashes before its tween begins
        gsap.set([heroEls.badge, heroEls.desc, heroEls.actions, heroEls.stats, heroEls.lottie], { autoAlpha: 0 });
        if (chars && chars.length) gsap.set(chars, { yPercent: 120 });
        gsap.set(subLine, { autoAlpha: 0, y: 28 });
        gsap.set('.hero__stat', { autoAlpha: 0, y: 14 });
        gsap.set('.hero__scroll', { autoAlpha: 0 });

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        tl.to(heroEls.badge, { autoAlpha: 1, y: 0, duration: 0.6, startAt: { y: 24 } })
            .set(heroEls.title, { autoAlpha: 1 }, 0.15);

        if (chars && chars.length) {
            tl.to(chars, {
                yPercent: 0,
                duration: 0.9,
                ease: 'power4.out',
                stagger: { each: 0.022, from: 'start' }
            }, 0.2);
        } else {
            tl.to(titleLine, { autoAlpha: 1, y: 0, duration: 0.8, startAt: { autoAlpha: 0, y: 40 } }, 0.2);
        }

        tl.to(subLine, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.55)
            .to(heroEls.desc, { autoAlpha: 1, y: 0, duration: 0.7, startAt: { y: 26 } }, 0.75)
            .to(heroEls.actions, { autoAlpha: 1, y: 0, duration: 0.6, startAt: { y: 22 } }, 0.9)
            .to(heroEls.stats, { autoAlpha: 1, y: 0, duration: 0.6, startAt: { y: 22 } }, 1.0)
            .to(heroEls.lottie, { autoAlpha: 1, scale: 1, duration: 0.8, startAt: { scale: 0.85 }, ease: 'back.out(1.4)' }, 0.65)
            .to('.hero__stat', { y: 0, autoAlpha: 1, stagger: 0.1, duration: 0.5 }, 1.05)
            .to('.hero__scroll', { autoAlpha: 1, duration: 0.6 }, 1.3)
            .eventCallback('onComplete', () => safeInit('titleRipple', () => enableTitleRipple(titleLine, chars)));
    }

    /* Hovering the hero title lifts characters in a cursor-following wave */
    function enableTitleRipple(titleLine, chars) {
        if (!FINE_POINTER || !chars || !chars.length) return;

        // SplitText's char masks clip vertical movement — release them now
        // that the masked intro reveal is done
        chars.forEach((c) => {
            if (c.parentNode && c.parentNode !== titleLine) c.parentNode.style.overflow = 'visible';
        });

        const lifts = chars.map((c) => gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power2.out' }));
        let centers = [];
        const measure = () => {
            centers = chars.map((c) => {
                const r = c.getBoundingClientRect();
                return r.left + r.width / 2;
            });
        };
        measure();
        window.addEventListener('resize', measure);

        titleLine.addEventListener('pointermove', (e) => {
            for (let i = 0; i < chars.length; i++) {
                const d = e.clientX - centers[i];
                const f = Math.exp(-(d * d) / 9800); // gaussian falloff, σ ≈ 70px
                lifts[i](-16 * f);
                // proximity glow shows through the transparent clipped glyphs
                chars[i].style.textShadow = f > 0.05
                    ? `0 ${(4 * f).toFixed(1)}px ${(6 + f * 16).toFixed(1)}px rgba(162, 155, 254, ${(f * 0.6).toFixed(3)})`
                    : '';
            }
        });
        titleLine.addEventListener('pointerleave', () => {
            for (let i = 0; i < chars.length; i++) {
                lifts[i](0);
                chars[i].style.textShadow = '';
            }
        });
    }

    /* The name uses background-clip:text; after a char split each char needs
       its own slice of the same gradient or the text turns invisible */
    function preserveNameGradient() {
        const name = document.querySelector('.hero__name');
        if (!name) return;
        const width = Math.max(name.offsetWidth, 1);
        const gradient = `linear-gradient(135deg, ${ACCENT_PRIMARY} 0%, ${ACCENT_SECONDARY} 50%, ${ACCENT_BLUE} 100%)`;
        name.querySelectorAll('.hero-char').forEach((piece) => {
            const s = piece.style;
            s.backgroundImage = gradient;
            s.backgroundSize = `${width}px 100%`;
            s.backgroundPosition = `${-(piece.offsetLeft - name.offsetLeft)}px 0`;
            s.webkitBackgroundClip = 'text';
            s.backgroundClip = 'text';
            s.webkitTextFillColor = 'transparent';
        });
    }

    /* ==========================================
       SMOOTH ANCHOR SCROLLING (native)
       scrollIntoView honors each section's scroll-margin-top, so anchor
       jumps land exactly on the CSS scroll-snap positions
       ========================================== */
    function initSmoothAnchors() {
        document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
            anchor.addEventListener('click', (e) => {
                const target = document.querySelector(anchor.getAttribute('href'));
                if (!target) return;
                e.preventDefault();
                markProgrammaticScroll();
                target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
            });
        });
    }

    /* ==========================================
       WEBGL AURORA (hero background shader)
       ========================================== */
    function initHeroAurora() {
        const canvas = document.getElementById('heroGL');
        const hero = document.querySelector('.hero');
        if (!canvas || !hero) return;

        const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false });
        if (!gl) return; // no WebGL — CSS orbs remain the background

        const VERT = `
            attribute vec2 aPos;
            void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
        `;
        // Simplex noise: Ian McEwan / Ashima Arts (MIT), standard 2D implementation
        const FRAG = `
            precision mediump float;
            uniform vec2 uRes;
            uniform float uTime;
            uniform vec2 uMouse;

            vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
            vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
            vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
            float snoise(vec2 v){
                const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                vec2 i = floor(v + dot(v, C.yy));
                vec2 x0 = v - i + dot(i, C.xx);
                vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod289(i);
                vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m; m = m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
                vec3 g;
                g.x = a0.x * x0.x + h.x * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
            }
            float fbm(vec2 p){
                float v = 0.0;
                float a = 0.55;
                for (int i = 0; i < 4; i++) {
                    v += a * snoise(p);
                    p = p * 2.05 + 17.0;
                    a *= 0.5;
                }
                return v * 0.5 + 0.5;
            }
            void main(){
                vec2 uv = gl_FragCoord.xy / uRes;
                float aspect = uRes.x / uRes.y;
                vec2 p = vec2(uv.x * aspect, uv.y);
                float t = uTime * 0.05;

                float n1 = fbm(p * 1.4 + vec2(t, -t * 0.6));
                float n2 = fbm(p * 2.0 - vec2(t * 0.7, t * 0.4) + n1 * 0.6);
                float n3 = fbm(p * 1.1 + vec2(-t * 0.4, t * 0.8));

                vec2 m = vec2(uMouse.x * aspect, uMouse.y);
                float mouseGlow = exp(-distance(p, m) * 2.4) * 0.5;

                vec3 purple = vec3(0.424, 0.361, 0.906);
                vec3 lilac  = vec3(0.635, 0.608, 0.996);
                vec3 blue   = vec3(0.455, 0.725, 1.0);
                vec3 bg     = vec3(0.039, 0.039, 0.059);

                vec3 col = bg;
                col += purple * smoothstep(0.45, 0.95, n1) * 0.22;
                col += lilac  * smoothstep(0.55, 1.0, n2) * 0.16;
                col += blue   * smoothstep(0.60, 1.0, n3) * 0.12;
                col += (purple + blue) * 0.5 * mouseGlow * 0.35;

                float vign = smoothstep(1.25, 0.35, distance(uv, vec2(0.5, 0.55)));
                col = mix(bg, col, vign);

                gl_FragColor = vec4(col, 1.0);
            }
        `;

        function compile(type, src) {
            const sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
                throw new Error(gl.getShaderInfoLog(sh));
            }
            return sh;
        }

        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        gl.useProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        const uRes = gl.getUniformLocation(program, 'uRes');
        const uTime = gl.getUniformLocation(program, 'uTime');
        const uMouse = gl.getUniformLocation(program, 'uMouse');

        // Soft gradients tolerate low res well — render at half size for perf
        const SCALE = 0.5;
        function resize() {
            canvas.width = Math.max(1, Math.floor(canvas.clientWidth * SCALE));
            canvas.height = Math.max(1, Math.floor(canvas.clientHeight * SCALE));
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        resize();
        window.addEventListener('resize', resize);

        let mouseX = 0.5, mouseY = 0.55, targetX = 0.5, targetY = 0.55;
        window.addEventListener('pointermove', (e) => {
            targetX = e.clientX / window.innerWidth;
            targetY = 1 - e.clientY / window.innerHeight;
        }, { passive: true });

        let visible = true;
        let rafId = null;
        const start = performance.now();

        function frame(now) {
            rafId = null;
            if (!visible || document.hidden) return;
            mouseX += (targetX - mouseX) * 0.04;
            mouseY += (targetY - mouseY) * 0.04;
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uTime, (now - start) / 1000);
            gl.uniform2f(uMouse, mouseX, mouseY);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            rafId = requestAnimationFrame(frame);
        }

        function wake() {
            if (rafId === null && visible && !document.hidden) rafId = requestAnimationFrame(frame);
        }

        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            wake();
        }).observe(hero);
        document.addEventListener('visibilitychange', wake);

        hero.classList.add('hero--gl');
        wake();
    }

    /* ==========================================
       INTERACTIVE NODE MESH (hero signature)
       ========================================== */
    function initHeroMesh() {
        const canvas = document.getElementById('heroMesh');
        const hero = document.querySelector('.hero');
        if (!canvas || !hero) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const LINK_DIST = FINE_POINTER ? 170 : 130;
        const POINTER_RADIUS = 220;

        let width = 0, height = 0;
        let nodes = [];
        let packets = [];
        let waves = [];
        const pointer = { x: -9999, y: -9999, active: false };

        function resize() {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width * DPR;
            canvas.height = height * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            seed();
        }

        function seed() {
            const count = Math.min(FINE_POINTER ? 85 : 40, Math.floor((width * height) / 16000));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                r: 1.2 + Math.random() * 1.6,
                glow: 0
            }));
            packets = [];
            waves = [];
        }

        /* A "broadcast": expanding ring that ignites nodes as it crosses them */
        function spawnWave(x, y) {
            if (waves.length >= 3) return;
            waves.push({ x, y, r: 0, max: Math.hypot(width, height) * 0.55, speed: 5.5 });
        }

        function spawnPacket(a, b) {
            if (packets.length >= (performance.now() < overloadUntil ? 40 : 8)) return;
            packets.push({ a, b, t: 0, speed: 0.014 + Math.random() * 0.012 });
        }

        function spawnAmbientPacket() {
            if (nodes.length < 2) return;
            const a = nodes[(Math.random() * nodes.length) | 0];
            let best = null, bestD = Infinity;
            for (const n of nodes) {
                if (n === a) continue;
                const d = (n.x - a.x) ** 2 + (n.y - a.y) ** 2;
                if (d < bestD && d < LINK_DIST * LINK_DIST) { bestD = d; best = n; }
            }
            if (best) spawnPacket(a, best);
        }

        function step() {
            ctx.clearRect(0, 0, width, height);

            for (let i = waves.length - 1; i >= 0; i--) {
                const wv = waves[i];
                wv.r += wv.speed;
                if (wv.r > wv.max) {
                    waves.splice(i, 1);
                    continue;
                }
                const fade = 1 - wv.r / wv.max;
                ctx.strokeStyle = `rgba(162, 155, 254, ${(fade * 0.3).toFixed(3)})`;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
                ctx.stroke();

                for (const n of nodes) {
                    if (Math.abs(Math.hypot(n.x - wv.x, n.y - wv.y) - wv.r) < 26) {
                        n.glow = Math.min(1, n.glow + 0.12);
                    }
                }
            }

            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < -10) n.x = width + 10; else if (n.x > width + 10) n.x = -10;
                if (n.y < -10) n.y = height + 10; else if (n.y > height + 10) n.y = -10;

                if (pointer.active) {
                    const dx = pointer.x - n.x, dy = pointer.y - n.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < POINTER_RADIUS && dist > 1) {
                        const force = (1 - dist / POINTER_RADIUS) * 0.02;
                        n.vx += (dx / dist) * force;
                        n.vy += (dy / dist) * force;
                        n.glow = Math.min(1, n.glow + 0.06);
                    }
                }
                n.glow *= 0.96;

                // Cap drift speed so pointer nudges never turn into chaos
                const speed = Math.hypot(n.vx, n.vy);
                if (speed > 0.6) { n.vx = (n.vx / speed) * 0.6; n.vy = (n.vy / speed) * 0.6; }
            }

            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 > LINK_DIST * LINK_DIST) continue;
                    const closeness = 1 - Math.sqrt(d2) / LINK_DIST;
                    const boost = Math.max(a.glow, b.glow);
                    ctx.strokeStyle = `rgba(108, 92, 231, ${(0.05 + closeness * 0.14 + boost * 0.25).toFixed(3)})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }

            for (const n of nodes) {
                ctx.fillStyle = `rgba(162, 155, 254, ${(0.35 + n.glow * 0.65).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r + n.glow * 1.5, 0, Math.PI * 2);
                ctx.fill();
            }

            for (let i = packets.length - 1; i >= 0; i--) {
                const p = packets[i];
                p.t += p.speed;
                const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y;
                if (p.t >= 1 || dx * dx + dy * dy > (LINK_DIST * 1.5) ** 2) {
                    p.b.glow = Math.min(1, p.b.glow + 0.5);
                    packets.splice(i, 1);
                    continue;
                }
                const x = p.a.x + dx * p.t;
                const y = p.a.y + dy * p.t;
                ctx.fillStyle = 'rgba(116, 185, 255, 0.25)';
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(116, 185, 255, 0.95)';
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function toLocal(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        window.addEventListener('pointermove', (e) => {
            const pos = toLocal(e);
            pointer.x = pos.x;
            pointer.y = pos.y;
            pointer.active = pos.y > -50 && pos.y < height + 50;
        }, { passive: true });
        window.addEventListener('pointerleave', () => { pointer.active = false; });

        // A click/tap fires packets outward from the nearest node — try it
        hero.addEventListener('pointerdown', (e) => {
            const pos = toLocal(e);
            let origin = null, bestD = Infinity;
            for (const n of nodes) {
                const d = (n.x - pos.x) ** 2 + (n.y - pos.y) ** 2;
                if (d < bestD) { bestD = d; origin = n; }
            }
            if (!origin) return;
            origin.glow = 1;
            spawnWave(origin.x, origin.y);
            nodes
                .filter((n) => n !== origin && (n.x - origin.x) ** 2 + (n.y - origin.y) ** 2 < LINK_DIST * LINK_DIST)
                .slice(0, 5)
                .forEach((n) => spawnPacket(origin, n));
        });

        let visible = true;
        let rafId = null;
        let lastAmbient = 0;
        let lastWave = 0;
        let overloadUntil = 0;

        // Konami code → 4s "system overload": packet storm + broadcast waves
        window.addEventListener('ea:overload', () => {
            overloadUntil = performance.now() + 4000;
            nodes.forEach((n) => { n.glow = 1; });
            for (let i = 0; i < 3; i++) {
                spawnWave(Math.random() * width, Math.random() * height);
            }
            wake();
        });

        function loop(now) {
            rafId = null;
            if (!visible || document.hidden) return;
            const overloaded = now < overloadUntil;
            if (now - lastAmbient > (overloaded ? 70 : 650)) {
                lastAmbient = now;
                spawnAmbientPacket();
            }
            if (now - lastWave > (overloaded ? 800 : 8000)) {
                lastWave = now;
                const n = nodes[(Math.random() * nodes.length) | 0];
                if (n) spawnWave(n.x, n.y);
            }
            step();
            rafId = requestAnimationFrame(loop);
        }

        function wake() {
            if (rafId === null && visible && !document.hidden) rafId = requestAnimationFrame(loop);
        }

        new IntersectionObserver((entries) => {
            visible = entries[0].isIntersecting;
            wake();
        }).observe(hero);
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('resize', resize);

        resize();
        wake();
    }

    /* ==========================================
       HERO AMBIENT (orb drift, bg parallax, scroll cue)
       ========================================== */
    function initHeroAmbient() {
        document.querySelectorAll('.hero__orb').forEach((orb, i) => {
            gsap.to(orb, {
                x: `random(-30, 30)`,
                y: `random(-40, 20)`,
                duration: 7 + i * 1.5,
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut',
                delay: i * -2.5
            });
        });

        if (FINE_POINTER) {
            const bg = document.getElementById('heroBg');
            if (bg) {
                const xTo = gsap.quickTo(bg, 'x', { duration: 0.8, ease: 'power2.out' });
                const yTo = gsap.quickTo(bg, 'y', { duration: 0.8, ease: 'power2.out' });
                window.addEventListener('pointermove', (e) => {
                    xTo(((e.clientX / window.innerWidth) - 0.5) * 26);
                    yTo(((e.clientY / window.innerHeight) - 0.5) * 18);
                }, { passive: true });
            }

            // The terminal Lottie leans gently toward the cursor
            const lottie = document.querySelector('.hero__lottie');
            if (lottie) {
                gsap.set(lottie, { transformPerspective: 600 });
                const rxTo = gsap.quickTo(lottie, 'rotationX', { duration: 0.9, ease: 'power2.out' });
                const ryTo = gsap.quickTo(lottie, 'rotationY', { duration: 0.9, ease: 'power2.out' });
                window.addEventListener('pointermove', (e) => {
                    ryTo(((e.clientX / window.innerWidth) - 0.5) * 12);
                    rxTo(-((e.clientY / window.innerHeight) - 0.5) * 9);
                }, { passive: true });
            }
        }

        // Hero content drifts up + fades slightly as it scrolls away
        gsap.to('.hero__container', {
            y: -70,
            autoAlpha: 0.25,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: 0.6 }
        });

        const cue = document.querySelector('.hero__scroll');
        if (cue) {
            ScrollTrigger.create({
                start: 60,
                onEnter: () => gsap.to(cue, { autoAlpha: 0, duration: 0.3 }),
                onLeaveBack: () => gsap.to(cue, { autoAlpha: 1, duration: 0.3 })
            });
        }
    }

    /* ==========================================
       CUSTOM CURSOR
       ========================================== */
    function initCursor() {
        if (!FINE_POINTER) return;
        const dot = document.getElementById('cursorDot');
        const ring = document.getElementById('cursorRing');
        const glow = document.getElementById('cursorGlow');
        if (!dot || !ring) return;

        document.documentElement.classList.add('cursor-enabled');
        const body = document.body;

        let mx = innerWidth / 2, my = innerHeight / 2;
        let dx = mx, dy = my, rx = mx, ry = my, gx = mx, gy = my;

        window.addEventListener('pointermove', (e) => {
            mx = e.clientX;
            my = e.clientY;
        }, { passive: true });

        gsap.ticker.add(() => {
            dx += (mx - dx) * 0.6;
            dy += (my - dy) * 0.6;
            rx += (mx - rx) * 0.18;
            ry += (my - ry) * 0.18;
            dot.style.transform = `translate(${dx}px, ${dy}px)`;
            ring.style.transform = `translate(${rx}px, ${ry}px)`;
            if (glow) {
                gx += (mx - gx) * 0.08;
                gy += (my - gy) * 0.08;
                // transform only — left/top would force layout every frame
                glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%)`;
            }
        });

        const HOVER_SEL = 'a, button, .skills__tag';
        const HIDE_SEL = 'input, textarea, select';

        document.addEventListener('pointerover', (e) => {
            if (e.target.closest(HIDE_SEL)) body.classList.add('cursor--hidden');
            else body.classList.remove('cursor--hidden');
            body.classList.toggle('cursor--hover', !!e.target.closest(HOVER_SEL));
        });
        document.addEventListener('pointerdown', () => body.classList.add('cursor--press'));
        document.addEventListener('pointerup', () => body.classList.remove('cursor--press'));
        document.documentElement.addEventListener('pointerleave', () => body.classList.add('cursor--hidden'));
        document.documentElement.addEventListener('pointerenter', () => body.classList.remove('cursor--hidden'));
    }

    /* ==========================================
       CURSOR CONSTELLATION TRAIL (site-wide)
       ========================================== */
    function initCursorTrail() {
        if (!FINE_POINTER) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'cursor-trail';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        const LIFE = 750;
        const LINK_DIST = 130;
        let w = 0, h = 0;

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * DPR;
            canvas.height = h * DPR;
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);

        const pts = [];
        let lastX = -999, lastY = -999;
        let rafId = null;

        window.addEventListener('pointermove', (e) => {
            const dx = e.clientX - lastX, dy = e.clientY - lastY;
            if (dx * dx + dy * dy < 576) return; // spawn every ~24px of travel
            lastX = e.clientX;
            lastY = e.clientY;
            pts.push({ x: e.clientX, y: e.clientY, born: performance.now() });
            if (pts.length > 32) pts.shift();
            if (rafId === null) rafId = requestAnimationFrame(frame);
        }, { passive: true });

        function frame(now) {
            rafId = null;
            ctx.clearRect(0, 0, w, h);

            while (pts.length && now - pts[0].born > LIFE) pts.shift();

            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                const a = 1 - (now - p.born) / LIFE;

                if (i > 0) {
                    const q = pts[i - 1];
                    const dx = p.x - q.x, dy = p.y - q.y;
                    if (dx * dx + dy * dy < LINK_DIST * LINK_DIST) {
                        ctx.strokeStyle = `rgba(108, 92, 231, ${(a * 0.4).toFixed(3)})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(q.x, q.y);
                        ctx.lineTo(p.x, p.y);
                        ctx.stroke();
                    }
                }

                ctx.fillStyle = `rgba(162, 155, 254, ${(a * 0.7).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.2 + a * 1.6, 0, Math.PI * 2);
                ctx.fill();
            }

            if (pts.length) rafId = requestAnimationFrame(frame);
        }
    }

    /* ==========================================
       MAGNETIC ELEMENTS
       ========================================== */
    function initMagnetic() {
        if (!FINE_POINTER) return;

        document.querySelectorAll('.btn, .nav__link, .nav__logo, .contact__detail-item').forEach((el) => {
            const strength = el.classList.contains('nav__link') || el.classList.contains('nav__logo') ? 0.35 : 0.25;
            const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
            const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });

            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                xTo((e.clientX - rect.left - rect.width / 2) * strength);
                yTo((e.clientY - rect.top - rect.height / 2) * strength);
            });
            el.addEventListener('pointerleave', () => {
                gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
            });
        });
    }

    /* ==========================================
       TILT + SPOTLIGHT CARDS
       ========================================== */
    function initTiltSpotlight() {
        const cards = document.querySelectorAll(
            '.portfolio__card, .about__highlight-card, .education__card, .skills__category'
        );
        const spotlightOnly = document.querySelectorAll('.contact__form');

        [...cards, ...spotlightOnly].forEach((el) => el.classList.add('spotlight'));
        if (!FINE_POINTER) return;

        const setSpot = (el, e) => {
            const rect = el.getBoundingClientRect();
            el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
            el.style.setProperty('--my', `${e.clientY - rect.top}px`);
        };

        spotlightOnly.forEach((el) => {
            el.addEventListener('pointermove', (e) => setSpot(el, e), { passive: true });
        });

        cards.forEach((card) => {
            const MAX_TILT = card.classList.contains('portfolio__card') ? 5 : 7;
            // preserve-3d lets children with translateZ pop out while tilting
            gsap.set(card, { transformPerspective: 800, transformStyle: 'preserve-3d' });
            const rxTo = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2.out' });
            const ryTo = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2.out' });

            card.addEventListener('pointermove', (e) => {
                setSpot(card, e);
                const rect = card.getBoundingClientRect();
                const px = (e.clientX - rect.left) / rect.width - 0.5;
                const py = (e.clientY - rect.top) / rect.height - 0.5;
                rxTo(-py * MAX_TILT);
                ryTo(px * MAX_TILT);
            }, { passive: true });

            card.addEventListener('pointerenter', () => {
                gsap.to(card, { scale: 1.015, y: -4, duration: 0.4, ease: 'power2.out' });
            });
            card.addEventListener('pointerleave', () => {
                rxTo(0);
                ryTo(0);
                gsap.to(card, { scale: 1, y: 0, duration: 0.5, ease: 'power2.out' });
            });
        });
    }

    /* ==========================================
       SECTION HEADER REVEALS (labels + titles)
       ========================================== */
    function initSectionHeaderReveals() {
        document.querySelectorAll('.section__header').forEach((header) => {
            header.dataset.revealed = '1';
            const label = header.querySelector('.section__label');
            const title = header.querySelector('.section__title');

            gsap.set(header, { autoAlpha: 1 });

            let lines = null;
            if (title) {
                lines = SplitText.create(title, { type: 'lines', mask: 'lines' }).lines;
                gsap.set(lines, { yPercent: 115 });
            }
            const lottie = header.querySelector('.section__header-lottie');

            if (label) gsap.set(label, { autoAlpha: 0 });
            if (lottie) gsap.set(lottie, { autoAlpha: 0, scale: 0.7 });

            const tl = gsap.timeline({
                scrollTrigger: { trigger: header, start: 'top 85%', once: true }
            });

            if (label) {
                const original = label.textContent;
                tl.to(label, { autoAlpha: 1, duration: 0.3 }, 0)
                    .to(label, {
                        duration: 0.9,
                        scrambleText: { text: original, chars: '<>/{}[]01', speed: 0.5 }
                    }, 0);
            }

            if (lines) {
                tl.to(lines, {
                    yPercent: 0,
                    duration: 0.9,
                    ease: 'power4.out',
                    stagger: 0.12
                }, 0.1);
            }

            if (lottie) {
                tl.to(lottie, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, 0.35);
            }
        });
    }

    /* ==========================================
       ABOUT — scrubbed word reveal + highlight cards
       ========================================== */
    function initAboutScrub() {
        const textWrap = document.querySelector('.about__text');
        if (textWrap) {
            textWrap.dataset.revealed = '1';
            gsap.set(textWrap, { autoAlpha: 1 });

            textWrap.querySelectorAll('p').forEach((p) => {
                const split = SplitText.create(p, { type: 'words' });
                gsap.from(split.words, {
                    opacity: 0.12,
                    ease: 'none',
                    stagger: 0.04,
                    scrollTrigger: { trigger: p, start: 'top 82%', end: 'top 40%', scrub: 0.5 }
                });
            });
        }

        const highlights = document.querySelector('.about__highlights');
        if (highlights) {
            highlights.dataset.revealed = '1';
            gsap.set(highlights, { autoAlpha: 1 });
            const cards = highlights.querySelectorAll('.about__highlight-card');
            gsap.set(cards, { autoAlpha: 0, x: 48 });
            gsap.to(cards, {
                autoAlpha: 1,
                x: 0,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.12,
                scrollTrigger: { trigger: highlights, start: 'top 82%', once: true }
            });
        }
    }

    /* ==========================================
       SKILLS — category cards + tag pops
       ========================================== */
    function initSkillsReveal() {
        document.querySelectorAll('.skills__category').forEach((cat) => {
            cat.dataset.revealed = '1';
            const tags = cat.querySelectorAll('.skills__tag');
            gsap.set(tags, { autoAlpha: 0, scale: 0.5, y: 12 });

            const tl = gsap.timeline({
                scrollTrigger: { trigger: cat, start: 'top 86%', once: true }
            });

            tl.to(cat, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', startAt: { y: 36 } })
                .to(tags, {
                    autoAlpha: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.5,
                    ease: 'back.out(2)',
                    stagger: 0.045,
                    clearProps: 'all' // restore the CSS :hover lift after the pop
                }, 0.25);
        });
    }

    /* ==========================================
       EXPERIENCE — card reveals + timeline packet
       ========================================== */
    function initExperienceReveal() {
        document.querySelectorAll('.experience__item').forEach((item) => {
            item.dataset.revealed = '1';
            gsap.set(item, { autoAlpha: 1 });
            const card = item.querySelector('.experience__card');
            gsap.set(card, { autoAlpha: 0, x: -44 });
            gsap.to(card, {
                autoAlpha: 1,
                x: 0,
                duration: 0.8,
                ease: 'power3.out',
                scrollTrigger: { trigger: item, start: 'top 82%', once: true }
            });
        });

        if (!window.matchMedia('(min-width: 769px)').matches) return;

        const timeline = document.getElementById('experienceTimeline');
        const progress = document.getElementById('experienceProgress');
        const line = document.getElementById('experienceProgressLine');
        const packet = document.getElementById('experiencePacket');
        const dots = [...document.querySelectorAll('.experience__dot')];
        if (!timeline || !progress || !line || !packet || !dots.length) return;

        let travel = 0;
        let dotOffsets = [];

        function measure() {
            const tRect = timeline.getBoundingClientRect();
            const centers = dots.map((d) => d.getBoundingClientRect().top - tRect.top + d.offsetHeight / 2);
            const top = centers[0];
            travel = centers[centers.length - 1] - top;
            dotOffsets = centers.map((c) => c - top);
            progress.style.top = `${top}px`;
            progress.style.height = `${travel}px`;
        }
        measure();

        const packetY = gsap.quickSetter(packet, 'y', 'px');

        function apply(self) {
            const y = travel * self.progress;
            line.style.transform = `scaleY(${self.progress})`;
            packetY(y);
            packet.style.opacity = self.progress > 0.005 && self.progress < 0.995 ? 1 : 0;
            dots.forEach((dot, i) => dot.classList.toggle('experience__dot--lit', dotOffsets[i] <= y + 2));
        }

        // End when the timeline's bottom reaches the viewport bottom: with
        // scroll-snap active the page can't rest any deeper into the section,
        // so a later end point would snap away before the draw ever finished.
        // onRefresh also applies so mid-page loads render the drawn state.
        ScrollTrigger.create({
            trigger: timeline,
            start: 'top 65%',
            end: 'bottom bottom',
            scrub: 0.4,
            onRefresh: (self) => {
                measure();
                apply(self);
            },
            onUpdate: apply
        });
    }

    /* ==========================================
       PORTFOLIO / EDUCATION / CONTACT REVEALS
       ========================================== */
    function initPortfolioReveal() {
        const cards = [...document.querySelectorAll('.portfolio__card')];
        cards.forEach((c) => { c.dataset.revealed = '1'; });
        gsap.set(cards, { y: 48, scale: 0.97 });
        ScrollTrigger.batch(cards, {
            start: 'top 88%',
            once: true,
            onEnter: (batch) => gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.09
            })
        });
    }

    function initEducationReveal() {
        document.querySelectorAll('.education__card').forEach((card, i) => {
            card.dataset.revealed = '1';
            gsap.fromTo(card,
                { autoAlpha: 0, rotationX: -35, y: 40, transformPerspective: 700, transformOrigin: 'center top' },
                {
                    autoAlpha: 1,
                    rotationX: 0,
                    y: 0,
                    duration: 0.9,
                    delay: i * 0.1,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: card, start: 'top 88%', once: true }
                });
        });
    }

    function initContactReveal() {
        const info = document.querySelector('.contact__info');
        if (info) {
            info.dataset.revealed = '1';
            const items = info.querySelectorAll('.contact__detail-item, .contact__availability');
            gsap.set(items, { autoAlpha: 0, x: -28 });
            const tl = gsap.timeline({
                scrollTrigger: { trigger: info, start: 'top 84%', once: true }
            });
            tl.to(info, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', startAt: { y: 32 } })
                .to(items, {
                    autoAlpha: 1,
                    x: 0,
                    duration: 0.55,
                    ease: 'power3.out',
                    stagger: 0.09
                }, 0.2);
        }

        const form = document.querySelector('.contact__form');
        if (form) {
            form.dataset.revealed = '1';
            const fields = form.querySelectorAll('.form__group, #submitBtn');
            gsap.set(fields, { autoAlpha: 0, y: 22 });
            const tl = gsap.timeline({
                scrollTrigger: { trigger: form, start: 'top 84%', once: true }
            });
            tl.to(form, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', startAt: { y: 32 } })
                .to(fields, {
                    autoAlpha: 1,
                    y: 0,
                    duration: 0.5,
                    ease: 'power3.out',
                    stagger: 0.08
                }, 0.2);
        }
    }

    /* Any .animate-in not claimed by a specialized reveal gets a default one.
       Start threshold is nearly the viewport bottom: elements hugging the end
       of the page (like the footer) can never cross a higher line even at
       max scroll, and would otherwise stay invisible forever */
    function initCatchAllReveal() {
        const rest = [...document.querySelectorAll('.animate-in')].filter((el) => !el.dataset.revealed);
        if (!rest.length) return;
        gsap.set(rest, { y: 36 });
        ScrollTrigger.batch(rest, {
            start: 'top 98%',
            once: true,
            onEnter: (batch) => gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.08
            })
        });
    }

    /* ==========================================
       ROLLING TEXT HOVER (hero buttons)
       Nav links deliberately excluded — Eric found the roll distracting there
       ========================================== */
    function initRollingLinks() {
        const targets = [
            ...document.querySelectorAll('.hero__actions .btn > span:first-child')
        ];

        targets.forEach((el) => {
            const text = el.textContent.trim();
            if (!text) return;

            const host = el.closest('a, button');
            if (host) host.setAttribute('aria-label', text);

            const roll = document.createElement('span');
            roll.className = 'roll';
            roll.setAttribute('aria-hidden', 'true');
            for (let i = 0; i < 2; i++) {
                const line = document.createElement('span');
                line.className = 'roll__line';
                line.textContent = text;
                roll.appendChild(line);
            }
            el.textContent = '';
            el.appendChild(roll);
        });
    }

    /* ==========================================
       ENERGY BORDER (featured portfolio cards)
       ========================================== */
    function initEnergyBorders() {
        document.querySelectorAll('.portfolio__card--featured').forEach((card) => {
            const border = document.createElement('span');
            border.className = 'energy-border';
            border.setAttribute('aria-hidden', 'true');
            card.appendChild(border);
        });
    }

    /* ==========================================
       GYROSCOPE PARALLAX (touch devices)
       ========================================== */
    function initGyroParallax() {
        if (FINE_POINTER) return;
        if (typeof DeviceOrientationEvent === 'undefined') return;
        // iOS requires a permission prompt mid-gesture — not worth interrupting
        if (typeof DeviceOrientationEvent.requestPermission === 'function') return;

        const bg = document.getElementById('heroBg');
        if (!bg) return;
        const xTo = gsap.quickTo(bg, 'x', { duration: 0.9, ease: 'power2.out' });
        const yTo = gsap.quickTo(bg, 'y', { duration: 0.9, ease: 'power2.out' });

        window.addEventListener('deviceorientation', (e) => {
            if (e.gamma == null || e.beta == null) return;
            xTo(gsap.utils.clamp(-22, 22, e.gamma * 0.8));
            yTo(gsap.utils.clamp(-16, 16, (e.beta - 40) * 0.5)); // ~40° natural holding angle
        }, { passive: true });
    }

    /* ==========================================
       BACK TO TOP
       ========================================== */
    function initBackToTop() {
        const btn = document.createElement('button');
        btn.className = 'back-to-top';
        btn.setAttribute('aria-label', 'Back to top');
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
            + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
            + '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
        document.body.appendChild(btn);

        ScrollTrigger.create({
            start: 600,
            end: 'max',
            onEnter: () => btn.classList.add('back-to-top--visible'),
            onLeaveBack: () => btn.classList.remove('back-to-top--visible')
        });
        // mid-page loads land past the trigger without firing onEnter
        if (window.scrollY > 600) btn.classList.add('back-to-top--visible');

        btn.addEventListener('click', () => {
            markProgrammaticScroll();
            window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
        });
    }

    /* ==========================================
       KONAMI EASTER EGG (fires 'ea:overload')
       ========================================== */
    function initOverloadEasterEgg() {
        const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
            'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
        let idx = 0;

        window.addEventListener('keydown', (e) => {
            idx = e.key === seq[idx] ? idx + 1 : (e.key === seq[0] ? 1 : 0);
            if (idx !== seq.length) return;
            idx = 0;
            window.dispatchEvent(new CustomEvent('ea:overload'));
            burstAt(window.innerWidth / 2, window.innerHeight * 0.35);
        });
    }

    /* ==========================================
       SECTION TITLE PARALLAX
       ========================================== */
    function initTitleParallax() {
        document.querySelectorAll('.section__title').forEach((title) => {
            gsap.fromTo(title,
                { y: 28 },
                {
                    y: -28,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: title.closest('.section__header') || title,
                        start: 'top 100%',
                        end: 'bottom 0%',
                        scrub: 0.6
                    }
                });
        });
    }

    /* ==========================================
       NAV MAGIC LINE + SCROLL PROGRESS
       ========================================== */
    function initMagicLine() {
        if (!window.matchMedia('(min-width: 769px)').matches) return;
        const links = document.getElementById('navLinks');
        if (!links) return;

        const lineEl = document.createElement('span');
        lineEl.className = 'nav__magic-line';
        links.appendChild(lineEl);
        document.documentElement.classList.add('magic-nav');

        window.addEventListener('ea:activelink', (e) => {
            const active = e.detail;
            if (!active || active.classList.contains('nav__link--cta')) {
                gsap.to(lineEl, { opacity: 0, duration: 0.25 });
                return;
            }
            gsap.to(lineEl, {
                opacity: 1,
                x: active.offsetLeft + 14,
                width: Math.max(active.offsetWidth - 28, 12),
                duration: 0.4,
                ease: 'power3.out'
            });
        });
    }

    function initScrollProgressBar() {
        const bar = document.getElementById('scrollProgressBar');
        if (!bar) return;
        ScrollTrigger.create({
            start: 0,
            end: 'max',
            onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; }
        });
    }

    /* ==========================================
       NAVIGATION
       ========================================== */
    function initNavigation() {
        const nav = document.getElementById('nav');
        const toggle = document.getElementById('navToggle');
        const links = document.getElementById('navLinks');

        // Nav tucks away scrolling down, returns scrolling up
        let navHidden = false;
        let lastY = window.scrollY;

        window.addEventListener('scroll', () => {
            const y = window.scrollY;
            nav.classList.toggle('nav--scrolled', y > 50);

            if (HAS_GSAP && !REDUCED) {
                const drawerOpen = links && links.classList.contains('active');
                const shouldHide = y > lastY && y > 400 && !drawerOpen;
                if (shouldHide !== navHidden) {
                    navHidden = shouldHide;
                    gsap.to(nav, {
                        yPercent: navHidden ? -100 : 0,
                        duration: 0.35,
                        ease: 'power2.out',
                        overwrite: 'auto'
                    });
                }
            }
            lastY = y;

            updateActiveLink();
        }, { passive: true });

        if (toggle && links) {
            toggle.addEventListener('click', () => {
                const opening = !links.classList.contains('active');
                toggle.classList.toggle('active');
                links.classList.toggle('active');
                document.body.style.overflow = opening ? 'hidden' : '';

                if (opening && HAS_GSAP && !REDUCED) {
                    gsap.from(links.querySelectorAll('.nav__link'), {
                        x: 42,
                        autoAlpha: 0,
                        duration: 0.45,
                        ease: 'power3.out',
                        stagger: 0.06,
                        delay: 0.1,
                        clearProps: 'all'
                    });
                }
            });

            links.querySelectorAll('.nav__link').forEach((link) => {
                link.addEventListener('click', () => {
                    toggle.classList.remove('active');
                    links.classList.remove('active');
                    document.body.style.overflow = '';
                });
            });
        }

        const sections = [...document.querySelectorAll('section[id]')];
        const navLinks = [...document.querySelectorAll('.nav__link[href^="#"]')];
        let currentActiveId = null;

        // Cache layout reads — with smooth scrolling the scroll handler runs
        // every frame, and offsetTop/scrollHeight reads there cause jank
        let navHeight = 0;
        let sectionTops = [];
        let docHeight = 0;

        function measureLayout() {
            navHeight = nav.offsetHeight;
            sectionTops = sections.map((s) => s.offsetTop);
            docHeight = document.documentElement.scrollHeight;
        }
        measureLayout();
        window.addEventListener('resize', measureLayout);
        window.addEventListener('load', measureLayout);
        if (HAS_GSAP && typeof ScrollTrigger !== 'undefined') {
            ScrollTrigger.addEventListener('refresh', measureLayout);
        }

        function updateActiveLink() {
            const probeLine = window.scrollY + navHeight + window.innerHeight * 0.3;
            const atBottom = window.innerHeight + window.scrollY >= docHeight - 2;

            let activeId = '';
            sections.forEach((section, i) => {
                if (atBottom || sectionTops[i] <= probeLine) activeId = section.id;
            });

            let activeLink = null;
            navLinks.forEach((link) => {
                const isActive = link.getAttribute('href') === `#${activeId}`;
                link.classList.toggle('nav__link--active', isActive);
                if (isActive) activeLink = link;
            });

            if (activeId !== currentActiveId) {
                currentActiveId = activeId;
                window.dispatchEvent(new CustomEvent('ea:activelink', { detail: activeLink }));
            }
        }

        updateActiveLink();
    }

    /* ==========================================
       COUNTERS
       ========================================== */
    function counterTarget(el) {
        return el.hasAttribute('data-start-year')
            ? new Date().getFullYear() - parseInt(el.getAttribute('data-start-year'), 10)
            : parseInt(el.getAttribute('data-count'), 10);
    }

    function setCountersInstant() {
        document.querySelectorAll('[data-count], [data-start-year]').forEach((el) => {
            el.textContent = counterTarget(el);
        });
    }

    function initCounters(gsapRef) {
        const counters = document.querySelectorAll('[data-count], [data-start-year]');

        if (gsapRef) {
            // Odometer treatment: each digit is a rolling column of 0-9
            counters.forEach((el) => {
                const target = counterTarget(el);
                const cols = buildOdometer(el, target);
                let played = false;
                const play = () => {
                    if (played) return;
                    played = true;
                    cols.forEach((col, i) => {
                        gsap.to(col.el, {
                            y: `${-col.steps}em`,
                            duration: 1.7,
                            delay: i * 0.12,
                            ease: 'power4.inOut'
                        });
                    });
                };
                ScrollTrigger.create({
                    trigger: el,
                    start: 'top 90%',
                    once: true,
                    onEnter: play
                });
                // mid-page loads: trigger start may already be passed
                if (el.getBoundingClientRect().top < window.innerHeight * 0.9) play();
            });
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target, 0, counterTarget(entry.target), 1500);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        counters.forEach((el) => observer.observe(el));
    }

    /* Builds rolling digit columns inside a stat number; returns the columns */
    function buildOdometer(el, target) {
        const digits = String(target).split('');
        el.setAttribute('aria-label', String(target));
        el.textContent = '';

        return digits.map((digit) => {
            const slot = document.createElement('span');
            slot.className = 'odometer__slot';
            slot.setAttribute('aria-hidden', 'true');
            const col = document.createElement('span');
            col.className = 'odometer__col';

            // one full 0-9 spin, then land on the target digit
            const seq = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
            for (let i = 0; i <= +digit; i++) seq.push(i);
            seq.forEach((n) => {
                const d = document.createElement('span');
                d.className = 'odometer__digit';
                d.textContent = n;
                col.appendChild(d);
            });

            slot.appendChild(col);
            el.appendChild(slot);
            return { el: col, steps: seq.length - 1 };
        });
    }

    function animateCounter(element, start, end, duration) {
        const startTime = performance.now();

        function update(currentTime) {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            element.textContent = Math.round(start + (end - start) * eased);
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    }

    /* ==========================================
       TYPED TEXT EFFECT (Hero subtitle)
       ========================================== */
    function initTypedEffect() {
        const roles = [
            'AI-Native Engineer',
            'Senior Software Engineer',
            'Backend Architect',
            'System Designer',
            'Full-Stack Developer'
        ];

        const subtitleEl = document.querySelector('.hero__title-line--sub');
        if (!subtitleEl) return;

        let currentRole = 0;
        let currentChar = roles[0].length;
        let isDeleting = false;

        function type() {
            const role = roles[currentRole];

            if (isDeleting) {
                currentChar--;
                subtitleEl.textContent = role.substring(0, currentChar);

                if (currentChar === 0) {
                    isDeleting = false;
                    currentRole = (currentRole + 1) % roles.length;
                    setTimeout(type, 400);
                    return;
                }
                setTimeout(type, 40);
            } else {
                currentChar++;
                subtitleEl.textContent = roles[currentRole].substring(0, currentChar);

                if (currentChar === roles[currentRole].length) {
                    isDeleting = true;
                    setTimeout(type, 2500);
                    return;
                }
                setTimeout(type, 70);
            }
        }

        setTimeout(type, 3000);
    }

    /* ==========================================
       CONTACT FORM (Web3Forms)
       ========================================== */
    function initContactForm() {
        const form = document.getElementById('contactForm');
        if (!form) return;

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn && HAS_GSAP && !REDUCED) {
            submitBtn.addEventListener('pointerdown', (e) => {
                const rect = submitBtn.getBoundingClientRect();
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                const size = Math.max(rect.width, rect.height) * 2;
                ripple.style.width = ripple.style.height = `${size}px`;
                ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
                ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
                submitBtn.appendChild(ripple);
                gsap.to(ripple, { scale: 1, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => ripple.remove() });
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btnText = submitBtn.querySelector('.btn__text');
            const btnLoading = submitBtn.querySelector('.btn__loading');
            const btnSuccess = submitBtn.querySelector('.btn__success');
            const formStatus = document.getElementById('formStatus');

            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;
            formStatus.textContent = '';
            formStatus.className = 'form__status';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData);

            data.access_key = 'e24711e5-ecf8-4265-a880-68e184e1c72e';

            try {
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.success) {
                    btnLoading.style.display = 'none';
                    btnSuccess.style.display = 'inline-flex';
                    formStatus.textContent = 'Message sent! I\'ll get back to you soon.';
                    formStatus.className = 'form__status form__status--success';
                    form.reset();
                    packetBurst(submitBtn);

                    setTimeout(() => {
                        btnSuccess.style.display = 'none';
                        btnText.style.display = 'inline-flex';
                        submitBtn.disabled = false;
                    }, 4000);
                } else {
                    throw new Error(result.message || 'Something went wrong');
                }
            } catch (error) {
                // Fallback: open mailto with form data
                const subject = encodeURIComponent(`[Portfolio] ${data.inquiry_type || 'Inquiry'} from ${data.name}`);
                const body = encodeURIComponent(
                    `Name: ${data.name}\nEmail: ${data.email}\nSubject: ${data.inquiry_type}\n\nMessage:\n${data.message}`
                );
                window.location.href = `mailto:ericanthonywu89@gmail.com?subject=${subject}&body=${body}`;

                btnLoading.style.display = 'none';
                btnSuccess.style.display = 'inline-flex';
                formStatus.textContent = 'API failed. Opening your email client instead...';
                formStatus.className = 'form__status form__status--success';

                setTimeout(() => {
                    btnSuccess.style.display = 'none';
                    btnText.style.display = 'inline-flex';
                    submitBtn.disabled = false;
                }, 4000);
            }
        });
    }

    /* Success celebration: packets scatter from the button, on theme */
    function packetBurst(fromEl) {
        const rect = fromEl.getBoundingClientRect();
        burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function burstAt(cx, cy) {
        if (!HAS_GSAP || REDUCED) return;
        const colors = [ACCENT_PRIMARY, ACCENT_SECONDARY, ACCENT_BLUE, '#f0f0f5'];

        for (let i = 0; i < 18; i++) {
            const p = document.createElement('span');
            p.className = 'burst-particle';
            p.style.background = colors[i % colors.length];
            p.style.left = `${cx}px`;
            p.style.top = `${cy}px`;
            document.body.appendChild(p);

            const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.5;
            const dist = 60 + Math.random() * 90;
            gsap.to(p, {
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist - 30,
                rotation: Math.random() * 360,
                scale: 0,
                duration: 0.9 + Math.random() * 0.4,
                ease: 'power3.out',
                onComplete: () => p.remove()
            });
        }
    }

    /* ==========================================
       EXPERIENCE CARDS EXPAND/COLLAPSE (mobile)
       ========================================== */
    function initExperienceToggle() {
        if (window.innerWidth >= 768) return;

        document.querySelectorAll('.experience__card').forEach((card) => {
            const header = card.querySelector('.experience__header');
            const details = card.querySelector('.experience__details');
            if (!header || !details) return;

            details.style.transition = 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            header.style.cursor = 'pointer';

            header.addEventListener('click', () => {
                if (card.classList.contains('collapsed')) {
                    details.style.maxHeight = details.scrollHeight + 'px';
                    card.classList.remove('collapsed');
                } else {
                    details.style.maxHeight = '0';
                    card.classList.add('collapsed');
                }
            });
        });
    }

    /* ==========================================
       PWA SERVICE WORKER
       ========================================== */
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // On localhost: unregister SW so local dev never encounters stale caching or ERR_EMPTY_RESPONSE
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (const reg of registrations) reg.unregister();
                });
                return;
            }

            // In HTTPS production environment: register PWA service worker
            if (location.protocol === 'https:') {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/service-worker.js')
                        .then((registration) => {
                            console.log('SW registered:', registration.scope);
                        })
                        .catch((error) => {
                            console.log('SW registration failed:', error);
                        });
                });
            }
        }
    }
})();
