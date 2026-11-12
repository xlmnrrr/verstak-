/**
 * Приёмка 1Б-2 в окне Electron: экраны и состояния, мастер (три способа), квартира по сетке, вкладки и план, каталог, проверки,
 * настройки, справка, экспорт, память интерфейса, клавиатура, нормы (цели, шрифт, контраст текста и границ).
 * Запуск: node scripts/проверка-1Б2.cjs http://127.0.0.1:5274/
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-1Б2');
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, подр = '') => {
  итоги.push({ имя, ок: !!ок, подр });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${подр ? ' — ' + подр : ''}`);
};
const яркость = ([r, g, b]) => {
  const к = [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * к[0] + 0.7152 * к[1] + 0.0722 * к[2];
};
const контраст = (a, b) => {
  const [x, y] = [яркость(a), яркость(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** В странице: цели, шрифты, контраст текста, контраст границ полей и кнопок */
function измерить() {
  const разобрать = (с) => {
    let m = с.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const п = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { c: [п[0], п[1], п[2]], a: п[3] ?? 1 };
    }
    m = с.match(/color\(srgb ([^)]+)\)/);
    if (m) {
      const п = m[1].split(/[ /]+/).filter(Boolean).map(Number);
      return { c: [п[0] * 255, п[1] * 255, п[2] * 255], a: п[3] ?? 1 };
    }
    return null;
  };
  const смешать = (в, н) => ({ c: в.c.map((v, i) => v * в.a + н.c[i] * (1 - в.a)), a: 1 });
  const фон = (эл) => {
    const стек = [];
    for (let e = эл; e; e = e.parentElement) {
      const б = разобрать(getComputedStyle(e).backgroundColor);
      if (б && б.a > 0) {
        стек.push(б);
        if (б.a >= 1) break;
      }
    }
    let ф = разобрать(getComputedStyle(document.body).backgroundColor) ?? { c: [255, 255, 255], a: 1 };
    for (const б of стек.reverse()) ф = смешать(б, ф);
    return ф;
  };
  const видим = (эл) => {
    const r = эл.getBoundingClientRect();
    const ст = getComputedStyle(эл);
    return r.width > 0 && r.height > 0 && ст.visibility !== 'hidden' && ст.display !== 'none' && !эл.closest('[aria-hidden="true"]');
  };
  const цели = [];
  for (const эл of document.querySelectorAll('button, select, input:not([type=color]):not([type=checkbox]), a, [role=button]')) {
    if (!видим(эл)) continue;
    if (эл.classList.contains('клетка') || эл.classList.contains('звезда-мал')) continue;
    const r = эл.getBoundingClientRect();
    цели.push({ имя: (эл.getAttribute('aria-label') || эл.textContent || эл.className).toString().trim().slice(0, 30), ш: Math.round(r.width), в: Math.round(r.height), главная: эл.matches('.кн.главная, .действие.главное') });
  }
  const текст = [];
  const обход = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let у = обход.nextNode(); у; у = обход.nextNode()) {
    const т = у.textContent.trim();
    const эл = у.parentElement;
    if (!т || !эл || !видим(эл) || эл.closest('canvas, script, style, svg')) continue;
    const ст = getComputedStyle(эл);
    const цв = разобрать(ст.color);
    if (!цв) continue;
    const ф = фон(эл);
    текст.push({ т: т.slice(0, 24), px: parseFloat(ст.fontSize), цвет: смешать(цв, ф).c, фон: ф.c, подпись: !!эл.closest('label, .кл, .штамп, .материал, small, .поле, .звезда-мал') });
  }
  const границы = [];
  for (const эл of document.querySelectorAll('.кн:not(.тихая), .чип, .поле input, .поле select, .каталог-поиск input, .низ select')) {
    if (!видим(эл)) continue;
    const ст = getComputedStyle(эл);
    const б = разобрать(ст.borderTopColor);
    if (!б || б.a === 0 || parseFloat(ст.borderTopWidth) < 1) continue;
    границы.push({ имя: (эл.textContent || эл.className).toString().trim().slice(0, 24), цвет: б.c, фон: фон(эл.parentElement).c });
  }
  return { цели, текст, границы, тема: document.documentElement.dataset.theme };
}

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const исх = path.join(корень, 'проверка', 'копия-до-прогона', 'Пример_ кухня из шаблонов.kitchen');
  for (const имя of ['Пример_ кухня из шаблонов', 'Очень длинное название проекта кухня-гостиная с островом для семьи Ивановых']) fs.copyFileSync(исх, path.join(данные, 'Проекты', имя + '.kitchen'));
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  const нормы = {};
  try {
    const { браузер, стр } = await подключиться(АДРЕС);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);

    /* первый запуск и тур */
    await стр.screenshot({ path: path.join(снимки, '1Б2-01-первый-запуск.png') });
    const диалог = await S(() => !!document.querySelector('[aria-label="Первый запуск"]'));
    await S(() => [...document.querySelectorAll('.модал button')].find((b) => b.textContent.includes('Дальше'))?.click());
    await пауза(300);
    const шагТура = await S(() => document.querySelector('.модал h3')?.textContent);
    await S(() => [...document.querySelectorAll('.модал button')].find((b) => b.textContent.includes('Пропустить'))?.click());
    await пауза(400);
    const флаг = await S(() => JSON.parse(localStorage.getItem('верстак:интерфейс') || '{}').туркПройден);
    проверка('первый запуск: тема и тур, «Пропустить» запоминается', диалог && !!шагТура && флаг === true, `шаг тура: «${шагТура}»`);

    /* клавиатура: Tab показывает фокус-кольцо */
    await стр.keyboard.press('Tab');
    await стр.keyboard.press('Tab');
    const фокус = await S(() => {
      const э = document.activeElement;
      return э && э !== document.body ? { тег: э.tagName, контур: getComputedStyle(э).outlineStyle, ширина: getComputedStyle(э).outlineWidth } : null;
    });
    проверка('клавиатура: Tab ставит фокус на кнопки, кольцо видно', фокус && фокус.контур !== 'none' && parseFloat(фокус.ширина) >= 2, JSON.stringify(фокус));
    нормы['обложка'] = await S(измерить);

    /* проекты: список, поиск, подтверждение удаления */
    await S(() => window.__верстакStore.getState().наЭкран('проекты'));
    await пауза(1200);
    const всего = await S(() => document.querySelectorAll('.проект-карточка').length);
    await стр.screenshot({ path: path.join(снимки, '1Б2-02-проекты.png') });
    await S(() => {
      const и = document.querySelector('.панель-поиска input');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(и, 'длинное');
      и.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await пауза(300);
    const послеПоиска = await S(() => document.querySelectorAll('.проект-карточка').length);
    await S(() => [...document.querySelectorAll('.проект-карточка button')].find((b) => b.textContent.trim() === 'Удалить')?.click());
    await пауза(300);
    const подтверждение = await S(() => !!document.querySelector('[role=alertdialog]'));
    await стр.keyboard.press('Escape');
    await пауза(200);
    const закрыт = await S(() => !document.querySelector('[role=alertdialog]'));
    const подсказка = await S(() => document.querySelector('.проект-карточка .имя')?.getAttribute('title'));
    нормы['проекты'] = await S(измерить);
    проверка('проекты: сетка, поиск, подтверждение удаления, подсказка с полным именем', всего === 2 && послеПоиска === 1 && подтверждение && закрыт && !!подсказка, `всего ${всего}, по поиску ${послеПоиска}`);

    /* мастер: способы, пресет заказчика */
    await S(() => window.__верстакStore.getState().наЭкран('комната'));
    await пауза(500);
    await стр.screenshot({ path: path.join(снимки, '1Б2-03-мастер-контур.png') });
    await S(() => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes('Контур'))?.click());
    await пауза(300);
    await S(() => [...document.querySelectorAll('.сегменты button')].find((b) => b.textContent.includes('П-образная'))?.click());
    await S(() => [...document.querySelectorAll('.кн.главная')].find((b) => b.textContent.includes('Создать'))?.click());
    await пауза(2500);
    const формаП = await S(() => window.__верстакStore.getState().проект2.помещения[0].контур.length);
    проверка('мастер, способ «контур»: форма П создаёт помещение из 8 точек', формаП === 8, `точек ${формаП}`);
    await S(() => window.__верстакStore.getState().наЭкран('комната'));
    await пауза(400);
    await S(() => [...document.querySelectorAll('.чип')].find((b) => b.textContent.toLowerCase().includes('гардероб'))?.click());
    await пауза(2500);
    const пресет = await S(() => ({ экран: window.__верстакStore.getState().экран, имя: window.__верстакStore.getState().проект2.помещения[0].название }));
    проверка('пресет помещения заказчика одним кликом открывает редактор', пресет.экран === 'редактор', пресет.имя);

    /* квартира по сетке: закрашиваем три помещения мышью */
    await S(() => window.__верстакStore.getState().наЭкран('комната'));
    await пауза(400);
    await S(() => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.includes('Квартира'))?.click());
    await пауза(300);
    const красить = (брейш, клетки) =>
      S(
        (б, кл) => {
          if (б) [...document.querySelectorAll('.кисти button')].find((x) => x.textContent.trim().startsWith(б))?.click();
          const эл = [...document.querySelectorAll('.клетка')];
          for (const [r, c] of кл) эл[r * 10 + c].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        },
        брейш,
        клетки,
      );
    await красить(null, [[0, 0], [0, 1], [1, 0], [1, 1]]);
    await S(() => [...document.querySelectorAll('.кисти button')].find((b) => b.textContent.trim() === 'Кухня')?.click());
    await красить(null, [[0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4]]);
    await S(() => [...document.querySelectorAll('.кисти button')].find((b) => b.textContent.trim() === 'Ванная')?.click());
    await красить(null, [[2, 0], [2, 1], [2, 2]]);
    await стр.screenshot({ path: path.join(снимки, '1Б2-04-мастер-квартира-по-сетке.png') });
    await S(() => [...document.querySelectorAll('.кн.главная')].find((b) => b.textContent.includes('Собрать'))?.click());
    await пауза(3000);
    const кв = await S(() => {
      const п = window.__верстакStore.getState().проект2;
      return { помещений: п.помещения.length, связей: п.связи.length, двери: п.помещения.flatMap((x) => x.отметки.filter((о) => о.вид === 'дверь')).length, вкладок: document.querySelectorAll('.вкладки-помещений [role=tab]').length };
    });
    проверка('квартира по сетке: 3 помещения → общие стены, двери, вкладки в верхней строке', кв.помещений === 3 && кв.связей >= 2 && кв.двери >= 2 && кв.вкладок === 3, JSON.stringify(кв));
    await стр.screenshot({ path: path.join(снимки, '1Б2-05-редактор-вкладки-миникарта.png') });

    /* план квартиры и переход */
    await S(() => [...document.querySelectorAll('.вкладка')].find((b) => b.textContent.includes('План квартиры'))?.click());
    await пауза(500);
    await стр.screenshot({ path: path.join(снимки, '1Б2-06-план-квартиры.png') });
    const до = await S(() => window.__верстакStore.getState().помещениеАктивное);
    await S(() => document.querySelectorAll('.план-комната')[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await пауза(1200);
    const после = await S(() => ({ акт: window.__верстакStore.getState().помещениеАктивное, план: !!document.querySelector('.план-квартиры') }));
    проверка('«План квартиры сверху»: клик по помещению переводит в него и закрывает план', после.акт !== до && !после.план, `${до} → ${после.акт}`);
    const миниКарта = await S(() => !!document.querySelector('.мини-карта svg polygon'));
    проверка('мини-карта комнаты в углу сцены', миниКарта);

    /* каталог: поиск по габаритам, избранное, недавние, память */
    await S(() => window.__верстакStore.getState().переключитьКаталог(true));
    await пауза(500);
    await S(() => {
      const и = document.querySelector('.каталог-поиск input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(и, 'шкаф 600');
      и.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await пауза(400);
    const найдено = await S(() => document.querySelectorAll('.выезд.слева .позиция').length);
    await S(() => document.querySelector('.выезд.слева .звезда')?.click());
    await S(() => document.querySelector('.выезд.слева .позиция')?.click());
    await пауза(500);
    await стр.screenshot({ path: path.join(снимки, '1Б2-07-каталог-поиск.png') });
    const ui = await S(() => JSON.parse(localStorage.getItem('верстак:интерфейс')));
    проверка('каталог: поиск «шкаф 600», избранное и недавние сохраняются', найдено > 0 && ui.избранное.length === 1 && ui.недавние.length === 1, `найдено ${найдено}`);
    нормы['каталог'] = await S(измерить);

    /* свойства, свернуть, материалы */
    await S(() => window.__верстакStore.getState().переключитьКаталог(false));
    await пауза(300);
    const выбранный = await S(() => window.__верстакStore.getState().выбрано.length);
    await S(() => document.querySelector('[aria-label="Свернуть свойства"]')?.click());
    await пауза(400);
    const свёрнуто = await S(() => !document.querySelector('.выезд.справа.открыта') && !!document.querySelector('.язычок'));
    await S(() => document.querySelector('.язычок')?.click());
    await пауза(400);
    await стр.screenshot({ path: path.join(снимки, '1Б2-08-свойства-материалы.png') });
    нормы['свойства'] = await S(измерить);
    const материалы = await S(() => ({ поиск: !!document.querySelector('[aria-label="Поиск материала"]'), пипетка: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Пипетка'), свой: !!document.querySelector('[aria-label="Выбрать свой цвет"]') }));
    проверка('свойства: свернуть/развернуть панель; материалы с поиском, пипеткой и своим цветом', выбранный === 1 && свёрнуто && материалы.поиск && материалы.пипетка && материалы.свой, JSON.stringify(материалы));

    /* окна */
    for (const [ид, имя] of [['проверки', '09-проверки'], ['настройки', '10-настройки'], ['справка', '11-справка'], ['экспорт', '12-экспорт']]) {
      await S((и) => window.__верстакStore && import('/src/store/интерфейс.ts').then((m) => (window.__ui = m.useUI)) && 0, ид);
      await S((и) => [...document.querySelectorAll('.полоса .кн-и')].find((b) => b.getAttribute('aria-label') === { проверки: 'Проверки', настройки: 'Настройки', справка: 'Справка', экспорт: 'Экспорт' }[и])?.click(), ид);
      await пауза(500);
      const есть = await S(() => !!document.querySelector('.модал.окно'));
      await стр.screenshot({ path: path.join(снимки, `1Б2-${имя}.png`) });
      нормы[ид] = await S(измерить);
      проверка(`окно «${ид}» открывается`, есть);
      await стр.keyboard.press('Escape');
      await пауза(300);
    }
    // Esc: каталог, потом выделение
    await S(() => window.__верстакStore.getState().переключитьКаталог(true));
    await S(() => window.__верстакStore.getState().выбрать([window.__верстакStore.getState().проект2.объекты[0].id]));
    await стр.keyboard.press('Escape');
    const шаг1 = await S(() => ({ кат: window.__верстакStore.getState().каталогОткрыт, выбр: window.__верстакStore.getState().выбрано.length }));
    await стр.keyboard.press('Escape');
    const шаг2 = await S(() => window.__верстакStore.getState().выбрано.length);
    проверка('Esc закрывает каталог, второй Esc снимает выделение', шаг1.кат === false && шаг1.выбр === 1 && шаг2 === 0);

    /* память интерфейса после перезапуска окна */
    await S(() => window.__верстакStore.getState().переключитьКаталог(true));
    await стр.reload();
    await пауза(2500);
    const память = await S(() => ({ кат: window.__верстакStore.getState().каталогОткрыт, тур: JSON.parse(localStorage.getItem('верстак:интерфейс')).туркПройден }));
    проверка('интерфейс помнит каталог и пройденный тур после перезапуска', память.кат === true && память.тур === true, JSON.stringify(память));

    /* нормы */
    const мелкие = [];
    const мелкийШрифт = [];
    const слабыйТекст = [];
    const слабыеГраницы = [];
    let минЦель = 999;
    let минТекст = 99;
    let минКонтраст = 99;
    let минГраница = 99;
    for (const [экран, н] of Object.entries(нормы)) {
      for (const ц of н.цели) {
        if (!ц.главная) минЦель = Math.min(минЦель, Math.min(ц.ш, ц.в));
        if (Math.min(ц.ш, ц.в) < 32) мелкие.push(`${экран}: ${ц.имя} ${ц.ш}×${ц.в}`);
        if (ц.главная && ц.в < 40) мелкие.push(`${экран}: главная ${ц.имя} ${ц.в}`);
      }
      for (const т of н.текст) {
        if (!т.подпись) минТекст = Math.min(минТекст, т.px);
        if ((!т.подпись && т.px < 13) || т.px < 12) мелкийШрифт.push(`${экран}: ${т.т} ${т.px}`);
        const к2 = контраст(т.цвет, т.фон);
        минКонтраст = Math.min(минКонтраст, к2);
        if (к2 < 4.5) слабыйТекст.push(`${экран}: ${т.т} ${к2.toFixed(2)}`);
      }
      for (const г of н.границы) {
        const к2 = контраст(г.цвет, г.фон);
        минГраница = Math.min(минГраница, к2);
        if (к2 < 3) слабыеГраницы.push(`${экран}: ${г.имя} ${к2.toFixed(2)}`);
      }
    }
    проверка('цели ≥ 32 px, главные кнопки ≥ 40 px', мелкие.length === 0, `минимум ${минЦель} px; нарушений ${мелкие.length}${мелкие.length ? ': ' + мелкие.slice(0, 5).join('; ') : ''}`);
    проверка('шрифт ≥ 13 px (подписи ≥ 12)', мелкийШрифт.length === 0, `минимум текста ${минТекст} px${мелкийШрифт.length ? '; ' + мелкийШрифт.slice(0, 5).join('; ') : ''}`);
    проверка('контраст текста ≥ 4,5:1 (тёмная тема, 12 экранов и окон)', слабыйТекст.length === 0, `минимум ${минКонтраст.toFixed(2)}${слабыйТекст.length ? '; ' + слабыйТекст.slice(0, 5).join('; ') : ''}`);
    проверка('контраст границ полей и кнопок ≥ 3:1 (тёмная тема)', слабыеГраницы.length === 0, `минимум ${минГраница.toFixed(2)}${слабыеГраницы.length ? '; ' + слабыеГраницы.slice(0, 5).join('; ') : ''}`);

    /* светлая тема: те же нормы на трёх главных экранах */
    await S(() => { const ст = document.createElement('style'); ст.textContent = '*{transition:none !important}'; document.head.appendChild(ст); });
    await S(() => window.__верстакStore.getState().установитьТему('калька'));
    await пауза(600);
    const светлые = [];
    for (const [имя, действие] of [
      ['редактор', () => window.__верстакStore.getState().выбрать([window.__верстакStore.getState().проект2.объекты[0]?.id].filter(Boolean))],
      ['проекты', () => window.__верстакStore.getState().наЭкран('проекты')],
      ['мастер', () => window.__верстакStore.getState().наЭкран('комната')],
    ]) {
      await S(действие);
      await пауза(900);
      светлые.push(await S(измерить));
      if (имя === 'редактор') await стр.screenshot({ path: path.join(снимки, '1Б2-13-редактор-калька.png') });
    }
    let кт = 99;
    let кг = 99;
    for (const н of светлые) {
      for (const т of н.текст) {
        const к3 = контраст(т.цвет, т.фон);
        if (к3 < 4.5) console.log('   слабый светлый текст:', н.тема, т.т, к3.toFixed(2), JSON.stringify(т.цвет.map(Math.round)), JSON.stringify(т.фон.map(Math.round)));
        кт = Math.min(кт, к3);
      }
      for (const г of н.границы) кг = Math.min(кг, контраст(г.цвет, г.фон));
    }
    проверка('светлая тема «Калька»: текст ≥ 4,5:1 и границы ≥ 3:1', кт >= 4.5 && кг >= 3, `текст ${кт.toFixed(2)}, границы ${кг.toFixed(2)}`);
    await S(() => window.__верстакStore.getState().установитьТему('мастерская'));

    проверка('в консоли нет Shader Error и ошибок', к.шейдер.length === 0 && к.ошибки.length === 0, (к.шейдер[0] ?? к.ошибки[0] ?? '').slice(0, 200));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
  fs.writeFileSync(path.join(корень, 'проверка', 'проверка-1Б2.json'), JSON.stringify(итоги, null, 2), 'utf8');
  const упало = итоги.filter((x) => !x.ок);
  console.log(`\nИтого: ${итоги.length - упало.length} из ${итоги.length}`);
  process.exitCode = упало.length ? 2 : 0;
})().catch((e) => {
  console.error('ПРОВЕРКА УПАЛА:', e.stack || e.message);
  process.exit(1);
});
