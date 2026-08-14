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

  const ENDPOINT = '/api/subscribe';
  const STORE_KEY = 'nestup:joined';

  // Used by the server's timing check. Bots tend to submit instantly.
  const loadedAt = Date.now();

  const MESSAGES = {
    invalid_email: "That address doesn't look right. Mind checking it?",
    rate_limited: 'That was a lot of tries. Give it a minute and try again.',
    storage_failed: "Something broke on our side. Try again in a moment?",
    offline: 'You appear to be offline. Try again once you reconnect.',
    generic: "Something went wrong. Try again, or email hello@nestup.best.",
  };

  function alreadyJoined() {
    try {
      return localStorage.getItem(STORE_KEY) !== null;
    } catch {
      return false; // private mode, blocked storage — not worth failing over
    }
  }

  function rememberJoined(email) {
    try {
      localStorage.setItem(STORE_KEY, email);
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
    let busy = false;

    const setState = (state) => root.setAttribute('data-state', state);

    const say = (text, tone) => {
      msg.textContent = text || '';
      msg.dataset.tone = tone || '';
    };

    // Returning visitor: skip straight to the resolved state rather than
    // inviting a duplicate submission.
    if (alreadyJoined()) {
      setState('done');
      say("You're on the list. We'll be in touch.", 'ok');
      return;
    }

    setState(opensOnClick ? 'idle' : 'open');
    if (opensOnClick) form.hidden = true;

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
        say(MESSAGES.invalid_email, 'bad');
        input.focus();
        return;
      }

      if (!navigator.onLine) {
        say(MESSAGES.offline, 'bad');
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
          }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch { /* non-JSON error page; fall through to generic */ }

        if (res.ok && data.ok) {
          rememberJoined(email);
          setState('done');
          say(
            data.duplicate
              ? "You're already on the list. We'll be in touch."
              : "You're on the list. We'll email you when it's your turn.",
            'ok',
          );
          return;
        }

        setState('open');
        say(MESSAGES[data.error] || MESSAGES.generic, 'bad');
        input.focus();
      } catch {
        setState('open');
        say(MESSAGES.generic, 'bad');
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
