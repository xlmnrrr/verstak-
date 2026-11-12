/**
 * Проверка захода «до этапа 3»: «Свободная сборка» (пункт 8), мини-превью (пункт 1), больше техники (пункт 5).
 * Запуск: node scripts/проверка-доп.cjs http://127.0.0.1:5274/ ; скриншоты — проверка\v2\доп-*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-доп');
const снимки = path.join(корень, 'проверка', 'v2');
fs.mkdirSync(снимки, { recursive: true });
const итоги = [];
const проверка = (имя, ок, п = '') => {
  итоги.push({ имя, ок: !!ок, п });
  console.log(`${ок ? 'ОК ' : 'НЕТ'}  ${имя}${п ? ' — ' + п : ''}`);
};

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9371, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  const t0 = Date.now();
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9371);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true, каталогОткрыт: false })));
    await стр.reload();
    await пауза(2000);
    await S(() => window.__верстакStore.getState().создать('Свободная сборка', { длина: 4500, ширина: 3500, высота_стен: 2700, толщина_стен: 100, форма: 'прямоугольник', обои: '#d8cdb8', пол: '#a58865', фон: '#171a1f' }));
    await пауза(1500);

    // --- пункт 8: два шкафа друг в друге
    const [а, б] = await S(() => {
      const с = window.__верстакStore.getState();
      const а = с.добавитьМодуль('тумба-ящики-600', [-300, 0, -900]);
      const б = window.__верстакStore.getState().добавитьМодуль('тумба-ящики-600', [-100, 0, -900]);
      window.__верстакStore.getState().выбрать([]);
      return [а, б];
    });
    await S(() => window.__кухня.поставитьКамеру(0, 2.6, 2.6, 0, -0.72));
    await пауза(700);
    const состояние = () =>
      S(() => {
        const я = window.__кухня.ядро;
        return {
          красныйКонтур: я.контурПроблем.линии.visible,
          метокВлезает: [...document.querySelectorAll('.метка-влезает')].filter((e) => !e.classList.contains('метка-открывание')).length,
          бейдж: !!document.querySelector('.плашка.свободная-сборка'),
          плашка: [...document.querySelectorAll('footer.низ .плашка')].map((e) => e.textContent.trim()).filter((т) => /влезает|Пересечен/.test(т)),
          проблем: window.__верстакStore.getState().проблем,
          вПроекте: window.__верстакStore.getState().проект2.настройки.свободная_сборка ?? null,
          кнопкаНажата: document.querySelector('button[aria-label="Свободная сборка"]')?.getAttribute('aria-pressed'),
        };
      });
    let с0 = await состояние();
    проверка('обычный режим: красный контур, метка «⚠ N мм» и плашка «Не влезает»', с0.красныйКонтур && с0.метокВлезает >= 1 && с0.плашка.some((т) => /Не влезает/.test(т)) && !с0.бейдж, JSON.stringify(с0));
    await стр.screenshot({ path: path.join(снимки, 'доп-свободная-выкл.png') });

    await стр.click('button[aria-label="Свободная сборка"]');
    await пауза(700);
    const с1 = await состояние();
    проверка('свободная сборка включена: красного контура и меток нет', !с1.красныйКонтур && с1.метокВлезает === 0, JSON.stringify(с1));
    проверка('кнопка подсвечена (aria-pressed) и в нижней строке бейдж «Свободная сборка»', с1.кнопкаНажата === 'true' && с1.бейдж);
    проверка('плашка проверок нейтральная: «Пересечений: N», данные не потеряны', с1.плашка.some((т) => /Пересечений: \d/.test(т)) && с1.проблем >= 1, JSON.stringify(с1.плашка));
    проверка('режим записан в проект (рядом с сеткой)', с1.вПроекте === true);
    await стр.screenshot({ path: path.join(снимки, 'доп-свободная-вкл.png') });

    // предметы спокойно ставятся друг в друга: ещё один в ту же точку, красного нет
    await S(() => window.__верстакStore.getState().добавитьМодуль('тумба-ящики-600', [-200, 0, -900]));
    await пауза(600);
    const с2 = await состояние();
    проверка('третий шкаф в ту же точку: красных линий и предупреждений нет', !с2.красныйКонтур && с2.метокВлезает === 0 && с2.проблем >= 1);

    // окно «Проверки»: конфликты перечислены, есть пометка режима
    await S(() => window.__верстакUI.getState().открытьОкно('проверки'));
    await пауза(700);
    const окно = await S(() => ({ пометка: !!document.querySelector('.свободная-пометка'), позиций: document.querySelectorAll('.список-проверок li').length }));
    проверка('«Проверки»: конфликты перечислены списком, предупреждения скрыты, есть пометка режима', окно.пометка && окно.позиций >= 2, JSON.stringify(окно));
    await стр.screenshot({ path: path.join(снимки, 'доп-проверки-в-свободной.png') });
    await стр.keyboard.press('Escape');
    await пауза(300);
    await S(() => window.__верстакUI.getState().открытьОкно(null));
    await пауза(300);

    // сохранение и повторное открытие: режим остаётся в проекте
    await S(() => window.__верстакStore.getState().сохранить());
    await пауза(1500);
    await S(() => window.__верстакStore.getState().наЭкран('проекты'));
    await пауза(1500);
    await S(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Открыть')?.click());
    await пауза(2500);
    const после = await состояние();
    проверка('после сохранения и открытия режим на месте: кнопка, бейдж, проект', после.вПроекте === true && после.бейдж && после.кнопкаНажата === 'true', JSON.stringify(после));

    // выключить: красное возвращается
    await стр.click('button[aria-label="Свободная сборка"]');
    await пауза(700);
    const с3 = await состояние();
    проверка('выключили: красные контуры и «⚠ N мм» вернулись, бейдж убран', с3.красныйКонтур && с3.метокВлезает >= 1 && !с3.бейдж && с3.плашка.some((т) => /Не влезает/.test(т)), JSON.stringify(с3));
    void а; void б;

    // --- пункт 1 и 5: каталог с превью
    await S(() => window.__верстакStore.getState().переключитьКаталог(true));
    await пауза(1200);
    const кат = await S(async () => {
      const все = [...document.querySelectorAll('.выезд.слева .позиция img.превью-изделия')];
      const картинки = все.filter((и) => { const r = и.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      await Promise.all(картинки.map((и) => (и.complete ? 1 : new Promise((r) => { и.onload = r; и.onerror = r; setTimeout(r, 2000); }))));
      return { всего: все.length, видимых: картинки.length, загружено: картинки.filter((и) => и.complete && и.naturalWidth > 0).length };
    });
    проверка('в каталоге у позиций видны мини-превью (картинка загрузилась)', кат.всего > 80 && кат.видимых >= 5 && кат.загружено === кат.видимых, JSON.stringify(кат));
    await стр.screenshot({ path: path.join(снимки, 'доп-каталог-превью.png') });

    // подсказка при наведении
    const точка = await S(() => {
      const п = [...document.querySelectorAll('.выезд.слева .позиция')].find((e) => { const r = e.getBoundingClientRect(); return r.top > 300 && r.bottom < innerHeight - 20; });
      const r = п.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await стр.mouse.move(точка.x, точка.y);
    await пауза(500);
    const подск = await S(async () => {
      const т = document.querySelector('.подсказка-изделия');
      if (!т) return null;
      const и = т.querySelector('img');
      await new Promise((r) => (и && !и.complete ? ((и.onload = r), (и.onerror = r), setTimeout(r, 1500)) : r()));
      const r = т.getBoundingClientRect();
      return { имя: т.querySelector('b')?.textContent, картинка: !!(и && и.naturalWidth > 0), размер: Math.round(и?.getBoundingClientRect().width ?? 0), вЭкране: r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0 };
    });
    проверка('подсказка при наведении: крупное превью, название, габариты', !!подск && подск.картинка && подск.размер >= 160 && подск.вЭкране, JSON.stringify(подск));
    await стр.screenshot({ path: path.join(снимки, 'доп-каталог-подсказка.png') });
    await стр.mouse.move(900, 500);

    // поиск техники и новые позиции
    await S(() => window.__верстакStore.getState().установитьПоиск('холодильник'));
    await пауза(500);
    const хол = await S(() => [...document.querySelectorAll('.выезд.слева .позиция .имя')].map((e) => e.textContent));
    проверка('холодильников в каталоге: однодверный, двухдверный, side-by-side, встроенный и прежний', хол.length >= 5 && ['однодверный', 'двухдверный', 'side-by-side', 'встроенный'].every((с) => хол.some((н) => н.includes(с))), JSON.stringify(хол));
    await стр.screenshot({ path: path.join(снимки, 'доп-каталог-холодильники.png') });
    const ост = await S(() => {
      const с = window.__верстакStore.getState();
      const имена = (з) => { с.установитьПоиск(з); return [...document.querySelectorAll('.выезд.слева .позиция .имя')].length; };
      return { посудомойка: имена('посудомойка'), стиральная: имена('стиральная'), микроволновка: имена('микроволновка'), вытяжка: имена('вытяжка'), морозильн: имена('морозильн') };
    });
    await пауза(200);
    проверка('посудомоек ≥ 3, стиралок ≥ 2, микроволновок ≥ 2, вытяжек ≥ 5, морозильников ≥ 2', ост.посудомойка >= 3 && ост.стиральная >= 2 && ост.микроволновка >= 2 && ост.вытяжка >= 5 && ост.морозильн >= 2, JSON.stringify(ост));

    // превью в шапке свойств выбранного
    await S(() => {
      const с = window.__верстакStore.getState();
      с.установитьПоиск('');
      с.переключитьКаталог(false);
      const ид = с.добавитьМодуль('холодильник-side-by-side-900', [800, 0, -1200]);
      window.__верстакStore.getState().выбрать([ид]);
    });
    await пауза(900);
    const шапка = await S(async () => {
      const и = document.querySelector('.выезд.справа .выезд-шапка img.превью-изделия');
      if (!и) return null;
      await new Promise((r) => (и.complete ? r() : ((и.onload = r), (и.onerror = r), setTimeout(r, 1500))));
      return { картинка: и.naturalWidth > 0, название: document.querySelector('.выезд.справа .выезд-шапка b')?.textContent };
    });
    проверка('в шапке свойств рядом с названием — превью изделия', !!шапка && шапка.картинка, JSON.stringify(шапка));
    // открыть side-by-side кнопкой «O»: две двери
    await стр.keyboard.press('KeyO');
    await пауза(500);
    await S(() => window.__кухня.поставитьКамеру(0.8, 1.7, 0.9, 0, -0.3));
    await пауза(600);
    await стр.screenshot({ path: path.join(снимки, 'доп-side-by-side-открыт.png') });
    const двери = await S(() => {
      const э = window.__верстакStore.getState().проект2.объекты.find((x) => x.изделие === 'холодильник-side-by-side-900');
      return { открыт: !!э?.открыт };
    });
    проверка('новый холодильник side-by-side открывается клавишей O', двери.открыт);

    const ошибок = к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e));
    проверка('в консоли нет ошибок', ошибок.length === 0, ошибок.slice(0, 3).join(' | '));
    проверка('в консоли нет ошибок шейдера', к.шейдер.length === 0);
    await браузер.disconnect();
  } catch (е) {
    console.log('СБОЙ', е && е.stack ? е.stack : е);
    проверка('прогон не упал', false, String(е && е.message));
  } finally {
    процесс.kill();
  }
  const неудачи = итоги.filter((x) => !x.ок);
  console.log(`\nИтого: ${итоги.length - неудачи.length} из ${итоги.length}, время ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  fs.writeFileSync(path.join(снимки, 'доп-итоги.json'), JSON.stringify(итоги, null, 1));
  process.exitCode = неудачи.length ? 2 : 0;
})();
