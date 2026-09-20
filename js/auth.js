(() => {
  'use strict';

  const configured = window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
    !window.SUPABASE_URL.includes('SEU-PROJETO') &&
    !window.SUPABASE_ANON_KEY.includes('SUA-CHAVE');

  let client = null;
  if (configured && window.supabase && window.supabase.createClient) {
    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  const NOT_CONFIGURED_MSG = 'Login ainda não está configurado neste site: falta ligar as credenciais do Supabase (veja o README.md).';

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

  async function saveOrder(order) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const session = await getSession();
    if (!session) return { error: 'sem sessão' }; // checkout de visitante, não é um erro real
    const { data, error } = await client.from('orders').insert({
      user_id: session.user.id,
      order_number: order.orderNumber,
      items: order.items,
      subtotal: order.subtotal,
      payment_method: order.paymentMethod,
      shipping_carrier: order.shippingCarrier,
      shipping_service: order.shippingService,
      shipping_price: order.shippingPrice,
      shipping_days: order.shippingDays,
      recipient_name: order.recipientName,
      recipient_phone: order.recipientPhone,
      cep: order.cep,
      street: order.street,
      number: order.number,
      neighborhood: order.neighborhood,
      city: order.city,
      state: order.state
    }).select('id').single();
    return { error: error ? error.message : null, orderId: data ? data.id : null };
  }
  async function getOrders() {
    if (!client) return [];
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    return error ? [] : data;
  }
  async function avaliarPedido(orderId, nota) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { error } = await client.rpc('avaliar_pedido', { pedido_id: orderId, nota });
    return { error: error ? error.message : null };
  }

  async function isAdmin() {
    if (!client) return false;
    const session = await getSession();
    if (!session) return false;
    const { data, error } = await client.rpc('is_admin');
    return !error && data === true;
  }
  async function getTopCustomers(sinceDays) {
    if (!client) return [];
    const { data, error } = await client.rpc('admin_top_customers', { since_days: sinceDays || null });
    return error ? [] : data;
  }
  async function getAllOrders() {
    if (!client) return [];
    const { data, error } = await client.from('orders').select('*').order('created_at', { ascending: false });
    return error ? [] : data;
  }
  async function getAllOrdersWithEmail() {
    if (!client) return [];
    const { data, error } = await client.rpc('admin_all_orders');
    return error ? [] : data;
  }
  async function updateOrderStatus(orderId, status) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { error } = await client.rpc('admin_update_order_status', { pedido_id: orderId, novo_status: status });
    return { error: error ? error.message : null };
  }
  async function getAnalyticsEvents() {
    if (!client) return [];
    const { data, error } = await client
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);
    return error ? [] : data;
  }

  async function calcularFrete(cepDestino, items) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { data, error } = await client.functions.invoke('calcular-frete', {
      body: { cepDestino, items }
    });
    if (error) return { error: 'Não foi possível calcular o frete agora.' };
    return data;
  }
  async function criarPagamento(orderId) {
    if (!client) return { error: NOT_CONFIGURED_MSG };
    const { data, error } = await client.functions.invoke('criar-pagamento', {
      body: { orderId }
    });
    if (error) return { error: 'Pagamento ainda não está disponível neste site.' };
    return data;
  }

  /* id anônimo por navegador — funciona mesmo sem login, pra medir até onde
     um visitante (não só clientes com conta) foi no site */
  function sessionId() {
    let id = localStorage.getItem('em-session-id');
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
      localStorage.setItem('em-session-id', id);
    }
    return id;
  }
  async function logEvent(eventType, payload) {
    if (!client) return;
    const session = await getSession();
    client.from('analytics_events').insert({
      event_type: eventType,
      payload: payload || {},
      session_id: sessionId(),
      user_id: session ? session.user.id : null
    }).then(() => {}, () => {}); // rastreamento nunca deve travar a navegação do site
  }

  window.emAuth = {
    isConfigured: !!client,
    signUp, signIn, signInWithGoogle, resetPassword, signOut, getSession, onChange,
    saveOrder, getOrders, avaliarPedido, isAdmin, getAllOrders, getAllOrdersWithEmail, updateOrderStatus, getAnalyticsEvents, logEvent, getTopCustomers, calcularFrete, criarPagamento
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
