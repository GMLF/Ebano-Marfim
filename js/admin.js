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

  let allOrders = [];   // vem de admin_all_orders() — já com e-mail do cliente
  let allEvents = [];

  // filtro atual: { type: 'days', value: N } ou { type: 'month', year, month }
  let currentFilter = { type: 'days', value: 30 };

  function matchesFilter(dateStr, filter) {
    const d = new Date(dateStr);
    if (filter.type === 'month') {
      return d.getFullYear() === filter.year && d.getMonth() === filter.month;
    }
    if (!filter.value) return true; // "Tudo"
    return d.getTime() >= Date.now() - filter.value * DAY_MS;
  }

  function renderForFilter() {
    const orders = allOrders.filter(o => matchesFilter(o.created_at, currentFilter));
    const events = allEvents.filter(e => matchesFilter(e.created_at, currentFilter));

    // ---- faturamento, pedidos, acessos (por usuário, não por página), páginas visualizadas ----
    document.getElementById('statRevenue').textContent = fmt(orders.reduce((s, o) => s + Number(o.subtotal), 0));
    document.getElementById('statOrders').textContent = orders.length;
    const views = events.filter(e => e.event_type === 'page_view');
    document.getElementById('statViewsTotal').textContent = new Set(views.map(e => e.session_id)).size;
    document.getElementById('statVisitorsUnique').textContent = views.length;
    const avaliados = orders.filter(o => o.rating);
    document.getElementById('statRating').textContent = avaliados.length
      ? (avaliados.reduce((s, o) => s + o.rating, 0) / avaliados.length).toFixed(1) + ' ★ (' + avaliados.length + ')'
      : '—';
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

    // ---- clientes que mais compraram (calculado no cliente, mesmo dado dos pedidos) ----
    const spentByEmail = new Map();
    orders.forEach(o => {
      const cur = spentByEmail.get(o.email) || { total_spent: 0, order_count: 0 };
      cur.total_spent += Number(o.subtotal);
      cur.order_count += 1;
      spentByEmail.set(o.email, cur);
    });
    const customers = Array.from(spentByEmail, ([email, v]) => ({ email, ...v })).sort((a, b) => b.total_spent - a.total_spent);
    const topCustomersBox = document.getElementById('topCustomers');
    if (!customers.length) {
      topCustomersBox.innerHTML = '<p style="color:var(--text-faint);">Ainda sem clientes com pedido fechado nesse período.</p>';
    } else {
      const maxSpent = customers[0].total_spent;
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

  function wireFilters() {
    const dayButtons = document.querySelectorAll('#periodFilter .pay-method');
    const monthSelect = document.getElementById('filterMonth');
    const yearSelect = document.getElementById('filterYear');

    dayButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dayButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        monthSelect.value = '';
        currentFilter = { type: 'days', value: Number(btn.dataset.days) };
        renderForFilter();
      });
    });

    function applyMonthFilter() {
      if (monthSelect.value === '') return;
      dayButtons.forEach(b => b.classList.remove('active'));
      currentFilter = { type: 'month', year: Number(yearSelect.value), month: Number(monthSelect.value) };
      renderForFilter();
    }
    monthSelect.addEventListener('change', applyMonthFilter);
    yearSelect.addEventListener('change', applyMonthFilter);
  }

  const STATUS_LABEL = { pendente: 'Pendente', pago: 'Pago', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };

  // lista completa de pedidos pra acompanhar envio — não respeita o filtro de período de cima
  // de propósito, porque um pedido pendente de semanas atrás ainda precisa aparecer aqui.
  function renderFulfillment() {
    const statusFiltro = document.getElementById('filterStatus').value;
    const lista = statusFiltro ? allOrders.filter(o => o.status === statusFiltro) : allOrders;
    const box = document.getElementById('fulfillmentList');

    if (!lista.length) {
      box.innerHTML = '<p style="color:var(--text-faint);">Nenhum pedido aqui.</p>';
      return;
    }

    box.innerHTML = lista.map(o => `
      <div class="fulfill-row">
        <div class="fulfill-row-head">
          <div>
            <b>#${o.order_number}</b>
            <span class="fulfill-meta"> · ${new Date(o.created_at).toLocaleDateString('pt-BR')} · ${o.email} · ${fmt(o.subtotal)}</span>
          </div>
          <select class="status-select status-${o.status}" data-order-id="${o.id}">
            ${Object.entries(STATUS_LABEL).map(([value, label]) => `<option value="${value}" ${value === o.status ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div class="fulfill-address">
          ${o.recipient_name || 'sem nome salvo'} · ${o.recipient_phone || 'sem telefone salvo'}<br>
          ${[o.street, o.number].filter(Boolean).join(', ')}${o.neighborhood ? ' - ' + o.neighborhood : ''}<br>
          ${[o.city, o.state].filter(Boolean).join('/')}${o.cep ? ' · CEP ' + o.cep : ''}<br>
          Envio: ${o.shipping_carrier || '—'}${o.shipping_service ? ' · ' + o.shipping_service : ''}${o.shipping_price != null ? ' · ' + (o.shipping_price > 0 ? fmt(o.shipping_price) : 'Grátis') : ''}
          ${o.rating ? `<br>Avaliação: <span class="order-rating" style="display:inline-flex;">${[1, 2, 3, 4, 5].map(n => `<span class="star${n <= o.rating ? ' filled' : ''}">★</span>`).join('')}</span>` : ''}
        </div>
      </div>
    `).join('');

    box.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const orderId = sel.dataset.orderId;
        const novoStatus = sel.value;
        sel.disabled = true;
        const result = await window.emAuth.updateOrderStatus(orderId, novoStatus);
        sel.disabled = false;
        if (result.error) {
          alert('Não deu pra atualizar o status: ' + result.error);
          sel.value = allOrders.find(o => o.id === orderId)?.status || 'pendente';
          return;
        }
        const pedido = allOrders.find(o => o.id === orderId);
        if (pedido) pedido.status = novoStatus;
        sel.className = `status-select status-${novoStatus}`;
      });
    });
  }

  async function loadDashboard() {
    [allOrders, allEvents] = await Promise.all([
      window.emAuth.getAllOrdersWithEmail(),
      window.emAuth.getAnalyticsEvents()
    ]);
    wireFilters();
    renderForFilter();
    renderFulfillment();
    document.getElementById('filterStatus').addEventListener('change', renderFulfillment);
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
