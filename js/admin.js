(() => {
  'use strict';

  const gate = document.getElementById('adminGate');
  const denied = document.getElementById('adminDenied');
  const dashboard = document.getElementById('adminDashboard');
  if (!gate || !window.emAuth) return;

  const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const DAY_MS = 24 * 60 * 60 * 1000;

  function since(days) {
    return Date.now() - days * DAY_MS;
  }

  function renderRankList(el, rows, labelKey, valueLabel) {
    if (!rows.length) return; // mantém o texto de "ainda sem dados" que já está no HTML
    const max = rows[0].count;
    el.innerHTML = rows.slice(0, 8).map(r => `
      <div class="rank-row">
        <span>${r[labelKey]}</span>
        <div class="quiz-bar"><i style="width:${Math.max(6, Math.round(100 * r.count / max))}%"></i></div>
        <span>${r.count} ${valueLabel}</span>
      </div>
    `).join('');
  }

  function countBy(list, keyFn) {
    const map = new Map();
    list.forEach(item => {
      const key = keyFn(item);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  }

  async function loadDashboard() {
    const [orders, events] = await Promise.all([
      window.emAuth.getAllOrders(),
      window.emAuth.getAnalyticsEvents()
    ]);

    // ---- faturamento e pedidos ----
    const revenueSince = days => orders.filter(o => new Date(o.created_at).getTime() >= since(days)).reduce((s, o) => s + Number(o.subtotal), 0);
    const ordersSince = days => orders.filter(o => new Date(o.created_at).getTime() >= since(days)).length;

    document.getElementById('statRevenueToday').textContent = fmt(revenueSince(1));
    document.getElementById('statRevenueWeek').textContent = fmt(revenueSince(7));
    document.getElementById('statRevenueMonth').textContent = fmt(revenueSince(30));
    document.getElementById('statOrdersToday').textContent = ordersSince(1);
    document.getElementById('statOrdersWeek').textContent = ordersSince(7);
    document.getElementById('statOrdersMonth').textContent = ordersSince(30);

    // ---- acessos (page_view) e visitantes únicos, últimos 30 dias ----
    const views30 = events.filter(e => e.event_type === 'page_view' && new Date(e.created_at).getTime() >= since(30));
    document.getElementById('statViewsTotal').textContent = views30.length;
    document.getElementById('statVisitorsUnique').textContent = new Set(views30.map(e => e.session_id)).size;
    document.getElementById('lastUpdated').textContent = '· atualizado agora, ' + new Date().toLocaleTimeString('pt-BR');

    // ---- pedidos recentes ----
    const recentBox = document.getElementById('recentOrders');
    if (!orders.length) {
      recentBox.innerHTML = '<p style="color:var(--text-faint);">Nenhum pedido ainda.</p>';
    } else {
      recentBox.innerHTML = orders.slice(0, 10).map(o => `
        <div class="order-summary-item">
          <span>#${o.order_number} · ${new Date(o.created_at).toLocaleDateString('pt-BR')} · ${o.payment_method === 'pix' ? 'Pix' : 'Cartão'}</span>
          <span>${fmt(o.subtotal)}</span>
        </div>
      `).join('');
    }

    // ---- perfumes mais vendidos (soma as quantidades dentro de items de cada pedido) ----
    const qtyByProduct = new Map();
    orders.forEach(o => (o.items || []).forEach(i => {
      qtyByProduct.set(i.name, (qtyByProduct.get(i.name) || 0) + (i.qty || 1));
    }));
    const topProductsRows = Array.from(qtyByProduct, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    renderRankList(document.getElementById('topProducts'), topProductsRows, 'key', 'vendidos');

    // ---- buscas mais frequentes ----
    const searches = events.filter(e => e.event_type === 'search');
    const topSearchRows = countBy(searches, e => (e.payload && e.payload.term || '').toLowerCase().trim());
    renderRankList(document.getElementById('topSearches'), topSearchRows, 'key', 'vezes');

    // ---- produtos mais clicados (quick view) ----
    const views = events.filter(e => e.event_type === 'product_view');
    const topClickRows = countBy(views, e => e.payload && e.payload.name);
    renderRankList(document.getElementById('topClicks'), topClickRows, 'key', 'cliques');

    // ---- clientes que mais compraram ----
    const customers = await window.emAuth.getTopCustomers();
    const topCustomersBox = document.getElementById('topCustomers');
    if (!customers.length) {
      topCustomersBox.innerHTML = '<p style="color:var(--text-faint);">Ainda sem clientes com pedido fechado.</p>';
    } else {
      const maxSpent = Number(customers[0].total_spent);
      topCustomersBox.innerHTML = customers.slice(0, 8).map(c => `
        <div class="rank-row">
          <span>${c.email}</span>
          <div class="quiz-bar"><i style="width:${Math.max(6, Math.round(100 * c.total_spent / maxSpent))}%"></i></div>
          <span>${fmt(c.total_spent)} · ${c.order_count}x</span>
        </div>
      `).join('');
    }

    // ---- funil: quantas sessões únicas chegaram em cada etapa ----
    const stages = [
      ['page_view', 'Visitou o site'],
      ['search', 'Buscou alguma coisa'],
      ['product_view', 'Abriu um perfume'],
      ['add_to_cart', 'Adicionou à seleção'],
      ['checkout_start', 'Chegou no checkout'],
      ['checkout_complete', 'Fechou o pedido']
    ];
    const uniqueSessionsFor = type => new Set(events.filter(e => e.event_type === type).map(e => e.session_id)).size;
    const funnelBox = document.getElementById('funnelList');
    const counts = stages.map(([type]) => uniqueSessionsFor(type));
    const maxCount = Math.max(1, ...counts);
    funnelBox.innerHTML = stages.map(([, label], i) => `
      <div class="funnel-row">
        <span>${label}</span>
        <div class="quiz-bar" style="flex:1; margin:0 14px;"><i style="width:${Math.max(4, Math.round(100 * counts[i] / maxCount))}%"></i></div>
        <span>${counts[i]}</span>
      </div>
    `).join('');
  }

  (async () => {
    const session = await window.emAuth.getSession();
    const admin = session ? await window.emAuth.isAdmin() : false;
    gate.hidden = true;
    if (!admin) { denied.hidden = false; return; }
    dashboard.hidden = false;
    loadDashboard();
  })();
})();
