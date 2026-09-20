(() => {
  'use strict';

  const summaryItems = document.getElementById('orderSummaryItems');
  if (!summaryItems) return;

  const fmt = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function showSuccess(orderNumber, title, message, receiptUrl) {
    document.getElementById('checkoutContent').hidden = true;
    document.getElementById('simBanner').hidden = true;
    const successEl = document.getElementById('orderSuccess');
    successEl.hidden = false;
    document.getElementById('orderSuccessTitle').innerHTML = `${title} <span id="orderNumber">${orderNumber}</span>`;
    document.getElementById('orderSuccessMsg').textContent = message;
    const receiptBox = document.getElementById('orderReceiptLink');
    if (receiptBox) {
      if (receiptUrl) { receiptBox.href = receiptUrl; receiptBox.hidden = false; }
      else receiptBox.hidden = true;
    }
    successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // cliente voltando da página de pagamento da InfinitePay (ver redirect_url em criar-pagamento)
  const paramsRetorno = new URLSearchParams(location.search);
  const pedidoRetorno = paramsRetorno.get('pedido');
  if (pedidoRetorno) {
    showSuccess(
      pedidoRetorno,
      'Pedido nº',
      'Recebemos seu pedido! Assim que a InfinitePay confirmar o pagamento (geralmente na hora), a gente já começa a separar o seu envio. Você pode acompanhar o status em Minha Conta.',
      paramsRetorno.get('receipt_url')
    );
    return;
  }

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

  if (window.emAuth) window.emAuth.logEvent('checkout_start', { item_count: cart.length, subtotal });

  summaryItems.innerHTML = cart.map(i => `
    <div class="order-summary-item">
      <span>${i.name} · ${i.size === 'full' ? 'frasco' : i.size + 'ml'} ×${i.qty}</span>
      <span>${fmt(i.price * i.qty)}</span>
    </div>
  `).join('');

  const totalEl = document.getElementById('orderSummaryTotal');
  let payMethod = 'cartao';
  const PIX_DISCOUNT = 0.05;
  let frete = null; // { transportadora, servico, preco, dias }

  function currentTotal() {
    const base = payMethod === 'pix' ? subtotal * (1 - PIX_DISCOUNT) : subtotal;
    return base + (frete ? frete.preco : 0);
  }
  function renderTotal() {
    totalEl.textContent = fmt(currentTotal()) + (payMethod === 'pix' ? ' (com 5% off nos produtos)' : '');
    const freteRow = document.getElementById('freteSummaryRow');
    if (frete) {
      const row = `<span>Frete · ${frete.transportadora} ${frete.servico}</span><span>${frete.preco > 0 ? fmt(frete.preco) : 'Grátis'}</span>`;
      if (freteRow) freteRow.innerHTML = row;
      else summaryItems.insertAdjacentHTML('beforeend', `<div class="order-summary-item" id="freteSummaryRow">${row}</div>`);
    } else if (freteRow) {
      freteRow.remove();
    }
  }
  renderTotal();

  // ---- passo a passo: 1 perfumes, 2 entrega, 3 pagamento ----
  let currentStep = 1;
  let maxStepReached = 1; // até onde o cliente já validou — só deixa clicar na esteira pra voltar, não pra pular pra frente
  function showStep(n) {
    document.querySelectorAll('[data-step]').forEach(el => { el.hidden = Number(el.dataset.step) !== n; });
    if (n > maxStepReached) maxStepReached = n;
    document.querySelectorAll('[data-step-pill]').forEach(el => {
      const pillStep = Number(el.dataset.stepPill);
      el.classList.toggle('active', pillStep === n);
      el.classList.toggle('done', pillStep < n);
      el.classList.toggle('reachable', pillStep <= maxStepReached);
    });
    document.querySelectorAll('[data-step-line]').forEach(el => {
      el.classList.toggle('done', Number(el.dataset.stepLine) < n);
    });
    currentStep = n;
    document.getElementById('checkoutSteps').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function validateStep(n) {
    const fields = document.querySelectorAll(`[data-step="${n}"] input[required]`);
    for (const field of fields) {
      if (!field.checkValidity()) { field.reportValidity(); return false; }
    }
    if (n === 2 && !frete) {
      freteOpcoesEl.innerHTML = '<p style="color:var(--accent);">Calcule e escolha uma opção de frete antes de continuar.</p>';
      freteOpcoesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }
  document.querySelectorAll('[data-next-step]').forEach(btn => {
    btn.addEventListener('click', () => { if (validateStep(currentStep)) showStep(currentStep + 1); });
  });
  document.querySelectorAll('[data-prev-step]').forEach(btn => {
    btn.addEventListener('click', () => showStep(currentStep - 1));
  });
  // clicar num passo já visitado na esteira volta direto pra ele, pra confirmar algo sem usar "Voltar" várias vezes
  document.querySelectorAll('[data-step-pill]').forEach(pill => {
    pill.addEventListener('click', () => {
      const n = Number(pill.dataset.stepPill);
      if (n <= maxStepReached && n !== currentStep) showStep(n);
    });
  });
  showStep(1);

  // ---- preenche endereço/cidade/estado automaticamente a partir do CEP (ViaCEP, gratuito, sem login) ----
  const cepInput = document.getElementById('ckCep');
  let cepTimeout;
  cepInput?.addEventListener('input', () => {
    clearTimeout(cepTimeout);
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    cepTimeout = setTimeout(async () => {
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await resp.json();
        if (data.erro) return;
        document.getElementById('ckStreet').value = data.logradouro || '';
        document.getElementById('ckNeighborhood').value = data.bairro || '';
        document.getElementById('ckCity').value = data.localidade || '';
        document.getElementById('ckState').value = data.uf || '';
        document.getElementById('ckNumber').focus();
      } catch { /* sem internet ou serviço fora do ar: cliente preenche na mão, sem travar o checkout */ }
    }, 400);
  });

  const calcFreteBtn = document.getElementById('calcFreteBtn');
  const freteOpcoesEl = document.getElementById('freteOpcoes');

  // entrega feita por vocês mesmos, sem transportadora — só aparece pra quem mora em Londrina
  const ENTREGA_LOCAL = { transportadora: 'Entrega própria', servico: 'Entrega local em Londrina', preco: 0, dias: 1 };
  function ehLondrina(cidade) {
    return cidade.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim() === 'londrina';
  }

  calcFreteBtn?.addEventListener('click', async () => {
    const cep = document.getElementById('ckCep').value.replace(/\D/g, '');
    if (cep.length !== 8) {
      freteOpcoesEl.innerHTML = '<p style="color:var(--text-faint);">Digite um CEP válido (8 números) antes de calcular.</p>';
      return;
    }
    calcFreteBtn.disabled = true;
    calcFreteBtn.textContent = 'Calculando...';
    freteOpcoesEl.innerHTML = '';

    const cidade = document.getElementById('ckCity').value || '';
    const opcoes = ehLondrina(cidade) ? [ENTREGA_LOCAL] : [];

    if (window.emAuth && window.emAuth.isConfigured) {
      const result = await window.emAuth.calcularFrete(cep, cart.map(i => ({ size: i.size, qty: i.qty })));
      if (!result.error && result.opcoes) opcoes.push(...result.opcoes);
    }

    calcFreteBtn.disabled = false;
    calcFreteBtn.textContent = 'Calcular frete pro meu CEP';

    if (!opcoes.length) {
      freteOpcoesEl.innerHTML = '<p style="color:var(--text-faint);">Nenhuma opção de frete encontrada pra esse CEP ainda — o cálculo por transportadora está sendo configurado.</p>';
      return;
    }

    freteOpcoesEl.innerHTML = opcoes.map((op, i) => `
      <label class="frete-option">
        <span>
          <input type="radio" name="freteOpcao" value="${i}" ${i === 0 ? 'checked' : ''}>
          <b>${op.transportadora}</b> · ${op.servico} — ${op.dias} dia(s)
        </span>
        <span class="frete-price${op.preco === 0 ? ' is-gratis' : ''}">${op.preco > 0 ? fmt(op.preco) : 'Grátis'}</span>
      </label>
    `).join('');

    function selecionarFrete(i) {
      const op = opcoes[i];
      frete = { transportadora: op.transportadora, servico: op.servico, preco: op.preco, dias: op.dias };
      renderTotal();
    }
    freteOpcoesEl.querySelectorAll('input[name="freteOpcao"]').forEach(input => {
      input.addEventListener('change', () => selecionarFrete(Number(input.value)));
    });
    selecionarFrete(0);
  });

  document.querySelectorAll('.pay-method').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-method').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      payMethod = btn.dataset.pay;
      renderTotal();
    });
  });

  document.getElementById('checkoutForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!frete) {
      showStep(2);
      freteOpcoesEl.innerHTML = '<p style="color:var(--accent);">Calcule e escolha uma opção de frete antes de confirmar o pedido.</p>';
      freteOpcoesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const orderNumber = String(Math.floor(100000 + Math.random() * 900000));
    const finalizarBtn = document.getElementById('finalizarBtn');

    if (window.emAuth && window.emAuth.isConfigured) {
      finalizarBtn.disabled = true;
      finalizarBtn.textContent = 'Processando...';

      const { error: erroSalvar, orderId } = await window.emAuth.saveOrder({
        orderNumber,
        items: cart,
        subtotal: currentTotal(),
        paymentMethod: payMethod,
        shippingCarrier: frete.transportadora,
        shippingService: frete.servico,
        shippingPrice: frete.preco,
        shippingDays: frete.dias,
        recipientName: document.getElementById('ckName').value,
        recipientPhone: document.getElementById('ckPhone').value,
        cep: document.getElementById('ckCep').value,
        street: document.getElementById('ckStreet').value,
        number: document.getElementById('ckNumber').value,
        neighborhood: document.getElementById('ckNeighborhood').value,
        city: document.getElementById('ckCity').value,
        state: document.getElementById('ckState').value
      });

      // erro real (não é só "visitante sem login") — não finge sucesso, avisa e para
      if (erroSalvar && erroSalvar !== 'sem sessão') {
        finalizarBtn.disabled = false;
        finalizarBtn.textContent = 'Ir para pagamento seguro';
        alert('Não foi possível registrar o pedido: ' + erroSalvar);
        return;
      }

      window.emAuth.logEvent('checkout_complete', { order_number: orderNumber, subtotal: currentTotal(), payment_method: payMethod });

      if (!erroSalvar && orderId) {
        const pagamento = await window.emAuth.criarPagamento(orderId);
        if (pagamento.checkoutUrl) {
          localStorage.removeItem('em-cart');
          window.location.href = pagamento.checkoutUrl; // vai pro pagamento de verdade na InfinitePay
          return;
        }
        // InfinitePay ainda não configurado no servidor: segue como demonstração abaixo, sem travar o cliente
      }

      finalizarBtn.disabled = false;
      finalizarBtn.textContent = 'Ir para pagamento seguro';
    }

    localStorage.removeItem('em-cart');
    const cartCountEl = document.getElementById('cartCount');
    if (cartCountEl) cartCountEl.hidden = true;
    showSuccess(orderNumber, 'Pedido simulado nº', 'Isso é uma demonstração: nenhuma cobrança real foi feita. Num site em produção, você seria levado pra InfinitePay pra pagar de verdade.');
  });
})();
