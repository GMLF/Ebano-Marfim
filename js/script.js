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
  // tudo que vem do banco escrito por cliente (nome e comentário de avaliação) passa por aqui
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkProduto = id => 'produto?id=' + encodeURIComponent(id);
  function priceOf(p) {
    return p.fullPrice;
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
      window.location.href = 'colecao' + (term ? '?buscar=' + encodeURIComponent(term) : '');
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
      <a class="product-card" href="${linkProduto(p.id)}">
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
  function addToCart(productId) {
    const p = findProduct(productId);
    if (!p) return;
    const cart = loadCart();
    const price = priceOf(p);
    const existing = cart.find(i => i.id === p.id);
    if (existing) existing.qty += 1;
    else cart.push({ id: p.id, name: p.name, img: p.img, ml: p.fullSize, price, qty: 1 });
    saveCart(cart);
    openCart(); // mostra que entrou e já deixa o "Finalizar" à mão
    if (window.emAuth) window.emAuth.logEvent('add_to_cart', { product_id: p.id, name: p.name });
  }
  function changeQty(id, delta) {
    const cart = loadCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    const filtered = item.qty <= 0 ? cart.filter(i => i.id !== id) : cart;
    saveCart(filtered);
  }
  function removeItem(id) {
    saveCart(loadCart().filter(i => i.id !== id));
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
      drawerItems.innerHTML = '<p class="drawer-empty">Sua seleção está vazia.<br>Escolha um frasco fechado pra começar.</p>';
    } else {
      drawerItems.innerHTML = cart.map(i => `
        <div class="cart-item">
          <div class="cart-item-photo"><img src="${i.img}" alt="${i.name}"></div>
          <div>
            <div class="cart-item-name">${i.name}</div>
            <div class="cart-item-size">Frasco ${i.ml}ml</div>
            <div class="cart-item-qty">
              <button data-qty="-1" data-id="${i.id}" aria-label="Diminuir quantidade">−</button>
              <span>${i.qty}</span>
              <button data-qty="1" data-id="${i.id}" aria-label="Aumentar quantidade">+</button>
            </div>
          </div>
          <div>
            <div class="cart-item-price">${fmt(i.price * i.qty)}</div>
            <button class="cart-item-remove" data-remove data-id="${i.id}">remover</button>
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
      if (qtyBtn) changeQty(qtyBtn.dataset.id, Number(qtyBtn.dataset.qty));
      if (removeBtn) removeItem(removeBtn.dataset.id);
    });
  }
  renderCart();

  /* =========================================================
     overlay compartilhado (modal + drawer) — todas as páginas
     ========================================================= */
  const overlay = document.getElementById('overlay');
  const drawer = document.getElementById('cartDrawer');

  function closeAllPanels() {
    if (overlay) overlay.classList.remove('open');
    if (drawer) drawer.classList.remove('open');
  }
  function openCart() {
    if (!overlay || !drawer) return;
    overlay.classList.add('open');
    drawer.classList.add('open');
  }
  if (overlay) overlay.addEventListener('click', closeAllPanels);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllPanels(); });

  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn) cartBtn.addEventListener('click', openCart);
  const drawerClose = document.getElementById('drawerClose');
  if (drawerClose) drawerClose.addEventListener('click', closeAllPanels);
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (!loadCart().length) { showToast('Sua seleção está vazia'); return; }
      window.location.href = 'checkout';
    });
  }

  /* =========================================================
     página do produto (produto.html?id=...)
     ========================================================= */
  const estrelas = nota => [1, 2, 3, 4, 5].map(n => `<span class="star${n <= Math.round(nota) ? ' filled' : ''}" aria-hidden="true">★</span>`).join('');
  const contaAvaliacoes = n => `${n} ${n === 1 ? 'avaliação' : 'avaliações'}`;
  let refreshProductPage = null; // chamado de novo quando os preços dinâmicos chegam

  async function carregarProduto(id) {
    let p = findProduct(id);
    if (!p && window.emAuth && window.emAuth.isConfigured) {
      // produto do catálogo importado: não está em data/products.js, busca avulsa por id
      const row = await window.emAuth.getCatalogProduct(id);
      if (row) {
        const precos = await window.emAuth.getPricesFor([id]);
        p = normalizeCatalogRow(row, precos);
        catalogCache.set(p.id, p);
      }
    }
    return p;
  }

  function relacionadoHtml(r) {
    return `
      <a class="product-card" href="${linkProduto(r.id)}">
        <div class="product-visual${r.artBg ? ' full-art' : ''}">
          <span class="brand-tag">${esc(r.brand)}</span>
          <img class="product-photo" src="${esc(r.img)}" alt="${esc(r.name)}, ${esc(r.brand)}" loading="lazy">
          ${r.artBg ? '' : '<span class="shine" aria-hidden="true"></span>'}
        </div>
        <div class="product-info">
          <span class="p-eyebrow">${esc(r.family)}</span>
          <h3>${esc(r.name)}</h3>
          <div class="product-foot">
            <span class="product-price">${fmt(r.fullPrice)} <small>· frasco ${r.fullSize}ml</small></span>
          </div>
        </div>
      </a>`;
  }

  const pdDetail = document.getElementById('pdDetail');
  if (pdDetail) {
    const pdStatus = document.getElementById('pdStatus');
    const produtoId = new URLSearchParams(location.search).get('id');

    (async () => {
      const p = produtoId ? await carregarProduto(produtoId) : null;
      if (!p) {
        pdStatus.innerHTML = 'Não encontramos esse perfume. <a href="colecao">Ver a coleção</a>.';
        return;
      }
      document.title = `${p.name} | Ébano & Marfim`;
      if (window.emAuth) window.emAuth.logEvent('product_view', { product_id: p.id, name: p.name });

      let notaResumo = null; // { html, label }, preenchido quando as avaliações chegam
      function aplicarNota() {
        const link = document.getElementById('pdRating');
        if (!link || !notaResumo) return;
        link.innerHTML = notaResumo.html;
        link.setAttribute('aria-label', notaResumo.label);
        link.hidden = false;
      }
      function renderDetalhe() {
        const esgotado = p.inStock === false;
        pdDetail.innerHTML = `
          <div class="pd-visual${p.artBg ? ' full-art' : ''}">
            <img src="${esc(p.img)}" alt="${esc(p.name)}, ${esc(p.brand)}">
          </div>
          <div class="pd-info">
            <p class="pd-brand">${esc(p.brand)} · ${esc(p.family)}</p>
            <h1 class="pd-name">${esc(p.name)}</h1>
            <a class="pd-rating" href="#avaliacoes" id="pdRating" hidden></a>
            <p class="pd-price">${fmt(p.fullPrice)}<small>Frasco fechado de ${p.fullSize}ml, lacrado de fábrica</small></p>
            <button class="btn btn-solid pd-add" id="pdAddBtn" type="button" ${esgotado ? 'disabled' : ''}>${esgotado ? 'Esgotado' : 'Adicionar à seleção'}</button>
            <p class="pd-ship">Frete grátis na opção mais barata a partir de R$ 399 em perfumes. Em Londrina, a entrega é por nossa conta.</p>
            <div class="pd-pyramid">
              <h2>Pirâmide olfativa</h2>
              <div class="pyramid">
                <div class="pyramid-row"><b>Topo</b><span>${esc(p.top || '—')}</span></div>
                <div class="pyramid-row"><b>Coração</b><span>${esc(p.heart || '—')}</span></div>
                <div class="pyramid-row"><b>Fundo</b><span>${esc(p.base || '—')}</span></div>
              </div>
            </div>
          </div>`;
        pdDetail.querySelector('#pdAddBtn').addEventListener('click', () => addToCart(p.id));
        aplicarNota();
      }
      renderDetalhe();
      refreshProductPage = renderDetalhe;
      pdStatus.hidden = true;
      pdDetail.hidden = false;

      // outros perfumes: primeiro da mesma marca, depois da mesma família, até 3
      const candidatos = PRODUCTS.filter(r => r.id !== p.id && !r.id.startsWith('teste'));
      const relacionados = [
        ...candidatos.filter(r => r.brandFilter === p.brandFilter),
        ...candidatos.filter(r => r.brandFilter !== p.brandFilter && r.familyFilter === p.familyFilter),
        ...candidatos.filter(r => r.brandFilter !== p.brandFilter && r.familyFilter !== p.familyFilter)
      ].slice(0, 3);
      if (relacionados.length) {
        document.getElementById('pdRelated').innerHTML = relacionados.map(relacionadoHtml).join('');
        document.getElementById('pdRelatedSection').hidden = false;
      }

      if (!window.emAuth || !window.emAuth.isConfigured) return;
      const reviews = await window.emAuth.getProductReviews(p.id);
      const reviewsBody = document.getElementById('pdReviews');
      document.getElementById('avaliacoes').hidden = false;
      if (!reviews.length) {
        reviewsBody.innerHTML = '<p class="pd-reviews-empty">Ainda sem avaliações. Quem compra e recebe o perfume pode avaliar em Minha Conta.</p>';
        return;
      }
      const media = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      const mediaTexto = media.toFixed(1).replace('.', ',');
      notaResumo = {
        html: `<span class="pd-stars">${estrelas(media)}</span> ${mediaTexto} · ${contaAvaliacoes(reviews.length)}`,
        label: `Nota ${mediaTexto} de 5, ${contaAvaliacoes(reviews.length)}`
      };
      aplicarNota();
      reviewsBody.innerHTML = `
        <div class="pd-reviews-score">
          <span class="pd-reviews-avg">${mediaTexto}</span>
          <span class="pd-stars pd-stars-lg">${estrelas(media)}</span>
          <span class="pd-reviews-count">${contaAvaliacoes(reviews.length)}</span>
        </div>
        <ul class="pd-reviews-list">
          ${reviews.map(r => `
            <li class="pd-review">
              <div class="pd-review-head">
                <span class="pd-review-name">${esc(r.reviewer_name)}</span>
                <span class="pd-stars" aria-label="${r.rating} de 5 estrelas">${estrelas(r.rating)}</span>
              </div>
              <span class="pd-review-date">${new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              ${r.comment ? `<p>${esc(r.comment)}</p>` : ''}
            </li>`).join('')}
        </ul>`;
    })();
  }

  /* =========================================================
     página coleção (colecao.html): busca + selects + grade
     ========================================================= */
  const productGrid = document.getElementById('productGrid');
  if (productGrid) {
    function cardHtml(p) {
      return `
        <article class="product-card reveal in" data-id="${p.id}" data-brand="${p.brandFilter}" data-family="${p.familyFilter}" data-name="${p.name.toLowerCase()}">
          <div class="product-visual${p.artBg ? ' full-art' : ''}">
            <span class="brand-tag">${p.brand}</span>
            ${p.inStock === false ? '<span class="status-badge status-cancelado stock-badge">Esgotado</span>' : ''}
            <img class="product-photo" src="${p.img}" alt="${p.name}, ${p.brand}" loading="lazy">
            ${p.artBg ? '' : '<span class="shine" aria-hidden="true"></span>'}
          </div>
          <div class="product-info">
            <span class="p-eyebrow">${p.family}</span>
            <h3><a class="product-card-link" href="${linkProduto(p.id)}">${p.name}</a></h3>
            <div class="card-rating" data-cardrating="${p.id}" hidden></div>
            <div class="product-notes">
              <span class="note-pill">${(p.top || '—').split(',')[0]}</span>
              <span class="note-pill">${(p.heart || '—').split(',')[0]}</span>
              <span class="note-pill">${(p.base || '—').split(',')[0]}</span>
            </div>
            <div class="product-foot">
              <span class="product-price">${fmt(p.fullPrice)} <small>· frasco ${p.fullSize}ml</small></span>
              <button class="add-cart-btn" data-quickadd="${p.id}" aria-label="Adicionar ${p.name} ao carrinho" ${p.inStock === false ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h2l2.4 12.6a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/></svg>
              </button>
            </div>
          </div>
        </article>
      `;
    }
    function loadCardRatings(list) {
      if (!window.emAuth || !window.emAuth.isConfigured || !list.length) return;
      window.emAuth.getReviewsSummary(list.map(p => p.id)).then(resumo => {
        resumo.forEach(r => {
          const el = productGrid.querySelector(`[data-cardrating="${r.product_id}"]`);
          if (!el) return;
          el.hidden = false;
          const media = Number(r.media);
          el.setAttribute('aria-label', `Nota ${media.toFixed(1).replace('.', ',')} de 5, ${contaAvaliacoes(r.total)}`);
          el.innerHTML = `<span class="pd-stars">${estrelas(media)}</span> ${media.toFixed(1).replace('.', ',')} <span class="card-rating-count">(${r.total})</span>`;
        });
      });
    }
    function renderGrid(list) {
      productGrid.innerHTML = list.length ? list.map(cardHtml).join('') : '<p class="catalog-empty">Nenhum perfume encontrado com esses filtros.</p>';
      loadCardRatings(list);
    }
    function appendCards(list) {
      if (!list.length) return;
      productGrid.querySelector('.catalog-empty')?.remove();
      productGrid.insertAdjacentHTML('beforeend', list.map(cardHtml).join(''));
      loadCardRatings(list);
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
      // descarta linhas sem foto própria: sem image_bg_url/image_url o card
      // cairia no favicon do site como "foto do perfume", o que parece quebrado.
      const linhasComFoto = linhas.filter(r => r.image_bg_url || r.image_url);
      if (linhasComFoto.length) {
        const precos = await window.emAuth.getPricesFor(linhasComFoto.map(r => r.id));
        if (meuToken !== catalogLoadingSeq) return;
        const produtos = linhasComFoto.map(r => normalizeCatalogRow(r, precos));
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
      renderGrid(currentFiltered());
      // o catálogo importado (fotos de procedência variada) só entra quando a
      // pessoa pede explicitamente em "Carregar mais" — evita que a grade
      // premium curada já abra misturada com fotos de qualidade inconsistente.
      if (loadMoreBtn) loadMoreBtn.hidden = !(window.emAuth && window.emAuth.isConfigured);
    }
    refreshCollectionGrid = refresh;

    let searchDebounceTimer;
    if (searchInput) searchInput.addEventListener('input', () => {
      refresh();
      clearTimeout(searchDebounceTimer);
      const term = searchInput.value.trim();
      if (!term) return;
      // com termo de busca, já traz o catálogo importado automaticamente —
      // antes, um perfume que só existe no catálogo importado (não é um dos
      // curados) nunca aparecia na busca, só se a pessoa clicasse "Carregar
      // mais" por conta própria depois de digitar.
      searchDebounceTimer = setTimeout(() => {
        loadMoreCatalog();
        if (window.emAuth) window.emAuth.logEvent('search', { term });
      }, 500);
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

    // clique em qualquer parte do card abre a página do produto; o botão de carrinho só adiciona
    productGrid.addEventListener('click', e => {
      const card = e.target.closest('.product-card');
      if (!card) return;
      const quickAddBtn = e.target.closest('[data-quickadd]');
      if (quickAddBtn) {
        addToCart(quickAddBtn.dataset.quickadd);
        return;
      }
      if (e.target.closest('a')) return; // o próprio link do nome já navega
      window.location.href = linkProduto(card.dataset.id);
    });

    // links antigos (colecao#p-<id>, compartilhados antes da página de produto existir)
    if (location.hash.startsWith('#p-')) {
      location.replace(linkProduto(decodeURIComponent(location.hash.slice(3))));
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
            <a class="btn btn-solid" href="${linkProduto(top.p.id)}">Ver ${top.p.name}</a>
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
     fullPrice/inStock nos produtos já carregados e re-renderiza.
     Só lemos o preço de frasco fechado — não vendemos decant no momento.
     Busca só os preços dos produtos curados (por id) — a tabela inteira
     cresce pra dezenas de milhares de linhas com o catálogo importado
     (js/auth.js:getCatalogPage já busca preço filtrado pra esses).
     ========================================================= */
  if (window.emAuth && window.emAuth.isConfigured && PRODUCTS.length) {
    window.emAuth.getPricesFor(PRODUCTS.map(p => p.id)).then(rows => {
      if (!rows.length) return;
      rows.forEach(row => {
        if (row.size !== 'full') return;
        const p = findProduct(row.product_id);
        if (!p) return;
        p.fullPrice = Number(row.price);
        p.inStock = row.in_stock !== false;
      });
      if (refreshCollectionGrid) refreshCollectionGrid();
      if (refreshProductPage) refreshProductPage();
    });
  }

})();
