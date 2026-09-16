(() => {
  'use strict';

  const gate = document.getElementById('adminGate');
  const denied = document.getElementById('adminDenied');
  const dashboard = document.getElementById('adminDashboard');
  if (!gate || !window.emAuth) return;

  const fmt = n => 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const DAY_MS = 24 * 60 * 60 * 1000;

  function renderRankList(el, rows, labelKey, valueLabel) {
    if (!rows.length) {
      el.innerHTML = '<p style="color:var(--text-faint);">Nada nesse período.</p>';
      return;
    }
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

  let allOrders = [];
  let allEvents = [];

  function filterByPeriod(list, days) {
    if (!days) return list; // 0/null = todo o histórico
    const cutoff = Date.now() - days * DAY_MS;
    return list.filter(item => new Date(item.created_at).getTime() >= cutoff);
  }

  async function renderForPeriod(days) {
    const orders = filterByPeriod(allOrders, days);
    const events = filterByPeriod(allEvents, days);

    // ---- faturamento, pedidos, acessos, visitantes únicos ----
    document.getElementById('statRevenue').textContent = fmt(orders.reduce((s, o) => s + Number(o.subtotal), 0));
    document.getElementById('statOrders').textContent = orders.length;
    const views = events.filter(e => e.event_type === 'page_view');
    document.getElementById('statViewsTotal').textContent = views.length;
    document.getElementById('statVisitorsUnique').textContent = new Set(views.map(e => e.session_id)).size;
    document.getElementById('lastUpdated').textContent = '· atualizado agora, ' + new Date().toLocaleTimeString('pt-BR');

    // ---- pedidos recentes (dentro do período) ----
    const recentBox = document.getElementById('recentOrders');
    if (!orders.length) {
      recentBox.innerHTML = '<p style="color:var(--text-faint);">Nenhum pedido nesse período.</p>';
    } else {
      recentBox.innerHTML = orders.slice(0, 10).map(o => `
        <div class="order-summary-item">
          <span>#${o.order_number} · ${new Date(o.created_at).toLocaleDateString('pt-BR')} · ${o.payment_method === 'pix' ? 'Pix' : 'Cartão'}</span>
          <span>${fmt(o.subtotal)}</span>
        </div>
      `).join('');
    }

    // ---- perfumes mais vendidos ----
    const qtyByProduct = new Map();
    orders.forEach(o => (o.items || []).forEach(i => {
      qtyByProduct.set(i.name, (qtyByProduct.get(i.name) || 0) + (i.qty || 1));
    }));
    const topProductsRows = Array.from(qtyByProduct, ([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
    renderRankList(document.getElementById('topProducts'), topProductsRows, 'key', 'vendidos');

    // ---- buscas e cliques mais frequentes ----
    const searches = events.filter(e => e.event_type === 'search');
    renderRankList(document.getElementById('topSearches'), countBy(searches, e => (e.payload && e.payload.term || '').toLowerCase().trim()), 'key', 'vezes');

    const productViews = events.filter(e => e.event_type === 'product_view');
    renderRankList(document.getElementById('topClicks'), countBy(productViews, e => e.payload && e.payload.name), 'key', 'cliques');

    // ---- clientes que mais compraram (consulta própria, respeitando o período) ----
    const topCustomersBox = document.getElementById('topCustomers');
    const customers = await window.emAuth.getTopCustomers(days);
    if (!customers.length) {
      topCustomersBox.innerHTML = '<p style="color:var(--text-faint);">Ainda sem clientes com pedido fechado nesse período.</p>';
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
    const counts = stages.map(([type]) => uniqueSessionsFor(type));
    const maxCount = Math.max(1, ...counts);
    document.getElementById('funnelList').innerHTML = stages.map(([, label], i) => `
      <div class="funnel-row">
        <span>${label}</span>
        <div class="quiz-bar" style="flex:1; margin:0 14px;"><i style="width:${Math.max(4, Math.round(100 * counts[i] / maxCount))}%"></i></div>
        <span>${counts[i]}</span>
      </div>
    `).join('');
  }

  function wirePeriodFilter() {
    const buttons = document.querySelectorAll('#periodFilter .pay-method');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderForPeriod(Number(btn.dataset.days));
      });
    });
  }

  async function loadDashboard() {
    [allOrders, allEvents] = await Promise.all([
      window.emAuth.getAllOrders(),
      window.emAuth.getAnalyticsEvents()
    ]);
    wirePeriodFilter();
    renderForPeriod(30); // período padrão ao abrir a página
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
