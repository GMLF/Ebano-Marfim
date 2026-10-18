(() => {
  'use strict';

  const guestView = document.getElementById('guestView');
  const accountView = document.getElementById('accountView');
  if (!guestView || !accountView || !window.emAuth) return;

  const configWarning = document.getElementById('configWarning');
  if (!window.emAuth.isConfigured) configWarning.hidden = false;

  document.querySelectorAll('[data-toggle-pass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.setAttribute('aria-label', input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
    });
  });

  const tabs = document.querySelectorAll('.auth-tabs button');
  const forms = document.querySelectorAll('.auth-form');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      forms.forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.auth-form[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  const fmt = n => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ordersBox = document.getElementById('accountOrders');
  const STATUS_LABEL = { pendente: 'Pendente', pago: 'Pago', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };

  /* esteira de acompanhamento — Pago → Enviado → Entregue, fica verde
     conforme avança. "pendente" ainda não passou do primeiro passo;
     "cancelado" não faz sentido numa esteira, mostra como estado à parte. */
  const TRACKER_STEPS = [
    { key: 'pago', label: 'Pago', icon: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M6.5 14.5h4"/>' },
    { key: 'enviado', label: 'Enviado', icon: '<path d="M3 8.5L12 4l9 4.5-9 4.5-9-4.5z"/><path d="M3 8.5V16l9 4.5 9-4.5V8.5"/><path d="M12 13v7.5"/>' },
    { key: 'entregue', label: 'Entregue', icon: '<path d="M3 11l9-7 9 7"/><path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9"/>' }
  ];
  const STATUS_ORDER = ['pendente', 'pago', 'enviado', 'entregue'];
  function pedidoTrackerHtml(o) {
    if (o.status === 'cancelado') {
      return `<div class="status-badge status-cancelado" style="margin-top:12px;">Pedido cancelado</div>`;
    }
    const atual = STATUS_ORDER.indexOf(o.status);
    return `<div class="checkout-steps" style="margin:14px 0 0;" aria-label="Status do pedido: ${STATUS_LABEL[o.status] || 'Pendente'}">
      ${TRACKER_STEPS.map((step, i) => {
        const alvo = i + 1; // pago=1, enviado=2, entregue=3 no STATUS_ORDER
        const done = atual > alvo || (alvo === TRACKER_STEPS.length && atual === alvo);
        const active = atual === alvo && !done;
        const cls = ['checkout-step-pill'];
        if (active) cls.push('active');
        if (done) cls.push('done');
        const linha = i > 0 ? `<span class="step-line${atual >= alvo ? ' done' : ''}"></span>` : '';
        return `${linha}<div class="${cls.join(' ')}">
          <span class="step-dot">
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${step.icon}</svg>
            <svg class="step-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>
          </span>
          <span class="step-label">${step.label}</span>
        </div>`;
      }).join('')}
    </div>
    ${o.tracking_code ? `<p style="font-size:.8rem; color:var(--text-faint); margin-top:8px;">Rastreio: ${o.tracking_code}</p>` : ''}
    ${o.status === 'enviado' ? `<button type="button" class="btn btn-sm btn-ghost confirmar-recebimento-btn" data-order-id="${o.id}" style="margin-top:8px;">Recebi meu pedido</button>` : ''}`;
  }

  function estrelasHtml(o) {
    if (o.status !== 'entregue') return '';
    if (o.rating) {
      return `<div class="order-rating" aria-label="Sua avaliação: ${o.rating} de 5 estrelas">
        ${[1, 2, 3, 4, 5].map(n => `<span class="star${n <= o.rating ? ' filled' : ''}">★</span>`).join('')}
      </div>`;
    }
    return `<div class="order-rating order-rating-input" data-order-id="${o.id}">
      <span class="order-rating-label">Avalie seu pedido:</span>
      ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-nota="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}
    </div>`;
  }

  /* avaliação por produto (diferente da nota do pedido inteiro acima) —
     uma por item do pedido, fica pública na página do produto */
  function produtosAvaliacaoHtml(o, minhasAvaliacoes) {
    if (o.status !== 'entregue') return '';
    const vistos = new Set();
    return o.items.filter(i => (vistos.has(i.id) ? false : vistos.add(i.id))).map(i => {
      const existente = minhasAvaliacoes.find(r => r.order_id === o.id && r.product_id === i.id);
      if (existente) {
        return `<div class="product-review-row">
          <span class="product-review-name">${i.name}</span>
          <div class="order-rating" aria-label="Sua avaliação de ${i.name}: ${existente.rating} de 5 estrelas">
            ${[1, 2, 3, 4, 5].map(n => `<span class="star${n <= existente.rating ? ' filled' : ''}">★</span>`).join('')}
          </div>
          ${existente.comment ? `<p class="product-review-comment">"${existente.comment}"</p>` : ''}
        </div>`;
      }
      return `<div class="product-review-row product-review-input" data-order-id="${o.id}" data-product-id="${i.id}">
        <span class="product-review-name">Avaliar ${i.name}:</span>
        <div class="order-rating order-rating-input">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star-btn" data-nota="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <textarea class="product-review-text" placeholder="Conte como foi (opcional)" rows="2" hidden></textarea>
        <button type="button" class="btn btn-sm btn-accent product-review-submit" hidden>Enviar avaliação</button>
      </div>`;
    }).join('');
  }

  async function renderOrders() {
    if (!ordersBox) return;
    const [orders, minhasAvaliacoes] = await Promise.all([
      window.emAuth.getOrders(),
      window.emAuth.getMyProductReviews()
    ]);
    if (!orders.length) {
      ordersBox.innerHTML = '<p style="margin-top:8px;">Você ainda não fez nenhum pedido por aqui.</p>';
      return;
    }
    ordersBox.innerHTML = orders.map(o => `
      <div class="order-history-item">
        <div class="order-history-head">
          <span>Pedido nº ${o.order_number}</span>
          <span>${new Date(o.created_at).toLocaleDateString('pt-BR')}</span>
        </div>
        <div class="order-history-body">
          ${o.items.map(i => `<span>${i.name} · frasco ${i.ml}ml ×${i.qty}</span>`).join('')}
        </div>
        <div class="order-history-foot">
          <span class="status-badge status-${o.status || 'pendente'}">${STATUS_LABEL[o.status] || 'Pendente'}</span>
          <span>${o.payment_method === 'pix' ? 'Pix' : 'Cartão'} · ${fmt(o.subtotal)}</span>
        </div>
        ${pedidoTrackerHtml(o)}
        ${estrelasHtml(o)}
        ${produtosAvaliacaoHtml(o, minhasAvaliacoes)}
      </div>
    `).join('');

    ordersBox.querySelectorAll('.order-rating-input .star-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const inputRow = btn.closest('.product-review-input');
        if (inputRow) {
          // avaliação de produto: marca a nota e revela comentário + botão de enviar
          inputRow.dataset.nota = btn.dataset.nota;
          inputRow.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('filled', Number(b.dataset.nota) <= Number(btn.dataset.nota)));
          inputRow.querySelector('.product-review-text').hidden = false;
          inputRow.querySelector('.product-review-submit').hidden = false;
          return;
        }
        // avaliação do pedido inteiro (comportamento original)
        const wrapper = btn.closest('.order-rating-input');
        const orderId = wrapper.dataset.orderId;
        const nota = Number(btn.dataset.nota);
        wrapper.querySelectorAll('.star-btn').forEach(b => { b.disabled = true; });
        const result = await window.emAuth.avaliarPedido(orderId, nota);
        if (result.error) {
          alert('Não deu pra registrar sua avaliação: ' + result.error);
          wrapper.querySelectorAll('.star-btn').forEach(b => { b.disabled = false; });
          return;
        }
        renderOrders(); // recarrega pra já mostrar a nota salva
      });
    });

    ordersBox.querySelectorAll('.product-review-submit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.product-review-input');
        const nota = Number(row.dataset.nota);
        if (!nota) { alert('Clique nas estrelas pra dar uma nota antes de enviar.'); return; }
        const comentario = row.querySelector('.product-review-text').value.trim();
        const email = document.getElementById('accountEmail').textContent || '';
        const nome = email.split('@')[0] || 'Cliente';
        btn.disabled = true;
        const result = await window.emAuth.avaliarProduto(row.dataset.orderId, row.dataset.productId, nota, comentario, nome);
        if (result.error) {
          alert('Não deu pra registrar sua avaliação: ' + result.error);
          btn.disabled = false;
          return;
        }
        renderOrders(); // recarrega pra já mostrar a avaliação salva
      });
    });

    ordersBox.querySelectorAll('.confirmar-recebimento-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Confirma que esse pedido já chegou na sua casa?')) return;
        btn.disabled = true;
        const result = await window.emAuth.confirmarRecebimento(btn.dataset.orderId);
        if (result.error) {
          alert('Não deu pra confirmar: ' + result.error);
          btn.disabled = false;
          return;
        }
        renderOrders(); // recarrega pra já mostrar "Entregue"
      });
    });
  }

  let unsubscribeOrders = null;
  function showAccount(session) {
    guestView.hidden = true;
    accountView.classList.add('active');
    const email = session.user.email || '';
    document.getElementById('accountEmail').textContent = email;
    document.getElementById('accountAvatar').textContent = email.charAt(0).toUpperCase() || 'É';
    renderOrders();
    window.emAuth.isAdmin().then(admin => {
      const adminLink = document.getElementById('adminLink');
      if (adminLink) adminLink.hidden = !admin;
    });
    // esteira atualiza sozinha quando o admin muda o status de um pedido,
    // sem precisar recarregar a página (evita empilhar inscrição repetida)
    if (unsubscribeOrders) unsubscribeOrders();
    unsubscribeOrders = window.emAuth.subscribeToMyOrders(renderOrders);
  }
  function showGuest() {
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    guestView.hidden = false;
    accountView.classList.remove('active');
  }

  window.emAuth.getSession().then(session => { if (session) showAccount(session); });
  window.emAuth.onChange(session => { if (session) showAccount(session); else showGuest(); });

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('loginMsg');
    msg.classList.remove('err');
    msg.textContent = 'Entrando...';
    const { error } = await window.emAuth.signIn(
      document.getElementById('loginEmail').value.trim(),
      document.getElementById('loginPassword').value
    );
    if (error) { msg.textContent = error; msg.classList.add('err'); }
    else { msg.textContent = ''; location.reload(); }
  });

  document.getElementById('signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('signupMsg');
    msg.classList.remove('err');
    msg.textContent = 'Criando conta...';
    const { error } = await window.emAuth.signUp(
      document.getElementById('signupEmail').value.trim(),
      document.getElementById('signupPassword').value
    );
    if (error) { msg.textContent = error; msg.classList.add('err'); }
    else { msg.textContent = 'Conta criada! Confira seu e-mail para confirmar o cadastro.'; }
  });

  document.getElementById('forgotForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('forgotMsg');
    msg.classList.remove('err');
    msg.textContent = 'Enviando...';
    const { error } = await window.emAuth.resetPassword(document.getElementById('forgotEmail').value.trim());
    if (error) { msg.textContent = error; msg.classList.add('err'); }
    else { msg.textContent = 'Se esse e-mail tiver uma conta, o link de recuperação já foi enviado.'; }
  });

  document.getElementById('googleBtn').addEventListener('click', async () => {
    const { error } = await window.emAuth.signInWithGoogle();
    if (error) alert(error);
  });

  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await window.emAuth.signOut();
    showGuest();
  });
})();
