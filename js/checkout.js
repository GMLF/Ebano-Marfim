(() => {
  'use strict';

  const summaryItems = document.getElementById('orderSummaryItems');
  if (!summaryItems) return;

  const fmt = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function loadCart() {
    try { return JSON.parse(localStorage.getItem('em-cart')) || []; }
    catch { return []; }
  }

  const cart = loadCart();
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (!cart.length) {
    document.getElementById('checkoutContent').innerHTML =
      '<p class="drawer-empty" style="padding:60px 0;">Sua seleção está vazia. <a href="colecao.html">Ver a coleção</a>.</p>';
    return;
  }

  summaryItems.innerHTML = cart.map(i => `
    <div class="order-summary-item">
      <span>${i.name} · ${i.size === 'full' ? 'frasco' : i.size + 'ml'} ×${i.qty}</span>
      <span>${fmt(i.price * i.qty)}</span>
    </div>
  `).join('');

  const installmentsSelect = document.getElementById('ckInstallments');
  const totalEl = document.getElementById('orderSummaryTotal');
  let payMethod = 'cartao';
  const PIX_DISCOUNT = 0.05;

  function currentTotal() {
    return payMethod === 'pix' ? subtotal * (1 - PIX_DISCOUNT) : subtotal;
  }
  function renderInstallments() {
    const total = currentTotal();
    installmentsSelect.innerHTML = Array.from({ length: 6 }, (_, i) => i + 1).map(n =>
      `<option value="${n}">${n}x de ${fmt(total / n)} sem juros</option>`
    ).join('');
  }
  function renderTotal() {
    totalEl.textContent = fmt(currentTotal()) + (payMethod === 'pix' ? ' (com 5% off)' : '');
  }
  renderInstallments();
  renderTotal();

  document.querySelectorAll('.pay-method').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-method').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`.pay-panel[data-panel="${btn.dataset.pay}"]`).classList.add('active');
      payMethod = btn.dataset.pay;
      renderInstallments();
      renderTotal();
    });
  });

  const copyPixBtn = document.getElementById('copyPixBtn');
  if (copyPixBtn) {
    copyPixBtn.addEventListener('click', () => {
      const code = document.getElementById('pixCode').textContent;
      navigator.clipboard?.writeText(code).catch(() => {});
      copyPixBtn.textContent = 'copiado!';
      setTimeout(() => { copyPixBtn.textContent = 'copiar'; }, 1800);
    });
  }

  document.getElementById('checkoutForm').addEventListener('submit', async e => {
    e.preventDefault();
    const orderNumber = String(Math.floor(100000 + Math.random() * 900000));

    if (window.emAuth && window.emAuth.isConfigured) {
      window.emAuth.saveOrder({
        orderNumber,
        items: cart,
        subtotal: currentTotal(),
        paymentMethod: payMethod
      }).catch(() => {}); // checkout de visitante (sem login) simplesmente não salva histórico
    }

    localStorage.removeItem('em-cart');
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.hidden = true;

    document.getElementById('checkoutContent').hidden = true;
    document.querySelector('.sim-banner').hidden = true;
    const successEl = document.getElementById('orderSuccess');
    successEl.hidden = false;
    document.getElementById('orderNumber').textContent = orderNumber;
    successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
