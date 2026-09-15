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

  async function renderOrders() {
    if (!ordersBox) return;
    const orders = await window.emAuth.getOrders();
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
          ${o.items.map(i => `<span>${i.name} · ${i.size === 'full' ? 'frasco' : i.size + 'ml'} ×${i.qty}</span>`).join('')}
        </div>
        <div class="order-history-foot">
          <span>${o.payment_method === 'pix' ? 'Pix' : 'Cartão'}</span>
          <span>${fmt(o.subtotal)}</span>
        </div>
      </div>
    `).join('');
  }

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
  }
  function showGuest() {
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
