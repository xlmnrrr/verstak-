/**
 * Приёмка пакета правок после этапа 4 в окне Electron: первый выбор без провала, подписи нижней строки на 1424 px,
 * метка пересечений в штампе, «Растянуть до N» по нише, кнопки-исправления открывания в «Проверках».
 * Запуск: node scripts/проверка-П.cjs http://127.0.0.1:5274/ ; скриншоты — проверка\v2\П-*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза, открытьПример } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-П');
const выгрузка = path.join(корень, 'проверка', 'выгрузка-П');
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  for (const папка of [данные, выгрузка]) fs.rmSync(папка, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9391, доп: { VERSTAK_AUTOSAVE_SEC: '3600', VERSTAK_EXPORT_DIR: выгрузка } });
  const t0 = Date.now();
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9391);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true, каталогОткрыт: false, заказ: '2026-0142', клиент: 'Иванов И. И.', дизайнер: 'Макар' })));
    await стр.reload();
    await пауза(2000);
    const cdp = await стр.createCDPSession();

    /* ---------- 1. первый выбор изделия: самая длинная задача и скелет (CPU×4) ---------- */
    await открытьПример(стр);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await S(() => {
      window.__долгие = [];
      new PerformanceObserver((л) => {
        for (const з of л.getEntries()) window.__долгие.push(Math.round(з.duration));
      }).observe({ entryTypes: ['longtask'] });
      window.__скелет = null;
      window.__кадры = [];
      const м = new MutationObserver(() => {
        if (document.querySelector('.скелет-свойств') && window.__скелет === null) window.__скелет = performance.now();
      });
      м.observe(document.body, { childList: true, subtree: true });
      window.__верстакStore.getState().выбрать([]);
    });
    await пауза(600);
    await S(() => {
      const п = window.__верстакStore.getState().проект2;
      window.__т0 = performance.now();
      let последний = performance.now();
      const шаг = () => {
        const сейчас = performance.now();
        window.__кадры.push(Math.round(сейчас - последний));
        последний = сейчас;
        if (сейчас - window.__т0 < 1500) requestAnimationFrame(шаг);
      };
      requestAnimationFrame(шаг);
      window.__верстакStore.getState().выбрать([п.объекты[2].id]);
    });
    await пауза(2000);
    const р1 = await S(() => ({ долгие: window.__долгие, самый_долгий_кадр: Math.max(...window.__кадры), скелет_через: window.__скелет === null ? null : Math.round(window.__скелет - window.__т0), панель: !!document.querySelector('.выезд.открыта .выезд-тело h3') }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    проверка('первый выбор при CPU×4: панель открылась, самый длинный кадр записан', р1.панель, JSON.stringify(р1));
    await стр.screenshot({ path: path.join(снимки, 'П-панель-свойств.png') });
    await S(() => window.__верстакStore.getState().выбрать([]));

    /* ---------- 2. нижняя строка на 1424 px ---------- */
    await стр.setViewport({ width: 1424, height: 860 });
    await пауза(500);
    const низ = await S(() => {
      const н = document.querySelector('footer.низ');
      const подписи = [...н.querySelectorAll('.подпись-кн')].map((x) => ({ т: x.textContent.trim(), видна: getComputedStyle(x).display !== 'none' }));
      const вылезает = [...н.querySelectorAll('button, .плашка, select')].filter((x) => x.getBoundingClientRect().right > н.getBoundingClientRect().right + 1 || x.getBoundingClientRect().left < -1).length;
      return { подписи, переполнение: н.scrollWidth > н.clientWidth + 1, вылезает };
    });
    проверка('1424 px: подписи «Двиг.», «Растянуть», «Крут.», «Клиенту» видны', ['Двиг.', 'Растянуть', 'Крут.', 'Клиенту'].every((т) => низ.подписи.some((п) => п.т === т && п.видна)), JSON.stringify(низ.подписи));
    проверка('1424 px: нижняя строка не переполнена', !низ.переполнение && низ.вылезает === 0, `переполнение ${низ.переполнение}, вылезает ${низ.вылезает}`);
    await стр.screenshot({ path: path.join(снимки, 'П-низ-1424.png') });
    await стр.setViewport({ width: 1180, height: 860 });
    await пауза(400);
    const узко = await S(() => [...document.querySelectorAll('footer.низ .подпись-кн')].every((x) => getComputedStyle(x).display === 'none'));
    проверка('1180 px: подписи прячутся, остаются значки', узко);
    await стр.setViewport({ width: 1600, height: 900 });
    await пауза(300);

    /* ---------- 3. штамп: у чистого демо нет пометки о пересечениях ---------- */
    const ок = await S(() => window.__верстакВыгрузка('pdf'));
    await пауза(500);
    const файлы = fs.existsSync(выгрузка) ? fs.readdirSync(выгрузка) : [];
    const html = файлы.find((x) => x.endsWith('.html'));
    const текст = html ? fs.readFileSync(path.join(выгрузка, html), 'utf8') : '';
    проверка('штамп демо-кухни: пометки «Есть пересечения» и «Выступов» нет', ок === true && !!html && !/Есть пересечения|Выступов за стены/.test(текст), `выгружено: ${файлы.join(', ')}`);

    /* ---------- помощники для сцен ---------- */
    const новая = async () => {
      await S(() => {
        const с = window.__верстакStore.getState();
        с.создать('Правки', { длина: 6000, ширина: 4000, высота_стен: 2700, толщина_стен: 100, форма: 'прямоугольник', обои: '#d8cdb8', пол: '#a58865', фон: '#171a1f' });
        if (!window.__верстакStore.getState().прилипание) window.__верстакStore.getState().переключитьПрилипание();
        window.__верстакStore.getState().установитьОбзор('сверху');
      });
      await пауза(900);
      await S(() => window.__кухня.поставитьКамеру(0, 7.2, 4.2, 0, -1.05));
      await пауза(300);
    };
    const добавить = (изд, x, z, правка = null, y = 0) =>
      S(
        (и, x, z, п, y) => {
          const с = window.__верстакStore.getState();
          const ид = с.добавитьМодуль(и, [x, y, z]);
          if (п) window.__верстакStore.getState().обновитьГабариты(ид, п);
          window.__верстакStore.getState().выбрать([]);
          return ид;
        },
        изд, x, z, правка, y,
      );
    const экз = (id) => S((i) => JSON.parse(JSON.stringify(window.__верстакStore.getState().проект2.объекты.find((x) => x.id === i) ?? null)), id);
    const экран = (x, y, z) => S((x, y, z) => window.__кухня.экраннаяТочка(x, y, z), x / 1000, y / 1000, z / 1000);

    /* ---------- 4. «Растянуть до 437» ---------- */
    await новая();
    await S(() => window.__верстакStore.getState().установитьШаг(1));
    await добавить('тумба-ящики-600', -1500, -1700);
    await добавить('тумба-ящики-600', -463, -1700);
    const C = await добавить('тумба-ящики-600', 1500, -1700, { ш: 400 });
    const a = await экран(1500 + 200, 0, -1700 - 150);
    const b = await экран(-981 + 200, 0, -1700 - 150);
    await стр.mouse.move(a.x, a.y);
    await стр.mouse.down();
    for (let i = 1; i <= 14; i++) {
      await стр.mouse.move(a.x + ((b.x - a.x) * i) / 14, a.y + ((b.y - a.y) * i) / 14);
      await пауза(30);
    }
    await пауза(120);
    await стр.mouse.up();
    await пауза(500);
    const карточка = await S(() => {
      const к = document.querySelector('.карточка-ниши');
      return к ? { текст: к.textContent, кнопки: [...к.querySelectorAll('button')].map((x) => x.textContent.trim()) } : null;
    });
    проверка('тумба 400 в проёме 437: карточка «Проём 437 мм … растянуть» и кнопка «Растянуть до 437»', !!карточка && /Проём 437 мм/.test(карточка.текст) && карточка.кнопки.some((т) => /Растянуть до 437/.test(т)), JSON.stringify(карточка));
    await стр.screenshot({ path: path.join(снимки, 'П-растянуть-по-нише.png') });
    await S(() => [...document.querySelectorAll('.карточка-ниши button')].find((x) => /Растянуть/.test(x.textContent))?.click());
    await пауза(500);
    const после = await экз(C);
    проверка('после «Растянуть до 437»: ширина 437, встала без зазора между соседями', после && после.габариты.ш === 437 && Math.abs(после.позиция[0] - -981.5) <= 1, JSON.stringify({ ш: после?.габариты.ш, x: после?.позиция[0] }));
    // отмена возвращает прежнюю ширину
    await S(() => window.__верстакStore.getState().отменить());
    await пауза(200);
    проверка('Ctrl+Z возвращает ширину 400', (await экз(C))?.габариты.ш === 400);

    /* ---------- 5. кнопки-исправления открывания ---------- */
    await новая();
    const Ш = await добавить('навесной-600', -3000 + 300 + 1, -2000 + 160 + 1, { ш: 600, г: 320, в: 720 }, 1400);
    await S((id) => window.__верстакStore.getState().обновитьОбъект(id, { петли: 'слева' }), Ш);
    await S(() => document.querySelector('button[aria-label="Проверки"]')?.click());
    await пауза(600);
    const окно1 = await S(() => ({ текст: document.querySelector('.модал.окно')?.innerText ?? '', кнопки: [...document.querySelectorAll('.исправления button')].map((x) => x.textContent.trim()) }));
    проверка('конфликт на 110°: в «Проверках» есть кнопка «Переставить петли»', /не откроется/.test(окно1.текст) && окно1.кнопки.includes('Переставить петли'), JSON.stringify(окно1).slice(0, 300));
    await стр.screenshot({ path: path.join(снимки, 'П-проверки-кнопки-110.png') });
    await S(() => [...document.querySelectorAll('.исправления button')].find((x) => x.textContent.trim() === 'Переставить петли')?.click());
    await пауза(600);
    const окно2 = await S(() => document.querySelector('.модал.окно')?.innerText ?? '');
    const после2 = await экз(Ш);
    проверка('«Переставить петли» снимает конфликт: петли справа, в окне «Всё в порядке»', после2?.раскладка?.фасад?.петли === 'справа' && /Всё в порядке/.test(окно2), `петли ${после2?.раскладка?.фасад?.петли}`);
    await стр.keyboard.press('Escape');
    await пауза(300);

    await новая();
    const У = await добавить('навесной-600', -3000 + 225 + 1, -2000 + 160 + 1, { ш: 450, г: 320, в: 720 }, 1400);
    await S((id) => window.__верстакStore.getState().обновитьОбъект(id, { петли: 'слева' }), У);
    await S(() => document.querySelector('button[aria-label="Проверки"]')?.click());
    await пауза(600);
    const окно3 = await S(() => [...document.querySelectorAll('.исправления button')].map((x) => x.textContent.trim()));
    проверка('узкий шкаф у стены: есть «Дать зазор 150 мм»', окно3.includes('Дать зазор 150 мм'), JSON.stringify(окно3));
    await S(() => [...document.querySelectorAll('.исправления button')].find((x) => /Дать зазор/.test(x.textContent))?.click());
    await пауза(600);
    const после3 = await экз(У);
    const окно4 = await S(() => document.querySelector('.модал.окно')?.innerText ?? '');
    проверка('после «Дать зазор 150 мм» до стены 150 мм, конфликта нет', после3 && Math.abs(после3.позиция[0] - 225 - -3000 - 150) <= 1 && /Всё в порядке/.test(окно4), `x=${после3?.позиция[0]}, зазор ${после3 ? Math.round(после3.позиция[0] - 225 + 3000) : '?'}`);
    await стр.screenshot({ path: path.join(снимки, 'П-проверки-после-зазора.png') });

    проверка('в консоли нет ошибок и ошибок шейдеров', к.шейдер.length === 0 && к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e)).length === 0, (к.ошибки[0] ?? '').slice(0, 200));
    await браузер.disconnect();
  } catch (е) {
    проверка('сбой приёмки', false, е && е.message ? е.message : String(е));
  } finally {
    try {
      процесс.kill();
    } catch {
      /* окно уже закрыто */
    }
  }
  const ок = итоги.filter((x) => x.ок).length;
  console.log(`\nИтог: ${ок} из ${итоги.length}, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  process.exit(ок === итоги.length ? 0 : 1);
})();
