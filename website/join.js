/* Beta signup interaction.
 *
 * Progressive by design: the markup ships with the form present and the
 * trigger button visible. If this file never loads, the page still reads and
 * the form still posts nowhere harmful — but with it, the button morphs into
 * a single-field pill and submits over fetch.
 *
 * No secrets here. This talks to /api/subscribe, which owns the credentials.
 */
(() => {
  'use strict';

  // Root-absolute: this file is loaded from both / and /en/, and a relative
  // path would resolve to /en/api/subscribe on the English page.
  const ENDPOINT = '/api/subscribe';
  const STORE_KEY = 'nestup:joined';
  const LANG_KEY = 'nestup:lang';

  const HE = document.documentElement.lang === 'he';

  // Used by the server's timing check. Bots tend to submit instantly.
  const loadedAt = Date.now();

  /* Written, not translated. The Hebrew is plural-imperative throughout,
     which is how Israeli consumer copy addresses people. */
  const COPY = HE ? {
    invalid_email: 'הכתובת לא נראית תקינה. אפשר לבדוק אותה?',
    rate_limited: 'הרבה ניסיונות ברצף. נסו שוב עוד רגע.',
    storage_failed: 'משהו נתקע אצלנו. תנסו שוב בעוד רגע?',
    offline: 'נראה שאין חיבור לאינטרנט. נסו שוב אחרי שתתחברו.',
    generic: 'משהו השתבש. נסו שוב, או כתבו לנו ל-nimrodshamir@nestup.best.',
    added: (e) => `${e} ברשימה — נהיה בקשר.`,
    duplicate: (e) => `${e} כבר ברשימה.`,
    one: 'אתם ברשימה. נהיה בקשר.',
    many: (n) => `${n} כתובות נוספו מהמכשיר הזה.`,
  } : {
    invalid_email: "That address doesn't look right. Mind checking it?",
    rate_limited: 'That was a lot of tries. Give it a minute and try again.',
    storage_failed: 'Something broke on our side. Try again in a moment?',
    offline: 'You appear to be offline. Try again once you reconnect.',
    generic: 'Something went wrong. Try again, or email nimrodshamir@nestup.best.',
    added: (e) => `${e} is on the list — we'll be in touch.`,
    duplicate: (e) => `${e} is already on the list.`,
    one: "You're on the list. We'll be in touch.",
    many: (n) => `${n} addresses added from this device.`,
  };

  /* A language picked by hand outranks any detection, on this visit and every
     later one. Recorded on the way out so the destination page sees it. */
  document.querySelectorAll('[data-lang-pick]').forEach((link) => {
    link.addEventListener('click', () => {
      try {
        localStorage.setItem(LANG_KEY, link.getAttribute('data-lang-pick'));
      } catch { /* storage blocked — the link still navigates */ }
    });
  });

  /* People sign up for a partner or a friend as well as themselves, so this
     records every address this browser has submitted rather than a single
     flag. It is used to resolve the UI instantly for an address already sent
     from here — not to stop anyone adding another. */
  function submittedHere() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return []; // private mode, blocked storage, or the older single-string
    }                                        // value — neither is worth failing over
  }

  function rememberJoined(email) {
    try {
      const all = submittedHere();
      if (!all.includes(email)) all.push(email);
      localStorage.setItem(STORE_KEY, JSON.stringify(all.slice(-25)));
    } catch { /* non-fatal */ }
  }

  function setup(root) {
    const form = root.querySelector('.join-form');
    const input = root.querySelector('.join-input');
    const trigger = root.querySelector('.join-trigger');
    const msg = root.querySelector('.join-msg');
    const honeypot = root.querySelector('.join-hp input');
    if (!form || !input || !msg) return;

    const opensOnClick = root.hasAttribute('data-open-on-click');
    const again = root.querySelector('.join-again');
    let busy = false;

    const setState = (state) => root.setAttribute('data-state', state);

    const say = (text, tone) => {
      msg.textContent = text || '';
      msg.dataset.tone = tone || '';
    };

    // Reopens the field for a second person. The whole point is that the
    // resolved state is not a dead end.
    const reopen = () => {
      input.value = '';
      input.removeAttribute('aria-invalid');
      say('');
      setState('open');
      form.hidden = false;
      requestAnimationFrame(() => input.focus());
    };

    if (again) again.addEventListener('click', reopen);

    // A returning visitor sees where they left off, but the form is still one
    // click away — they may be here to add someone else.
    const previous = submittedHere();
    if (previous.length) {
      setState('done');
      form.hidden = true;
      say(
        previous.length === 1
          ? COPY.one
          : COPY.many(previous.length),
        'ok',
      );
    } else {
      setState(opensOnClick ? 'idle' : 'open');
      if (opensOnClick) form.hidden = true;
    }

    if (trigger) {
      trigger.addEventListener('click', () => {
        setState('open');
        form.hidden = false;
        // Wait a frame so the field is laid out before focus, otherwise
        // mobile Safari scrolls to the wrong place.
        requestAnimationFrame(() => input.focus({ preventScroll: false }));
      });
    }

    input.addEventListener('input', () => {
      if (msg.textContent) say('');
      input.removeAttribute('aria-invalid');
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return; // guards double-tap and Enter-key repeats

      const email = input.value.trim();

      // Cheap client check purely for feedback speed. The server revalidates.
      if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
        input.setAttribute('aria-invalid', 'true');
        say(COPY.invalid_email, 'bad');
        input.focus();
        return;
      }

      if (!navigator.onLine) {
        say(COPY.offline, 'bad');
        return;
      }

      busy = true;
      setState('sending');
      say('');

      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email,
            company: honeypot ? honeypot.value : '',
            elapsed: Date.now() - loadedAt,
            // Which page they signed up from. Useful for the pilot, and
            // ignored by older deployments of the endpoint.
            locale: HE ? 'he' : 'en',
          }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch { /* non-JSON error page; fall through to generic */ }

        if (res.ok && data.ok) {
          rememberJoined(email);
          setState('done');
          form.hidden = true;
          say(
            // Named rather than "you're", because this may not be their own
            // address. Neutral phrasing reads correctly either way.
            data.duplicate ? COPY.duplicate(email) : COPY.added(email),
            'ok',
          );
          return;
        }

        setState('open');
        say(COPY[data.error] || COPY.generic, 'bad');
        input.focus();
      } catch {
        setState('open');
        say(COPY.generic, 'bad');
      } finally {
        busy = false;
      }
    });
  }

  const start = () => document.querySelectorAll('[data-join]').forEach(setup);

  // The tag is deferred, so the DOM is normally ready by now. The guard is
  // for the case where it is not — an inlined copy, or a future move of the
  // tag into the head without `defer`.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
