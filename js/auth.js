(() => {
  'use strict';

  const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('SEU-PROJETO') &&
    !window.SUPABASE_ANON_KEY.includes('SUA-CHAVE');

  let client = null;
  if (configured && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  const NOT_CONFIGURED_MSG = 'Login ainda não está configurado neste site — falta ligar as credenciais do Supabase (veja o README.md).';

  async function signUp(email, password) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { error } = await client.auth.signUp({ email, password });
    return { error: error ? error.message : null };
  }
  async function signIn(email, password) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }
  async function signInWithGoogle() {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname.replace(/[^/]+$/, '') + 'conta.html' }
    });
    return { error: error ? error.message : null };
  }
  async function resetPassword(email) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname.replace(/[^/]+$/, '') + 'conta.html'
    });
    return { error: error ? error.message : null };
  }
  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }
  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  }
  function onChange(cb) {
    if (!client) return;
    client.auth.onAuthStateChange((_event, session) => cb(session));
  }

  window.emAuth = {
    isConfigured: !!client,
    signUp, signIn, signInWithGoogle, resetPassword, signOut, getSession, onChange
  };

  /* reflete o estado de login no ícone de conta do cabeçalho, em todas as páginas */
  const accountBtn = document.getElementById('accountBtn');
  if (accountBtn) {
    getSession().then(session => {
      if (session) {
        accountBtn.classList.add('is-logged-in');
        accountBtn.setAttribute('aria-label', `Minha conta (${session.user.email})`);
        accountBtn.title = session.user.email;
      }
    });
  }
})();
