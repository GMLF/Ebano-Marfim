(() => {
  'use strict';

  /* =========================================================
     catálogo — produtos reais (curadoria, não fabricação própria)
     PREÇOS SÃO PLACEHOLDER — editar quando os custos chegarem
     usado em: colecao.html (grade), quiz.html (recomendação),
     index.html (destaques) e no carrinho (qualquer página)
     ========================================================= */
  const PRODUCTS = [
    {
      id: 'bidaya-sex-on-the-rocks', brand: 'Bidaya Parfums', brandFilter: 'bidaya', familyFilter: 'gourmand',
      name: 'Sex on the Rocks', family: 'Oriental Vanilla · Unissex',
      img: 'assets/products/bidaya-sex-on-the-rocks.jpg', artBg: true,
      top: 'Limão siciliano, grapefruit, bergamota, tangerina, gelo, aldeídos',
      heart: 'Canela, cognac, caramelo, vanilla',
      base: 'Musgo de carvalho, fava tonka, cashmere, sândalo, âmbar, mirra',
      fullSize: 100, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['caramelo', 'vanilla', 'ambar', 'bergamota']
    },
    {
      id: 'bidaya-vanilla-porn', brand: 'Bidaya Parfums', brandFilter: 'bidaya', familyFilter: 'gourmand',
      name: 'Vanilla P*rn', family: 'Oriental Powdery Gourmand · Unissex',
      img: 'assets/products/bidaya-vanilla-porn.jpg', artBg: true,
      top: 'Coco em pó, heliotrópio, vanilla',
      heart: 'Lactonas, vanilla de Madagascar',
      base: 'Âmbar-gris, cashmere, coco, musk, palo santo, absoluto de vanilla',
      fullSize: 100, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['vanilla', 'musk', 'ambar', 'heliotropo']
    },
    {
      id: 'bidaya-ayat', brand: 'Bidaya Parfums', brandFilter: 'bidaya', familyFilter: 'chypre',
      name: 'Ayat', family: 'Floral · Unissex',
      img: 'assets/products/bidaya-ayat.jpg', artBg: true,
      top: 'Hibisco, cassis, hortelã-pimenta',
      heart: 'Rosa-damascena, vanilla, canela, ambrette',
      base: 'Âmbar, couro',
      fullSize: 100, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['rosa', 'vanilla', 'ambar', 'couro']
    },
    {
      id: 'bidaya-maktub-la-vie', brand: 'Bidaya Parfums', brandFilter: 'bidaya', familyFilter: 'amadeirado',
      name: 'Maktub La Vie', family: 'Oriental Especiado · Unissex',
      img: 'assets/products/bidaya-maktub-la-vie.jpg', artBg: true,
      top: 'Manga, frutas tropicais, limão siciliano, grapefruit, cássia',
      heart: 'Gengibre, íris, noz-moscada',
      base: 'Âmbar, musk, cedro',
      fullSize: 100, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['ambar', 'musk', 'cedro']
    },
    {
      id: 'bidaya-elliur', brand: 'Bidaya Parfums', brandFilter: 'bidaya', familyFilter: 'frutado',
      name: 'Elliur', family: 'Floral Frutado · Unissex',
      img: 'assets/products/bidaya-elliur.jpg', artBg: true,
      top: 'Cassis, hortelã, laranja, limão, citron',
      heart: 'Coentro, rosa de maio, damasco, manjericão',
      base: 'Figo, ambrette, tâmaras, cenoura',
      fullSize: 100, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['rosa']
    },
    {
      id: 'milk-drops', brand: 'Mykonos', brandFilter: 'mykonos', familyFilter: 'gourmand',
      name: 'Milk Drops', family: 'Oriental Vanilla · Unissex',
      img: 'assets/products/milk-drops.png',
      top: 'Leite, vanilla, caramelo',
      heart: 'Chá, rosa, amêndoa',
      base: 'Musk, vanilla, sândalo, cedro',
      fullSize: 50, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['leite', 'vanilla', 'caramelo', 'cha', 'amendoa', 'sandalo', 'cedro', 'musk']
    },
    {
      id: 'pink-drops', brand: 'Mykonos', brandFilter: 'mykonos', familyFilter: 'frutado',
      name: 'Pink Drops', family: 'Floral Frutado · Unissex',
      img: 'assets/products/pink-drops.png',
      top: 'Geleia de morango, caramelo, amêndoa',
      heart: 'Leite, notas amadeiradas, heliotrópio',
      base: 'Vanilla, musk branco',
      fullSize: 50, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['morango', 'caramelo', 'amendoa', 'leite', 'vanilla', 'musk-branco', 'heliotropo']
    },
    {
      id: 'cafe-drops', brand: 'Mykonos', brandFilter: 'mykonos', familyFilter: 'gourmand',
      name: 'Café Drops', family: 'Gourmand Oriental · Unissex',
      img: 'assets/products/cafe-drops.png',
      top: 'Café, orquídea, jasmim',
      heart: 'Vanilla, leite, fava tonka, caramelo',
      base: 'Âmbar, patchouli, musk',
      fullSize: 50, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['cafe', 'jasmim', 'vanilla', 'leite', 'fava-tonka', 'caramelo', 'ambar', 'patchouli', 'musk']
    },
    {
      id: 'dior-sauvage', brand: 'Dior', brandFilter: 'dior', familyFilter: 'amadeirado',
      name: 'Sauvage', family: 'Aromático Amadeirado · Masculino',
      img: 'assets/products/dior-sauvage.png',
      top: 'Pimenta da Calábria, bergamota',
      heart: 'Gerânio, lavanda, elemi, pimenta-rosa, vetiver',
      base: 'Cedro, ládano, ambroxan',
      fullSize: 100, fullPrice: 869,
      decants: { 3: 115, 5: 169, 10: 285 },
      matchNotes: ['bergamota', 'pimenta-rosa', 'vetiver', 'cedro', 'ambar']
    },
    {
      id: 'dior-homme', brand: 'Dior', brandFilter: 'dior', familyFilter: 'amadeirado',
      name: 'Dior Homme', family: 'Chypre Amadeirado · Masculino',
      img: 'assets/products/dior-homme.png',
      top: 'Bergamota, pimenta-rosa, elemi',
      heart: 'Cedro do Atlas, cashmere, patchouli',
      base: 'Vetiver, almíscar branco',
      fullSize: 100, fullPrice: 815,
      decants: { 3: 105, 5: 159, 10: 269 },
      matchNotes: ['bergamota', 'pimenta-rosa', 'cedro', 'patchouli', 'couro']
    },
    {
      id: 'lattafa-khamrah', brand: 'Lattafa', brandFilter: 'lattafa', familyFilter: 'gourmand',
      name: 'Khamrah', family: 'Gourmand Oriental · Unissex',
      img: 'assets/products/lattafa-khamrah.png',
      top: 'Canela, tâmaras',
      heart: 'Praliné, cacau',
      base: 'Vanilla, âmbar',
      fullSize: 100, fullPrice: 249,
      decants: { 3: 32, 5: 49, 10: 82 },
      matchNotes: ['caramelo', 'vanilla', 'ambar', 'cafe']
    },
    {
      id: 'lattafa-yara', brand: 'Lattafa', brandFilter: 'lattafa', familyFilter: 'gourmand',
      name: 'Yara', family: 'Oriental Vanilla · Feminino',
      img: 'assets/products/lattafa-yara.png',
      top: 'Orquídea, heliotrópio, tangerina',
      heart: 'Acorde gourmand, frutas tropicais',
      base: 'Vanilla, âmbar, musk',
      fullSize: 100, fullPrice: 199,
      decants: { 3: 26, 5: 39, 10: 66 },
      matchNotes: ['heliotropo', 'vanilla', 'ambar', 'musk', 'caramelo']
    },
    {
      id: 'lattafa-asad', brand: 'Lattafa', brandFilter: 'lattafa', familyFilter: 'amadeirado',
      name: 'Asad', family: 'Oriental Especiado · Masculino',
      img: 'assets/products/lattafa-asad.png',
      top: 'Pimenta-preta, tabaco, abacaxi',
      heart: 'Patchouli, café, íris',
      base: 'Âmbar, musk, madeiras',
      fullSize: 100, fullPrice: 209,
      decants: { 3: 27, 5: 41, 10: 69 },
      matchNotes: ['patchouli', 'cafe', 'ambar', 'musk', 'couro']
    },
    {
      id: 'lattafa-oud-mood', brand: 'Lattafa', brandFilter: 'lattafa', familyFilter: 'amadeirado',
      name: 'Oud Mood', family: 'Oriental Amadeirado · Unissex',
      img: 'assets/products/lattafa-oud-mood.png',
      top: 'Rosa, açafrão, pimenta-da-jamaica',
      heart: 'Oud, caramelo, patchouli',
      base: 'Âmbar, resinas, incenso, musk',
      fullSize: 100, fullPrice: 239,
      decants: { 3: 31, 5: 47, 10: 79 },
      matchNotes: ['rosa', 'oud', 'caramelo', 'patchouli', 'ambar', 'incenso', 'musk']
    },
    {
      id: 'mykonos-california', brand: 'Mykonos', brandFilter: 'mykonos', familyFilter: 'aquatico',
      name: 'California Signature', family: 'Aromático Aquático · Unissex',
      img: 'assets/products/mykonos-california.png',
      top: 'Tangerina, limão',
      heart: 'Lavanda, lichia, notas aquáticas, alecrim, cardamomo',
      base: 'Madeira de teca, fava tonka, vetiver',
      fullSize: 50, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['bergamota', 'vetiver', 'fava-tonka']
    },
    {
      id: 'mykonos-myego', brand: 'Mykonos', brandFilter: 'mykonos', familyFilter: 'amadeirado',
      name: 'MyEgo', family: 'Oriental Amadeirado · Unissex',
      img: 'assets/products/mykonos-myego.png',
      top: 'Uva-moscatel, pimenta-rosa, bergamota',
      heart: 'Âmbar, notas florais',
      base: 'Musk, vanilla, madeiras transparentes',
      fullSize: 50, fullPrice: 259,
      decants: { 3: 34, 5: 49, 10: 84 },
      matchNotes: ['pimenta-rosa', 'bergamota', 'ambar', 'vanilla', 'musk']
    }
  ];

  const fmt = n => 'R$ ' + n.toLocaleString('pt-BR');
  function priceOf(p, size) {
    return size === 'full' ? p.fullPrice : p.decants[size];
  }
  function sizeLabel(size) {
    return size === 'full' ? 'Frasco fechado' : `Decant ${size}ml`;
  }
  function findProduct(id) { return PRODUCTS.find(x => x.id === id); }

  /* =========================================================
     tema / linha visual (persistido) — todas as páginas
     ========================================================= */
  const root = document.documentElement;
  function applyTheme(mode) {
    if (mode === 'dark' || mode === 'light') {
      root.setAttribute('data-theme', mode);
      localStorage.setItem('em-theme', mode);
    } else {
      root.removeAttribute('data-theme');
      localStorage.removeItem('em-theme');
    }
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeBtn === mode);
    });
  }
  const savedTheme = localStorage.getItem('em-theme');
  if (savedTheme) applyTheme(savedTheme);
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme');
      applyTheme(current === btn.dataset.themeBtn ? null : btn.dataset.themeBtn);
    });
  });

  /* =========================================================
     header sticky + reveal on scroll + back to top — todas as páginas
     ========================================================= */
  const header = document.getElementById('siteHeader');
  const toTopBtn = document.getElementById('toTop');
  function onScroll() {
    if (header) header.classList.toggle('is-stuck', window.scrollY > 30);
    if (toTopBtn) toTopBtn.classList.toggle('show', window.scrollY > 600);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (toTopBtn) toTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealItems.forEach(el => io.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add('in'));
  }

  /* =========================================================
     menu mobile — todas as páginas
     ========================================================= */
  const mobileNav = document.getElementById('mobileNav');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNavClose = document.getElementById('mobileNavClose');
  if (mobileNav && hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => mobileNav.classList.add('open'));
    if (mobileNavClose) mobileNavClose.addEventListener('click', () => mobileNav.classList.remove('open'));
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileNav.classList.remove('open')));
  }

  /* =========================================================
     busca no cabeçalho — todas as páginas
     ========================================================= */
  const searchToggleBtn = document.getElementById('searchToggleBtn');
  const headerSearchForm = document.getElementById('headerSearchForm');
  const headerSearchInput = document.getElementById('headerSearchInput');
  if (searchToggleBtn && headerSearchForm && headerSearchInput) {
    searchToggleBtn.addEventListener('click', () => {
      headerSearchForm.classList.toggle('open');
      if (headerSearchForm.classList.contains('open')) headerSearchInput.focus();
    });
    document.addEventListener('click', e => {
      if (!headerSearchForm.classList.contains('open')) return;
      if (e.target.closest('#headerSearchForm') || e.target.closest('#searchToggleBtn')) return;
      headerSearchForm.classList.remove('open');
    });
    headerSearchForm.addEventListener('submit', e => {
      e.preventDefault();
      const term = headerSearchInput.value.trim();
      window.location.href = 'colecao.html' + (term ? '?buscar=' + encodeURIComponent(term) : '');
    });
  }

  /* =========================================================
     toast — todas as páginas
     ========================================================= */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(msg) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* =========================================================
     vitrine do hero (index.html) — parallax + tilt suave no mouse
     ========================================================= */
  const heroVitrine = document.getElementById('heroVitrine');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroVitrine && !reduceMotion && window.matchMedia('(min-width:901px)').matches) {
    const tiles = Array.from(heroVitrine.querySelectorAll('.vitrine-tile'));
    heroVitrine.addEventListener('mousemove', e => {
      const rect = heroVitrine.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      tiles.forEach((tile, i) => {
        const depth = (i + 1) * 6;
        tile.style.transform = `translate3d(${px * depth}px, ${py * depth}px, 0) rotateX(${py * -6}deg) rotateY(${px * 6}deg)`;
      });
    });
    heroVitrine.addEventListener('mouseleave', () => {
      tiles.forEach(tile => { tile.style.transform = ''; });
    });
  }

  /* =========================================================
     carrinho (localStorage) — todas as páginas
     ========================================================= */
  const CART_KEY = 'em-cart';
  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }
  function addToCart(productId, size) {
    const p = findProduct(productId);
    if (!p) return;
    size = size || 10;
    const cart = loadCart();
    const price = priceOf(p, size);
    const existing = cart.find(i => i.id === p.id && i.size === size);
    if (existing) existing.qty += 1;
    else cart.push({ id: p.id, name: p.name, img: p.img, size, price, qty: 1 });
    saveCart(cart);
    showToast(`${p.name} · ${sizeLabel(size)} adicionado à seleção`);
  }
  function changeQty(id, size, delta) {
    const cart = loadCart();
    const item = cart.find(i => i.id === id && i.size === size);
    if (!item) return;
    item.qty += delta;
    const filtered = item.qty <= 0 ? cart.filter(i => !(i.id === id && i.size === size)) : cart;
    saveCart(filtered);
  }
  function removeItem(id, size) {
    saveCart(loadCart().filter(i => !(i.id === id && i.size === size)));
  }

  const cartCountEl = document.getElementById('cartCount');
  const drawerItems = document.getElementById('drawerItems');
  const drawerSubtotal = document.getElementById('drawerSubtotal');

  function renderCart() {
    if (!drawerItems) return;
    const cart = loadCart();
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    if (cartCountEl) {
      cartCountEl.hidden = totalQty === 0;
      cartCountEl.textContent = totalQty;
    }

    if (!cart.length) {
      drawerItems.innerHTML = '<p class="drawer-empty">Sua seleção está vazia.<br>Escolha um decant ou um frasco fechado.</p>';
    } else {
      drawerItems.innerHTML = cart.map(i => `
        <div class="cart-item">
          <div class="cart-item-photo"><img src="${i.img}" alt="${i.name}"></div>
          <div>
            <div class="cart-item-name">${i.name}</div>
            <div class="cart-item-size">${i.size === 'full' ? 'Frasco fechado' : `Decant ${i.size}ml`}</div>
            <div class="cart-item-qty">
              <button data-qty="-1" data-id="${i.id}" data-size="${i.size}" aria-label="Diminuir quantidade">−</button>
              <span>${i.qty}</span>
              <button data-qty="1" data-id="${i.id}" data-size="${i.size}" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <div>
            <div class="cart-item-price">${fmt(i.price * i.qty)}</div>
            <button class="cart-item-remove" data-remove data-id="${i.id}" data-size="${i.size}">remover</button>
          </div>
        </div>
      `).join('');
    }
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    if (drawerSubtotal) drawerSubtotal.textContent = fmt(subtotal);
  }
  if (drawerItems) {
    drawerItems.addEventListener('click', e => {
      const qtyBtn = e.target.closest('[data-qty]');
      const removeBtn = e.target.closest('[data-remove]');
      if (qtyBtn) changeQty(qtyBtn.dataset.id, qtyBtn.dataset.size === 'full' ? 'full' : Number(qtyBtn.dataset.size), Number(qtyBtn.dataset.qty));
      if (removeBtn) removeItem(removeBtn.dataset.id, removeBtn.dataset.size === 'full' ? 'full' : Number(removeBtn.dataset.size));
    });
  }
  renderCart();

  /* =========================================================
     overlay compartilhado (modal + drawer) — todas as páginas
     ========================================================= */
  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('cartDrawer');
  const modal = document.getElementById('quickViewModal');

  function closeAllPanels() {
    if (overlay) overlay.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
    if (modal) modal.classList.remove('open');
  }
  if (overlay) overlay.addEventListener('click', closeAllPanels);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllPanels(); });

  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn && drawer && overlay) {
    cartBtn.addEventListener('click', () => {
      overlay.classList.add('open');
      drawer.classList.add('open');
    });
  }
  const drawerClose = document.getElementById('drawerClose');
  if (drawerClose) drawerClose.addEventListener('click', closeAllPanels);
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (!loadCart().length) { showToast('Sua seleção está vazia'); return; }
      window.location.href = 'checkout.html';
    });
  }

  /* =========================================================
     quick view modal — só existe em colecao.html
     ========================================================= */
  const modalBody = document.getElementById('modalBody');
  function openQuickView(id) {
    const p = findProduct(id);
    if (!p || !modalBody || !modal || !overlay) return;
    let selectedSize = 10;
    modalBody.innerHTML = `
      <div class="modal-visual${p.artBg ? ' full-art' : ''}"><img src="${p.img}" alt="${p.name}, ${p.brand}">${p.artBg ? '' : '<span class="modal-shine" aria-hidden="true"></span>'}</div>
      <div class="modal-info">
        <span class="p-eyebrow">${p.brand} · ${p.family}</span>
        <h3>${p.name}</h3>
        <div class="pyramid">
          <div class="pyramid-row"><b>Topo</b><span>${p.top}</span></div>
          <div class="pyramid-row"><b>Coração</b><span>${p.heart}</span></div>
          <div class="pyramid-row"><b>Fundo</b><span>${p.base}</span></div>
        </div>
        <div class="size-row" id="sizeRow">
          <button data-size="3">Decant<small>3ml — ${fmt(p.decants[3])}</small></button>
          <button data-size="5">Decant<small>5ml — ${fmt(p.decants[5])}</small></button>
          <button class="active" data-size="10">Decant<small>10ml — ${fmt(p.decants[10])}</small></button>
          <button data-size="full">Frasco fechado<small>${p.fullSize}ml — ${fmt(p.fullPrice)}</small></button>
        </div>
        <div class="modal-foot">
          <span class="product-price" id="modalPrice">${fmt(p.decants[10])}</span>
          <button class="btn btn-solid" id="modalAddBtn">Adicionar à seleção</button>
        </div>
      </div>
    `;
    const sizeRow = modalBody.querySelector('#sizeRow');
    const modalPrice = modalBody.querySelector('#modalPrice');
    sizeRow.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      sizeRow.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size === 'full' ? 'full' : Number(btn.dataset.size);
      modalPrice.textContent = fmt(priceOf(p, selectedSize));
    });
    modalBody.querySelector('#modalAddBtn').addEventListener('click', () => addToCart(p.id, selectedSize));

    overlay.classList.add('open');
    modal.classList.add('open');
  }
  const modalClose = document.getElementById('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeAllPanels);

  /* =========================================================
     página coleção (colecao.html): busca + selects + grade
     ========================================================= */
  const productGrid = document.getElementById('productGrid');
  if (productGrid) {
    function renderGrid(list) {
      if (!list.length) {
        productGrid.innerHTML = '<p class="catalog-empty">Nenhum perfume encontrado com esses filtros.</p>';
        return;
      }
      productGrid.innerHTML = list.map(p => {
        const sizes = [3, 5, 10, 'full'];
        return `
        <article class="product-card reveal in" data-id="${p.id}" data-brand="${p.brandFilter}" data-family="${p.familyFilter}" data-name="${p.name.toLowerCase()}" data-selected-size="10">
          <div class="product-visual${p.artBg ? ' full-art' : ''}">
            <span class="brand-tag">${p.brand}</span>
            <img class="product-photo" src="${p.img}" alt="${p.name}, ${p.brand}">
            ${p.artBg ? '' : '<span class="shine" aria-hidden="true"></span>'}
            <button class="quick-view-btn" data-quickview="${p.id}" aria-label="Ver detalhes de ${p.name}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            </button>
          </div>
          <div class="product-info">
            <span class="p-eyebrow">${p.family}</span>
            <h3>${p.name}</h3>
            <div class="product-notes">
              <span class="note-pill">${p.top.split(',')[0]}</span>
              <span class="note-pill">${p.heart.split(',')[0]}</span>
              <span class="note-pill">${p.base.split(',')[0]}</span>
            </div>
            <div class="qty-pills" data-sizepills="${p.id}">
              ${sizes.map(s => `<button data-size="${s}" class="${s === 10 ? 'active' : ''}">${s === 'full' ? `Frasco ${p.fullSize}ml` : s + 'ml'}</button>`).join('')}
            </div>
            <div class="product-foot">
              <span class="product-price" data-priceof="${p.id}">${fmt(priceOf(p, 10))}</span>
              <button class="add-cart-btn" data-quickadd="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h2l2.4 12.6a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>
              </button>
            </div>
          </div>
        </article>
      `;
      }).join('');
    }

    const searchInput = document.getElementById('searchInput');
    const selectBrand = document.getElementById('selectBrand');
    const selectFamily = document.getElementById('selectFamily');

    function currentFiltered() {
      const term = (searchInput && searchInput.value || '').trim().toLowerCase();
      const brand = selectBrand ? selectBrand.value : 'todos';
      const family = selectFamily ? selectFamily.value : 'todos';
      return PRODUCTS.filter(p =>
        (brand === 'todos' || p.brandFilter === brand) &&
        (family === 'todos' || p.familyFilter === family) &&
        (!term || p.name.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term))
      );
    }

    function refresh() {
      renderGrid(currentFiltered());
    }

    if (searchInput) searchInput.addEventListener('input', refresh);
    if (selectBrand) selectBrand.addEventListener('change', refresh);
    if (selectFamily) selectFamily.addEventListener('change', refresh);

    // filtros vindos de outra página via querystring (?marca=...&nota=...&buscar=...)
    const qs = new URLSearchParams(location.search);
    if (qs.get('marca') && selectBrand) selectBrand.value = qs.get('marca');
    if (qs.get('nota') && selectFamily) selectFamily.value = qs.get('nota');
    if (qs.get('buscar') && searchInput) searchInput.value = qs.get('buscar');

    refresh();

    // clique no card abre a quick view; controles internos (tamanho/carrinho) não propagam pra isso
    productGrid.addEventListener('click', e => {
      const pillBtn = e.target.closest('.qty-pills button');
      const quickAddBtn = e.target.closest('[data-quickadd]');
      const quickViewBtn = e.target.closest('[data-quickview]');
      const card = e.target.closest('.product-card');
      if (!card) return;

      if (pillBtn) {
        const pillsWrap = pillBtn.closest('.qty-pills');
        pillsWrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        pillBtn.classList.add('active');
        const size = pillBtn.dataset.size === 'full' ? 'full' : Number(pillBtn.dataset.size);
        card.dataset.selectedSize = size;
        const id = pillsWrap.dataset.sizepills;
        const p = findProduct(id);
        card.querySelector(`[data-priceof="${id}"]`).textContent = fmt(priceOf(p, size));
        return;
      }
      if (quickAddBtn) {
        const size = card.dataset.selectedSize === 'full' ? 'full' : Number(card.dataset.selectedSize);
        addToCart(quickAddBtn.dataset.quickadd, size);
        return;
      }
      // qualquer outro clique no card (incluindo a lupa) abre a quick view
      openQuickView(quickViewBtn ? quickViewBtn.dataset.quickview : card.dataset.id);
    });

    // link vindo de outra página apontando pra um produto específico (#p-<id>)
    if (location.hash.startsWith('#p-')) {
      const targetId = location.hash.replace('#p-', '');
      setTimeout(() => {
        const card = productGrid.querySelector(`[data-id="${targetId}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        openQuickView(targetId);
      }, 300);
    }
  }

  /* =========================================================
     quiz de 10 perguntas (quiz.html) — recomendação por notas
     cada opção soma pontos a notas (não a produtos); no final,
     comparamos as notas acumuladas com o matchNotes de cada produto
     ========================================================= */
  const quizBox = document.getElementById('quizBox');
  if (quizBox) {
    const QUIZ = [
      {
        q: '1. O que mais te atrai num perfume?',
        options: [
          { label: 'Doçura gourmand, tipo caramelo e vanilla', notes: ['caramelo', 'vanilla'] },
          { label: 'Flores brancas marcantes', notes: ['jasmim', 'gardenia'] },
          { label: 'Frutas vermelhas frescas', notes: ['morango'] },
          { label: 'Madeira e especiarias intensas', notes: ['oud', 'couro'] }
        ]
      },
      {
        q: '2. Seu café da manhã ideal tem...',
        options: [
          { label: 'Café bem forte', notes: ['cafe'] },
          { label: 'Leite quentinho', notes: ['leite'] },
          { label: 'Suco de morango', notes: ['morango'] },
          { label: 'Chá aromático', notes: ['cha'] }
        ]
      },
      {
        q: '3. Se seu perfume fosse uma cor, seria...',
        options: [
          { label: 'Vermelho intenso', notes: ['oud', 'ambar'] },
          { label: 'Branco puro', notes: ['musk-branco', 'jasmim'] },
          { label: 'Rosa clarinho', notes: ['morango', 'heliotropo'] },
          { label: 'Dourado quente', notes: ['caramelo', 'vanilla'] }
        ]
      },
      {
        q: '4. No fim de semana você prefere...',
        options: [
          { label: 'Sair pra um evento chique à noite', notes: ['oud', 'incenso'] },
          { label: 'Ficar em casa lendo com um café', notes: ['cafe', 'fava-tonka'] },
          { label: 'Café da manhã com leite e pão doce', notes: ['leite', 'caramelo'] },
          { label: 'Piquenique num jardim florido', notes: ['flor-laranjeira', 'jasmim'] }
        ]
      },
      {
        q: '5. Qual textura de perfume te atrai mais?',
        options: [
          { label: 'Amadeirada e seca', notes: ['couro', 'patchouli'] },
          { label: 'Cremosa e leitosa', notes: ['leite', 'sandalo'] },
          { label: 'Adocicada e cremosa', notes: ['caramelo', 'amendoa'] },
          { label: 'Fresca e cítrica', notes: ['bergamota'] }
        ]
      },
      {
        q: '6. Escolha um doce:',
        options: [
          { label: 'Brigadeiro', notes: ['caramelo'] },
          { label: 'Sorvete de morango', notes: ['morango'] },
          { label: 'Pudim de leite', notes: ['leite', 'vanilla'] },
          { label: 'Petit gâteau de café', notes: ['cafe', 'fava-tonka'] }
        ]
      },
      {
        q: '7. Seu acessório favorito é...',
        options: [
          { label: 'Joia dourada e chamativa', notes: ['ambar', 'oud'] },
          { label: 'Colar de pérolas discreto', notes: ['musk-branco', 'gardenia'] },
          { label: 'Laço rosa', notes: ['morango', 'heliotropo'] },
          { label: 'Relógio de couro', notes: ['couro', 'patchouli'] }
        ]
      },
      {
        q: '8. Qual estação representa você?',
        options: [
          { label: 'Inverno intenso', notes: ['oud', 'incenso'] },
          { label: 'Primavera florida', notes: ['jasmim', 'flor-laranjeira'] },
          { label: 'Verão doce', notes: ['morango', 'amendoa'] },
          { label: 'Outono aconchegante', notes: ['cafe', 'vanilla'] }
        ]
      },
      {
        q: '9. Escolha uma palavra:',
        options: [
          { label: 'Presença', notes: ['oud', 'couro'] },
          { label: 'Delicadeza', notes: ['lirio-do-vale', 'geranio'] },
          { label: 'Fofura', notes: ['leite', 'amendoa'] },
          { label: 'Conforto', notes: ['cafe', 'caramelo'] }
        ]
      },
      {
        q: '10. Na hora de decidir, você é do tipo que...',
        options: [
          { label: 'Quer ser lembrado(a) na sala', notes: ['ambar', 'incenso'] },
          { label: 'Prefere um perfume "seguro" pro dia a dia', notes: ['musk', 'sandalo'] },
          { label: 'Gosta de algo fofo e nostálgico', notes: ['leite', 'morango'] },
          { label: 'Faz tudo por café', notes: ['cafe', 'jasmim'] }
        ]
      }
    ];

    const quizProgress = document.getElementById('quizProgress').querySelectorAll('i');
    let quizStep = 0;
    let noteScore = {};

    function setProgress(step) {
      const pct = Math.round((step / QUIZ.length) * 100);
      quizProgress.forEach(bar => { bar.style.width = pct + '%'; });
    }

    function renderQuizQuestion() {
      setProgress(quizStep);
      const item = QUIZ[quizStep];
      quizBox.innerHTML = `
        <span class="quiz-step-label">Pergunta ${quizStep + 1} de ${QUIZ.length}</span>
        <p class="quiz-question">${item.q}</p>
        <div class="quiz-options">
          ${item.options.map((opt, i) => `<button data-opt="${i}">${opt.label}</button>`).join('')}
        </div>
      `;
      quizBox.querySelectorAll('[data-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const opt = item.options[Number(btn.dataset.opt)];
          opt.notes.forEach(n => { noteScore[n] = (noteScore[n] || 0) + 1; });
          quizStep += 1;
          if (quizStep < QUIZ.length) renderQuizQuestion();
          else renderQuizResult();
        });
      });
    }

    function computeMatches() {
      return PRODUCTS.map(p => {
        const matchedNotes = p.matchNotes.filter(n => noteScore[n]);
        const rawScore = matchedNotes.reduce((s, n) => s + noteScore[n], 0);
        const affinity = rawScore / p.matchNotes.length;
        return { p, affinity, matchedNotes };
      }).sort((a, b) => b.affinity - a.affinity);
    }

    function renderQuizResult() {
      setProgress(QUIZ.length);
      const ranked = computeMatches();
      const top = ranked[0];
      const maxAffinity = top.affinity || 1;

      quizBox.innerHTML = `
        <div class="quiz-result">
          <span class="quiz-result-badge">Sua fragrância é ${top.p.name}.</span>
          <p>Combinação por notas: <em>${top.matchedNotes.length ? top.matchedNotes.join(', ') : 'perfil equilibrado'}</em>.</p>
          <div class="quiz-ranked">
            ${ranked.map(r => `
              <div class="quiz-ranked-row">
                <img src="${r.p.img}" alt="${r.p.name}">
                <div class="quiz-ranked-info">
                  <b>${r.p.name}</b>
                  <div class="quiz-bar"><i style="width:${Math.max(6, Math.round(100 * r.affinity / maxAffinity))}%"></i></div>
                </div>
                <span class="quiz-ranked-pct">${Math.max(4, Math.round(100 * r.affinity / maxAffinity))}%</span>
              </div>
            `).join('')}
          </div>
          <div class="quiz-result-ctas">
            <a class="btn btn-solid" href="colecao.html#p-${top.p.id}">Ver ${top.p.name} na coleção</a>
            <button class="btn btn-ghost" id="quizRestart">Refazer o teste</button>
          </div>
        </div>
      `;
      document.getElementById('quizRestart').addEventListener('click', () => {
        quizStep = 0;
        noteScore = {};
        renderQuizQuestion();
      });
    }
    renderQuizQuestion();
  }

  /* =========================================================
     depoimentos — carrossel (contato.html)
     ========================================================= */
  const slides = Array.from(document.querySelectorAll('.testimonial-slide'));
  const dotsWrap = document.getElementById('testimonialDots');
  if (slides.length && dotsWrap) {
    let currentSlide = 0;
    let autoTimer;

    dotsWrap.innerHTML = slides.map((_, i) => `<button aria-label="Depoimento ${i + 1}" class="${i === 0 ? 'active' : ''}"></button>`).join('');
    const dots = Array.from(dotsWrap.children);

    function goToSlide(i) {
      currentSlide = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => s.classList.toggle('active', idx === currentSlide));
      dots.forEach((d, idx) => d.classList.toggle('active', idx === currentSlide));
    }
    function restartAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => goToSlide(currentSlide + 1), 6000);
    }
    dots.forEach((d, i) => d.addEventListener('click', () => { goToSlide(i); restartAuto(); }));
    const prevBtn = document.getElementById('testimonialPrev');
    const nextBtn = document.getElementById('testimonialNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { goToSlide(currentSlide - 1); restartAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { goToSlide(currentSlide + 1); restartAuto(); });
    restartAuto();
  }

  /* =========================================================
     newsletter (contato.html)
     ========================================================= */
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    const newsletterMsg = document.getElementById('newsletterMsg');
    newsletterForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('newsletterEmail');
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
      if (!valid) {
        newsletterMsg.textContent = 'Digite um e-mail válido para continuar.';
        newsletterMsg.classList.add('err');
        return;
      }
      newsletterMsg.classList.remove('err');
      newsletterMsg.textContent = `Inscrição confirmada para ${input.value.trim()} — até a próxima novidade.`;
      input.value = '';
    });
  }

})();
