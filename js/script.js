(() => {
  'use strict';

  /* =========================================================
     visita de página — todas as páginas, uma vez por carregamento
     ========================================================= */
  if (window.emAuth) window.emAuth.logEvent('page_view', { path: window.location.pathname });

  /* =========================================================
     catálogo — produtos reais (curadoria, não fabricação própria)
     PREÇOS SÃO PLACEHOLDER — editar quando os custos chegarem
     usado em: colecao.html (grade), quiz.html (recomendação),
     index.html (destaques) e no carrinho (qualquer página)
     ========================================================= */
  const PRODUCTS = window.PRODUCTS || [];
  let refreshCollectionGrid = null; // setado dentro do bloco da página coleção; chamado de novo quando os preços dinâmicos chegam

  const fmt = n => 'R$ ' + n.toLocaleString('pt-BR');
  function priceOf(p, size) {
    return size === 'full' ? p.fullPrice : p.decants[size];
  }
  function sizeLabel(size) {
    return size === 'full' ? 'Frasco fechado' : `Decant ${size}ml`;
  }
  const catalogCache = new Map(); // id -> produto do catálogo importado, normalizado igual PRODUCTS
  function findProduct(id) { return PRODUCTS.find(x => x.id === id) || catalogCache.get(id); }

  function normalizeCatalogRow(row, priceRows) {
    const precosPorTamanho = {};
    let inStock = true;
    (priceRows || []).filter(pr => pr.product_id === row.id).forEach(pr => {
      precosPorTamanho[pr.size] = Number(pr.price) || 0;
      if (pr.in_stock === false) inStock = false;
    });
    return {
      id: row.id,
      brand: row.brand || 'Diversos',
      brandFilter: row.brand_filter || '',
      familyFilter: row.family_filter || '',
      name: row.name,
      family: [row.gender, row.brand].filter(Boolean).join(' · '),
      img: row.image_bg_url || row.image_url || 'assets/favicon.svg',
      top: row.top_notes || '',
      heart: row.heart_notes || '',
      base: row.base_notes || '',
      fullSize: row.bottle_ml || 100,
      fullPrice: precosPorTamanho.full || 0,
      decants: { 3: precosPorTamanho[3] || 0, 5: precosPorTamanho[5] || 0, 10: precosPorTamanho[10] || 0 },
      matchNotes: row.match_notes || [],
      inStock,
      fromCatalog: true
    };
  }

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
      if (term && window.emAuth) window.emAuth.logEvent('search', { term });
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
     destaques da home (index.html) — 3 perfumes aleatórios a cada visita
     ========================================================= */
  const destaquesGrid = document.getElementById('destaquesGrid');
  if (destaquesGrid && PRODUCTS.length) {
    const shuffled = PRODUCTS.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    destaquesGrid.innerHTML = shuffled.slice(0, 3).map(p => `
      <a class="product-card" href="colecao.html#p-${p.id}" style="text-decoration:none;">
        <div class="product-visual${p.artBg ? ' full-art' : ''}">
          <span class="brand-tag">${p.brand}</span>
          <img class="product-photo" src="${p.img}" alt="${p.name}, ${p.brand}">
          ${p.artBg ? '' : '<span class="shine" aria-hidden="true"></span>'}
        </div>
        <div class="product-info">
          <span class="p-eyebrow">${p.family}</span>
          <h3>${p.name}</h3>
          <p style="font-size:.88rem;">${p.top}.</p>
        </div>
      </a>
    `).join('');
  }

  /* =========================================================
     "casas parceiras" no hero (index.html) — conta marcas curadas +
     marcas já importadas pelo catálogo, pra não ficar fixo em 4 pra sempre
     ========================================================= */
  const casasParceirasStat = document.getElementById('casasParceirasStat');
  if (casasParceirasStat) {
    const marcasCuradas = new Set(PRODUCTS.map(p => p.brandFilter));
    if (window.emAuth && window.emAuth.isConfigured) {
      window.emAuth.getCatalogBrands().then(marcas => {
        marcas.forEach(m => marcasCuradas.add(m.value));
        casasParceirasStat.textContent = marcasCuradas.size;
      });
    }
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
    if (window.emAuth) window.emAuth.logEvent('add_to_cart', { product_id: p.id, name: p.name, size });
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
  async function openQuickView(id) {
    let p = findProduct(id);
    if (!p && window.emAuth && window.emAuth.isConfigured) {
      // produto do catálogo importado que ainda não passou pela Coleção nesta
      // sessão (ex.: veio direto de um link do Quiz) — busca avulsa por id
      const row = await window.emAuth.getCatalogProduct(id);
      if (row) {
        const precos = await window.emAuth.getPricesFor([id]);
        p = normalizeCatalogRow(row, precos);
        catalogCache.set(p.id, p);
      }
    }
    if (!p || !modalBody || !modal || !overlay) return;
    if (window.emAuth) window.emAuth.logEvent('product_view', { product_id: p.id, name: p.name });
    let selectedSize = 10;
    modalBody.innerHTML = `
      <div class="modal-visual${p.artBg ? ' full-art' : ''}"><img src="${p.img}" alt="${p.name}, ${p.brand}">${p.artBg ? '' : '<span class="modal-shine" aria-hidden="true"></span>'}</div>
      <div class="modal-info">
        <span class="p-eyebrow">${p.brand} · ${p.family}</span>
        <h3>${p.name}</h3>
        <div class="pyramid">
          <div class="pyramid-row"><b>Topo</b><span>${p.top || '—'}</span></div>
          <div class="pyramid-row"><b>Coração</b><span>${p.heart || '—'}</span></div>
          <div class="pyramid-row"><b>Fundo</b><span>${p.base || '—'}</span></div>
        </div>
        <div class="size-row" id="sizeRow">
          <button data-size="3">Decant<small>3ml · ${fmt(p.decants[3])}</small></button>
          <button data-size="5">Decant<small>5ml · ${fmt(p.decants[5])}</small></button>
          <button class="active" data-size="10">Decant<small>10ml · ${fmt(p.decants[10])}</small></button>
          <button data-size="full">Frasco fechado<small>${p.fullSize}ml · ${fmt(p.fullPrice)}</small></button>
        </div>
        <div class="modal-foot">
          <span class="product-price" id="modalPrice">${fmt(p.decants[10])}</span>
          <button class="btn btn-solid" id="modalAddBtn" ${p.inStock === false ? 'disabled' : ''}>${p.inStock === false ? 'Esgotado' : 'Adicionar à seleção'}</button>
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
    const sizes = [3, 5, 10, 'full'];
    function cardHtml(p) {
      return `
        <article class="product-card reveal in" data-id="${p.id}" data-brand="${p.brandFilter}" data-family="${p.familyFilter}" data-name="${p.name.toLowerCase()}" data-selected-size="10">
          <div class="product-visual${p.artBg ? ' full-art' : ''}">
            <span class="brand-tag">${p.brand}</span>
            ${p.inStock === false ? '<span class="status-badge status-cancelado stock-badge">Esgotado</span>' : ''}
            <img class="product-photo" src="${p.img}" alt="${p.name}, ${p.brand}" loading="lazy">
            ${p.artBg ? '' : '<span class="shine" aria-hidden="true"></span>'}
            <button class="quick-view-btn" data-quickview="${p.id}" aria-label="Ver detalhes de ${p.name}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            </button>
          </div>
          <div class="product-info">
            <span class="p-eyebrow">${p.family}</span>
            <h3>${p.name}</h3>
            <div class="product-notes">
              <span class="note-pill">${(p.top || '—').split(',')[0]}</span>
              <span class="note-pill">${(p.heart || '—').split(',')[0]}</span>
              <span class="note-pill">${(p.base || '—').split(',')[0]}</span>
            </div>
            <div class="qty-pills" data-sizepills="${p.id}">
              ${sizes.map(s => `<button data-size="${s}" class="${s === 10 ? 'active' : ''}">${s === 'full' ? `Frasco ${p.fullSize}ml` : s + 'ml'}</button>`).join('')}
            </div>
            <div class="product-foot">
              <span class="product-price" data-priceof="${p.id}">${fmt(priceOf(p, 10))}</span>
              <button class="add-cart-btn" data-quickadd="${p.id}" aria-label="Adicionar ${p.name} ao carrinho" ${p.inStock === false ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h2l2.4 12.6a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }
    function renderGrid(list) {
      productGrid.innerHTML = list.length ? list.map(cardHtml).join('') : '<p class="catalog-empty">Nenhum perfume encontrado com esses filtros.</p>';
    }
    function appendCards(list) {
      if (!list.length) return;
      productGrid.querySelector('.catalog-empty')?.remove();
      productGrid.insertAdjacentHTML('beforeend', list.map(cardHtml).join(''));
    }

    const searchInput = document.getElementById('searchInput');
    const selectBrand = document.getElementById('selectBrand');
    const selectFamily = document.getElementById('selectFamily');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

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

    // além dos produtos curados (acima, em memória), a Coleção também traz
    // o catálogo importado do comprasparaguai (js/auth.js:getCatalogPage),
    // paginado — "Carregar mais" busca a próxima página no banco.
    let catalogOffset = 0;
    let catalogHasMore = true;
    let catalogLoadingSeq = 0;

    async function loadMoreCatalog() {
      if (!window.emAuth || !window.emAuth.isConfigured || !catalogHasMore || !loadMoreBtn) return;
      const meuToken = catalogLoadingSeq;
      loadMoreBtn.disabled = true;
      const termo = (searchInput && searchInput.value || '').trim();
      const marca = selectBrand ? selectBrand.value : 'todos';
      const familia = selectFamily ? selectFamily.value : 'todos';
      const limite = 30;
      const linhas = await window.emAuth.getCatalogPage({ termo, marca, familia, offset: catalogOffset, limite });
      if (meuToken !== catalogLoadingSeq) return; // filtro mudou enquanto buscava — descarta resultado velho
      catalogHasMore = linhas.length === limite;
      catalogOffset += linhas.length;
      if (linhas.length) {
        const precos = await window.emAuth.getPricesFor(linhas.map(r => r.id));
        if (meuToken !== catalogLoadingSeq) return;
        const produtos = linhas.map(r => normalizeCatalogRow(r, precos));
        produtos.forEach(p => catalogCache.set(p.id, p));
        appendCards(produtos);
      }
      loadMoreBtn.hidden = !catalogHasMore;
      loadMoreBtn.disabled = false;
    }
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreCatalog);

    function refresh() {
      catalogLoadingSeq++;
      catalogOffset = 0;
      catalogHasMore = true;
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      renderGrid(currentFiltered());
      loadMoreCatalog();
    }
    refreshCollectionGrid = refresh;

    let searchLogTimer;
    if (searchInput) searchInput.addEventListener('input', () => {
      refresh();
      clearTimeout(searchLogTimer);
      const term = searchInput.value.trim();
      if (term && window.emAuth) searchLogTimer = setTimeout(() => window.emAuth.logEvent('search', { term }), 600);
    });
    if (selectBrand) selectBrand.addEventListener('change', refresh);
    if (selectFamily) selectFamily.addEventListener('change', refresh);

    // marcas extras (catálogo importado) além das 4 curadas fixas no HTML
    if (window.emAuth && window.emAuth.isConfigured && selectBrand) {
      window.emAuth.getCatalogBrands().then(marcas => {
        const existentes = new Set([...selectBrand.options].map(o => o.value));
        marcas.forEach(m => {
          if (existentes.has(m.value)) return;
          const opt = document.createElement('option');
          opt.value = m.value;
          opt.textContent = m.label;
          selectBrand.appendChild(opt);
        });
      });
    }

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

    async function computeMatches() {
      let produtosCatalogo = [];
      if (window.emAuth && window.emAuth.isConfigured) {
        const notasComPontuacao = Object.keys(noteScore).filter(n => noteScore[n] > 0);
        const linhas = await window.emAuth.getCatalogMatches(notasComPontuacao);
        produtosCatalogo = linhas.map(row => {
          const p = catalogCache.get(row.id) || normalizeCatalogRow(row, []);
          catalogCache.set(p.id, p);
          return p;
        });
      }
      return [...PRODUCTS, ...produtosCatalogo]
        .filter(p => p.matchNotes && p.matchNotes.length)
        .map(p => {
          const matchedNotes = p.matchNotes.filter(n => noteScore[n]);
          const rawScore = matchedNotes.reduce((s, n) => s + noteScore[n], 0);
          const affinity = rawScore / p.matchNotes.length;
          return { p, affinity, matchedNotes };
        }).sort((a, b) => b.affinity - a.affinity);
    }

    async function renderQuizResult() {
      setProgress(QUIZ.length);
      quizBox.innerHTML = '<p class="catalog-empty">Calculando sua combinação…</p>';
      const ranked = await computeMatches();
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
      newsletterMsg.textContent = `Inscrição confirmada para ${input.value.trim()}. Até a próxima novidade.`;
      input.value = '';
    });
  }

  /* =========================================================
     preços dinâmicos (Supabase) — todas as páginas com catálogo
     data/products.js continua sendo o valor inicial (site funciona mesmo
     sem Supabase configurado); quando product_prices responde, sobrepõe
     fullPrice/decants/inStock nos produtos já carregados e re-renderiza.
     Busca só os preços dos produtos curados (por id) — a tabela inteira
     cresce pra dezenas de milhares de linhas com o catálogo importado
     (js/auth.js:getCatalogPage já busca preço filtrado pra esses).
     ========================================================= */
  if (window.emAuth && window.emAuth.isConfigured && PRODUCTS.length) {
    window.emAuth.getPricesFor(PRODUCTS.map(p => p.id)).then(rows => {
      if (!rows.length) return;
      rows.forEach(row => {
        const p = findProduct(row.product_id);
        if (!p) return;
        if (row.size === 'full') p.fullPrice = Number(row.price);
        else p.decants[Number(row.size)] = Number(row.price);
        p.inStock = row.in_stock !== false;
      });
      if (refreshCollectionGrid) refreshCollectionGrid();
    });
  }

})();
