(() => {
  'use strict';

  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  /* Header scroll state + active link */
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Hero-to-content fade: builds in as you scroll through the hero
     (0 at the top, 1 once you've scrolled past it), instead of sitting
     there as a fixed gradient from page load. Also drives a subtle
     parallax on the hero photo and its decorative paw shapes, each
     moving at a different rate for depth — skipped under
     reduced-motion since it's purely decorative. */
  const hero = $('.hero, .page-hero');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (hero) {
    const onHeroScroll = () => {
      const scrollY = window.scrollY;
      const progress = Math.min(1, Math.max(0, scrollY / hero.offsetHeight));
      hero.style.setProperty('--hero-fade', progress.toFixed(3));
      if (!reduceMotion && scrollY < hero.offsetHeight * 1.4) {
        hero.style.setProperty('--parallax', (scrollY * 0.12).toFixed(1) + 'px');
      }
    };
    onHeroScroll();
    window.addEventListener('scroll', onHeroScroll, { passive: true });
  }

  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    const isHere = href === here || (here === '' && href === 'index.html');
    a.classList.toggle('is-active', isHere);
    if (isHere) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  /* Mobile nav toggle */
  const navToggle = $('.nav-toggle');
  const navLinks = $('.nav-links');
  if (navToggle && navLinks) {
    const mobile = window.matchMedia('(max-width: 1100px)');
    let open = false;
    let bodyOverflow = '';
    const focusable = () => [...$$('a[href], button, input, select, textarea, [tabindex]', navLinks), navToggle]
      .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const setOpen = (next, restoreFocus = false) => {
      next = next && mobile.matches;
      if (next && !open) bodyOverflow = document.body.style.overflow;
      if (!next && open) document.body.style.overflow = bodyOverflow;
      open = next;
      navLinks.classList.toggle('is-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      if (open) {
        document.body.style.overflow = 'hidden';
        (focusable()[0] || navToggle).focus();
      } else if (restoreFocus && mobile.matches) {
        navToggle.focus({ preventScroll: true });
      }
    };
    navToggle.addEventListener('click', () => setOpen(!open, true));
    navLinks.addEventListener('click', e => {
      if (e.target.closest('a[href]')) setOpen(false, true);
    });
    document.addEventListener('click', e => {
      if (open && !navLinks.contains(e.target) && !navToggle.contains(e.target)) {
        setOpen(false, navLinks.contains(document.activeElement));
      }
    });
    document.addEventListener('keydown', e => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false, true);
      } else if (e.key === 'Tab') {
        const items = focusable();
        const index = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(index + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    });
    document.addEventListener('focusin', e => {
      if (open && !navLinks.contains(e.target) && e.target !== navToggle) {
        (focusable()[0] || navToggle).focus();
      }
    });
    const onResize = () => {
      if (!mobile.matches) {
        const toggleFocused = document.activeElement === navToggle;
        setOpen(false);
        if (toggleFocused) focusable()[0]?.focus({ preventScroll: true });
      } else if (!open && navLinks.contains(document.activeElement)) {
        navToggle.focus({ preventScroll: true });
      }
    };
    window.addEventListener('resize', onResize);
    setOpen(false);
    document.documentElement.classList.add('nav-ready');
    onResize();
  }

  /* Scroll reveal */
  const revealEls = $$('[data-reveal]');
  const revealGroupEls = $$('[data-reveal-group]');
  if (revealEls.length || revealGroupEls.length) {
    if (!reduceMotion && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0 });
      [...revealEls, ...revealGroupEls].forEach(el => observer.observe(el));
    } else {
      [...revealEls, ...revealGroupEls].forEach(el => el.classList.add('in-view'));
    }
    document.documentElement.classList.add('reveal-ready');
  }

  /* Animated stat counters */
  const counters = $$('[data-count]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    counters.forEach(el => {
      const target = parseFloat(el.getAttribute('data-count'));
      if (Number.isFinite(target)) el.textContent = target + (el.getAttribute('data-suffix') || '');
    });
  } else if (counters.length) {
    const animate = (el) => {
      const target = parseFloat(el.getAttribute('data-count'));
      const suffix = el.getAttribute('data-suffix') || '';
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(target * eased);
        el.textContent = value + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target);
          io2.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => io2.observe(el));
  }

  /* Sticky sub-nav scroll-spy: highlights whichever section a pill
     bar points to is currently in view. Targets are read from each
     link's own href, so this works for any set of sections (the
     grouped service cards, or a plain page section) without the
     sections needing a specific class. */
  $$('.service-subnav').forEach(subnav => {
    const subnavLinks = $$('a', subnav);
    const targets = subnavLinks
      .map(a => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);
    if (reduceMotion || !targets.length || !('IntersectionObserver' in window)) return;
    const setActiveGroup = (id) => {
      subnavLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    };
    const groupObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveGroup(entry.target.id);
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    targets.forEach(t => groupObserver.observe(t));
  });

  /* FAQ accordion */
  $$('.faq-item').forEach((item, i) => {
    const btn = $('.faq-question', item);
    const answer = $('.faq-answer', item);
    if (!btn || !answer) return;
    const answerId = answer.id || `faq-answer-${i}`;
    answer.id = answerId;
    answer.setAttribute('role', 'region');
    btn.setAttribute('aria-controls', answerId);
    const initiallyOpen = item.classList.contains('is-open');
    btn.setAttribute('aria-expanded', String(initiallyOpen));
    answer.hidden = !initiallyOpen;
    btn.id = btn.id || `faq-question-${i}`;
    answer.setAttribute('aria-labelledby', btn.id);
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      item.parentElement.querySelectorAll('.faq-item.is-open').forEach(other => {
        if (other !== item) {
          other.classList.remove('is-open');
          const otherAnswer = $('.faq-answer', other);
          if (otherAnswer.contains(document.activeElement)) btn.focus();
          otherAnswer.hidden = true;
          $('.faq-question', other).setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (isOpen && answer.contains(document.activeElement)) btn.focus();
      answer.hidden = isOpen;
    });
  });
  document.documentElement.classList.add('faq-ready');

  /* Testimonial carousel */
  $$('.testimonial-track-wrap').forEach(wrap => {
    const track = $('.testimonial-track', wrap);
    if (!track) return;
    const cards = $$('.testimonial-card', track);
    if (!cards.length) return;
    const controls = wrap.parentElement.querySelector('.testimonial-controls');
    const [prev, next] = controls ? $$('button', controls) : [];
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    if (!wrap.hasAttribute('aria-label')) wrap.setAttribute('aria-label', 'Opiniones de clientes');
    wrap.style.overflowX = 'auto';
    wrap.style.scrollSnapType = 'x mandatory';
    cards.forEach(card => card.style.scrollSnapAlign = 'start');
    const maxScroll = () => Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const positions = () => {
      const start = wrap.getBoundingClientRect().left + wrap.clientLeft;
      const padding = parseFloat(getComputedStyle(wrap).scrollPaddingLeft) || 0;
      return cards.map(card => Math.max(0, Math.min(maxScroll(),
        card.getBoundingClientRect().left - start + wrap.scrollLeft - padding)));
    };
    const update = () => {
      if (prev) prev.disabled = wrap.scrollLeft <= 1;
      if (next) next.disabled = wrap.scrollLeft >= maxScroll() - 1;
    };
    const scrollTo = left => wrap.scrollTo({ left, behavior: reduceMotion ? 'instant' : 'smooth' });
    const move = direction => {
      const stops = positions();
      const target = direction > 0
        ? stops.find(left => left > wrap.scrollLeft + 1)
        : stops.reverse().find(left => left < wrap.scrollLeft - 1);
      scrollTo(target ?? (direction > 0 ? maxScroll() : 0));
    };
    prev?.addEventListener('click', () => move(-1));
    next?.addEventListener('click', () => move(1));
    const onKeydown = e => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ||
          e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Home') scrollTo(0);
      else if (e.key === 'End') scrollTo(maxScroll());
      else move(e.key === 'ArrowRight' ? 1 : -1);
    };
    wrap.addEventListener('keydown', onKeydown);
    controls?.addEventListener('keydown', onKeydown);
    wrap.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(update);
      observer.observe(wrap);
      cards.forEach(card => observer.observe(card));
    }
    update();
  });

  $$('.service-card.is-flip').forEach(card => {
    let timer = null;
    card.addEventListener('touchstart', () => {
      if (card.classList.contains('is-touched')) return;
      card.classList.add('is-touched');
      clearTimeout(timer);
      timer = setTimeout(() => card.classList.remove('is-touched'), 3800);
    }, { passive: true });
  });

  const topBtn = $('.float-btn.top');
  if (topBtn) {
    const ringFill = $('.progress-ring-fill', topBtn);
    const circumference = ringFill ? 2 * Math.PI * ringFill.r.baseVal.value : 0;
    if (ringFill) ringFill.style.strokeDasharray = String(circumference);
    const onScroll = () => {
      const visible = window.scrollY > 500;
      if (!visible && document.activeElement === topBtn) {
        const destination = $('#main') || document.body;
        if (!destination.hasAttribute('tabindex')) {
          destination.setAttribute('tabindex', '-1');
          destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), { once: true });
        }
        destination.focus({ preventScroll: true });
      }
      topBtn.hidden = !visible;
      topBtn.classList.toggle('is-visible', visible);
      if (ringFill) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        ringFill.style.strokeDashoffset = String(circumference * (1 - pct));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' }));
  }

  /* Footer year */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  /* Cookie consent */
  (() => {
    const STORAGE_KEY = 'cvg-cookie-consent';
    const banner = $('#cookie-banner');
    if (!banner) return;

    const prefsBtn = $('#cookie-prefs-btn');
    const prefsPanel = $('#cookie-prefs-panel');
    const mapsCheckbox = $('#cookie-pref-maps');
    const reopenBtn = $('#cookie-reopen-btn');

    const getConsent = () => {
      try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return value && typeof value === 'object' && !Array.isArray(value) &&
          value.necessary === true && typeof value.maps === 'boolean' &&
          Number.isFinite(value.ts) && value.ts > 0 ? value : null;
      } catch { return null; }
    };
    let consent = getConsent();
    let returnFocus = null;
    const focusElement = el => {
      if (!el?.isConnected || el.disabled || el.closest('[hidden], [inert]') || !el.getClientRects().length) return false;
      el.focus({ preventScroll: true });
      return document.activeElement === el;
    };
    const focusFallback = () => {
      if (focusElement(reopenBtn)) return;
      const destination = $('#main') || document.body;
      if (!destination.hasAttribute('tabindex')) {
        destination.setAttribute('tabindex', '-1');
        destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), { once: true });
      }
      focusElement(destination);
    };
    const applyMaps = maps => {
      if (mapsCheckbox) mapsCheckbox.checked = maps;
      $$('[data-map-consent] iframe[data-src]').forEach(f => {
        const ph = f.parentElement.querySelector('.map-placeholder');
        if (maps) {
          if (!f.hasAttribute('src')) f.src = f.getAttribute('data-src');
          f.hidden = false;
          if (ph?.contains(document.activeElement) && !focusElement(f)) focusFallback();
          if (ph) ph.hidden = true;
        } else {
          if (ph) ph.hidden = false;
          if (document.activeElement === f && !focusElement(ph?.querySelector('button, a[href]'))) focusFallback();
          f.removeAttribute('src');
          f.hidden = true;
        }
      });
    };
    const setConsent = maps => {
      consent = { necessary: true, maps, ts: Date.now() };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(consent)); } catch {}
      applyMaps(maps);
    };
    const openBanner = trigger => {
      if (banner.hidden) returnFocus = trigger || null;
      if (mapsCheckbox) mapsCheckbox.checked = consent?.maps === true;
      banner.hidden = false;
      if (trigger) focusElement(prefsBtn || $('button, a[href]', banner));
    };
    const closeBanner = () => {
      if (reopenBtn) reopenBtn.hidden = false;
      if (banner.contains(document.activeElement)) {
        if (!focusElement(returnFocus)) focusFallback();
        if (banner.contains(document.activeElement)) return;
      }
      banner.hidden = true;
      if (prefsPanel) prefsPanel.hidden = true;
      if (prefsBtn) prefsBtn.setAttribute('aria-expanded', 'false');
      returnFocus = null;
    };

    if (reopenBtn) reopenBtn.hidden = false;
    applyMaps(consent?.maps === true);
    if (consent) closeBanner();
    else openBanner();

    $('#cookie-accept-btn')?.addEventListener('click', () => {
      setConsent(true);
      closeBanner();
    });
    $('#cookie-reject-btn')?.addEventListener('click', () => {
      setConsent(false);
      closeBanner();
    });
    prefsBtn?.addEventListener('click', () => {
      if (!prefsPanel) return;
      const nowHidden = !prefsPanel.hidden;
      if (nowHidden && prefsPanel.contains(document.activeElement)) focusElement(prefsBtn);
      prefsPanel.hidden = nowHidden;
      prefsBtn.setAttribute('aria-expanded', String(!nowHidden));
    });
    $('#cookie-save-prefs-btn')?.addEventListener('click', () => {
      setConsent(mapsCheckbox?.checked === true);
      closeBanner();
    });
    reopenBtn?.addEventListener('click', () => openBanner(reopenBtn));
    $$('.cookie-manage-btn').forEach(btn => btn.addEventListener('click', () => openBanner(btn)));
    $$('.map-load-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setConsent(true);
        if (!banner.hidden) closeBanner();
      });
    });
    window.addEventListener('storage', e => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      consent = getConsent();
      applyMaps(consent?.maps === true);
      if (!consent) openBanner();
    });
  })();

  /* Contact form */
  const form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      let firstInvalid = null;
      $$('[required]', form).forEach(field => {
        const wrapper = field.closest('.field');
        const ok = field.validity.valid && field.value.trim().length > 0;
        wrapper?.classList.toggle('has-error', !ok);
        field.setAttribute('aria-invalid', String(!ok));
        if (!ok) { valid = false; firstInvalid = firstInvalid || field; }
      });
      if (!valid) { firstInvalid.focus(); return; }

      const name = form.querySelector('[name="nombre"]').value.trim();
      const email = form.querySelector('[name="email"]').value.trim();
      const phone = form.querySelector('[name="telefono"]')?.value.trim() || '';
      const message = form.querySelector('[name="mensaje"]').value.trim();
      const subject = encodeURIComponent(`Contacto web — ${name}`);
      const body = encodeURIComponent(
        `Nombre: ${name}\nEmail: ${email}\nTeléfono: ${phone}\n\nMensaje:\n${message}`
      );

      const status = $('#contact-status');
      if (status) status.textContent = 'Intentando abrir tu aplicación de correo. El mensaje no se ha enviado: revisa el borrador y envíalo desde allí. Si no se abre, escribe a gavavet@gavavet.es. Tus datos siguen en el formulario.';

      window.location.href = `mailto:gavavet@gavavet.es?subject=${subject}&body=${body}`;
    });

    $$('[required]', form).forEach(field => {
      field.addEventListener('invalid', () => {
        field.closest('.field')?.classList.add('has-error');
        field.setAttribute('aria-invalid', 'true');
      });
      field.addEventListener('input', () => {
        field.closest('.field')?.classList.remove('has-error');
        field.removeAttribute('aria-invalid');
        const status = $('#contact-status');
        if (status) status.textContent = '';
      });
    });
  }
})();
