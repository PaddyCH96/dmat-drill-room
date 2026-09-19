/* ---------------------------------------------------------------------------
 * ai.js — the "Explain it differently" helper.
 *
 * Three ways it can run, in order of preference:
 *   1. "claude"   — the page is published as a Claude artifact with the
 *                   `sample` capability; Claude answers and the viewer pays.
 *   2. "key"      — the person pasted their own API key in Settings. The key
 *                   is kept in this browser only: it is never synced, never
 *                   part of the backup code, and never leaves the browser
 *                   except in the request to the provider they chose.
 *   3. "none"     — no explanation button is shown at all.
 * ------------------------------------------------------------------------- */
const AI_PROVIDERS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-5',
    defaultBase: 'https://api.anthropic.com',
    keyHint: 'Starts with sk-ant-. Create one at console.anthropic.com.',
    async call(cfg, prompt) {
      const res = await fetch(cfg.base.replace(/\/$/, '') + '/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: cfg.model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw httpError(res.status, data);
      return (data.content || []).map((b) => b.text || '').join('').trim();
    },
  },
  openai: {
    label: 'OpenAI-compatible (OpenAI, Groq, Ollama, LM Studio …)',
    defaultModel: 'gpt-4o-mini',
    defaultBase: 'https://api.openai.com/v1',
    keyHint: 'Any endpoint that speaks the /chat/completions API. For a local server (Ollama, LM Studio) the key can be anything.',
    async call(cfg, prompt) {
      const res = await fetch(cfg.base.replace(/\/$/, '') + '/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw httpError(res.status, data);
      return ((data.choices || [{}])[0].message || {}).content || '';
    },
  },
};
function httpError(status, data) {
  const detail = (data && data.error && (data.error.message || data.error.type)) || '';
  const msg = status === 401 || status === 403 ? 'The API key was refused. Check it in Settings.'
    : status === 404 ? 'That model or endpoint was not found. Check the model name and base URL.'
    : status === 429 ? 'The provider is rate-limiting you. Wait a moment and try again.'
    : status >= 500 ? 'The provider had a server error. Try again shortly.'
    : `The request failed (${status}).`;
  const e = new Error(detail ? `${msg} (${detail})` : msg);
  e.status = status;
  return e;
}

const AI = {
  mode: 'none',
  sample: null,
  cfg() {
    const c = store.get('ai', {}) || {};
    const p = AI_PROVIDERS[c.provider];
    return p ? { provider: c.provider, key: c.key || '', model: c.model || p.defaultModel, base: c.base || p.defaultBase } : null;
  },
  available() { return this.mode !== 'none'; },
  how() {
    return this.mode === 'claude' ? 'Claude answers these through this artifact.'
      : this.mode === 'key' ? `Using your own ${AI_PROVIDERS[this.cfg().provider].label} key, stored in this browser.`
      : 'Not set up.';
  },
  async init() {
    try {
      if (window.claude && window.claude.use) {
        const s = await window.claude.use('sample');
        if (s) { this.sample = s; this.mode = 'claude'; }
      }
    } catch (e) { /* not running as an artifact */ }
    this.refresh();
    if (!session) render();
  },
  refresh() {
    if (this.sample) { this.mode = 'claude'; return; }
    const c = this.cfg();
    this.mode = c && c.key && c.model ? 'key' : 'none';
  },
  /** Ask for an explanation. `onText` receives the answer so far, when streaming is available. */
  async ask(prompt, onText) {
    if (this.mode === 'claude') {
      const r = await this.sample(prompt, onText ? { onText: ({ text }) => onText(text) } : undefined);
      return r.text;
    }
    const c = this.cfg();
    if (!c) throw new Error('No explanation provider is set up.');
    try {
      return await AI_PROVIDERS[c.provider].call(c, prompt);
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Could not reach the provider. Check your connection, the base URL, and whether the provider allows requests from the browser.');
      throw e;
    }
  },
};
