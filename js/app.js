(function(){
  'use strict';

  // ---- PWA: register service worker (safe to ignore failures, e.g. on http://) ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // A small fixed palette of warm, muted cover colors — books are assigned one
  // deterministically (by id) so the same book always gets the same color.
  const COVER_COLORS = ['#1F3A5F', '#7A5C42', '#5B6B4F', '#8A3B3B', '#3F5A57', '#6E4B6E'];
  function colorForId(id){
    let h = 0;
    for (let i=0;i<id.length;i++){ h = (h*31 + id.charCodeAt(i)) >>> 0; }
    return COVER_COLORS[h % COVER_COLORS.length];
  }

  const READ_KEY = 'biblioteka_read_ids';
  function getReadIds(){
    try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); } catch(e){ return []; }
  }
  function markRead(id){
    const ids = getReadIds();
    if (!ids.includes(id)){
      ids.push(id);
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    }
  }

  const shelfView = document.getElementById('shelfView');
  const readerView = document.getElementById('readerView');
  const shelvesEl = document.getElementById('shelves');
  const pageEl = document.getElementById('page');
  const dotsEl = document.getElementById('dots');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const closeBtn = document.getElementById('closeBtn');

  let DATA = { categories: [], books: [] };
  let currentBook = null;
  let currentPageIndex = 0;

  function bookCoverEl(book){
    const wrap = document.createElement('div');
    wrap.className = 'book-cover';
    wrap.innerHTML = `
      <div class="cover-art" style="background:${colorForId(book.id)}">
        <div class="cover-title">${escapeHtml(book.title)}</div>
      </div>
      <div class="cover-caption">${escapeHtml(book.title)}</div>
    `;
    wrap.addEventListener('click', () => openBook(book));
    return wrap;
  }

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderShelves(){
    shelvesEl.innerHTML = '';

    DATA.categories.forEach(cat => {
      const books = DATA.books.filter(b => b.category === cat);
      if (!books.length) return;
      shelvesEl.appendChild(buildShelf(cat, books));
    });

    // "Прочитані книжки" — pulled from local read-tracking, always last
    const readIds = getReadIds();
    const readBooks = DATA.books.filter(b => readIds.includes(b.id));
    const readShelf = buildShelf('Прочитані книжки', readBooks, 'Тут з’являться книжки, які вже прочитано');
    shelvesEl.appendChild(readShelf);
  }

  function buildShelf(title, books, emptyText){
    const shelf = document.createElement('div');
    shelf.className = 'shelf';
    const heading = document.createElement('div');
    heading.className = 'shelf-title';
    heading.textContent = title;
    shelf.appendChild(heading);

    if (!books.length){
      const empty = document.createElement('div');
      empty.className = 'shelf-empty';
      empty.textContent = emptyText || '';
      shelf.appendChild(empty);
      return shelf;
    }

    const row = document.createElement('div');
    row.className = 'shelf-row';
    books.forEach(b => row.appendChild(bookCoverEl(b)));
    shelf.appendChild(row);
    return shelf;
  }

  function openBook(book){
    currentBook = book;
    currentPageIndex = 0;
    shelfView.classList.remove('active');
    readerView.classList.add('active');
    renderPage();
  }

  function closeBook(){
    readerView.classList.remove('active');
    shelfView.classList.add('active');
    renderShelves(); // refresh in case "read" shelf changed
  }

  function renderPage(){
    const total = currentBook.pages.length;
    const isFirst = currentPageIndex === 0;
    const isLast = currentPageIndex === total - 1;
    const p = currentBook.pages[currentPageIndex];

    let inner = '<div class="page-inner">';
    if (isFirst){
      inner += `<div class="page-title">${escapeHtml(currentBook.title)}</div>`;
    }
    inner += `<div class="page-text">${escapeHtml(p.text)}</div>`;
    if (isLast){
      inner += `<div class="page-end"><div class="again">Кінець</div></div>`;
      markRead(currentBook.id);
    }
    inner += '</div>';
    pageEl.innerHTML = inner;
    pageEl.scrollTop = 0;

    prevBtn.disabled = isFirst;
    nextBtn.disabled = isLast;

    dotsEl.innerHTML = '';
    currentBook.pages.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i === currentPageIndex ? ' active' : '');
      dotsEl.appendChild(dot);
    });
  }

  prevBtn.addEventListener('click', () => {
    if (currentPageIndex > 0){ currentPageIndex--; renderPage(); }
  });
  nextBtn.addEventListener('click', () => {
    if (currentPageIndex < currentBook.pages.length - 1){ currentPageIndex++; renderPage(); }
  });
  closeBtn.addEventListener('click', closeBook);

  // simple swipe support
  let touchStartX = null;
  readerView.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, {passive:true});
  readerView.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50){
      if (dx < 0 && !nextBtn.disabled) nextBtn.click();
      if (dx > 0 && !prevBtn.disabled) prevBtn.click();
    }
    touchStartX = null;
  }, {passive:true});

  // keyboard nav (handy when testing on desktop)
  document.addEventListener('keydown', (e) => {
    if (!readerView.classList.contains('active')) return;
    if (e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'ArrowLeft') prevBtn.click();
    if (e.key === 'Escape') closeBook();
  });

  fetch('books/books.json')
    .then(r => r.json())
    .then(data => {
      DATA = data;
      renderShelves();
    })
    .catch(() => {
      shelvesEl.innerHTML = '<div class="shelf-empty" style="padding:20px 28px;">Не вдалося завантажити книжки.</div>';
    });
})();
