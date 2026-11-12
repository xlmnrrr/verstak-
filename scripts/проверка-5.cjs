/**
 * Проверка этапа 5: материалы с текстурами (мрамор вблизи и издалека), покраска всего, свет по времени суток, «Показать клиенту».
 * Запуск: node scripts/проверка-5.cjs http://127.0.0.1:5274/ ; скриншоты — проверка\v2\5-*.png
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');
const АДРЕС = process.argv[2] || 'http://127.0.0.1:5274/';
const корень = process.cwd();
const данные = path.join(корень, 'проверка', 'данные-5');
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
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  try {
    const { браузер, стр } = await подключиться(АДРЕС);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2000);
    await S(() => [...document.querySelectorAll('.действие')].find((x) => x.textContent.includes('Пример кухни'))?.click());
    await пауза(3500);
    // материалы: мрамор на столешницу, тёмный дуб на фасады, латунь на ручки, нержавейка на технику
    await S(() => {
      const с = window.__верстакStore.getState();
      с.задатьМатериал('столешница', 'мрамор-калакатта', true);
      с.задатьМатериал('фасад', 'дуб-натуральный', true);
      с.задатьМатериал('ручки', 'латунь', true);
      с.задатьМатериал('техника', 'нержавейка', true);
      с.задатьМатериал('цоколь', 'металл-чёрный-мат', true);
    });
    await пауза(1500);
    const тек = await S(() => ({ текстур: window.__кухня.gl.info.memory.textures }));
    проверка('массив текстур загружен в видеокарту', тек.текстур >= 1, `текстур в памяти: ${тек.текстур}`);
    const цель = await S(() => {
      const о = window.__верстакStore.getState().проект2.объекты.find((x) => x.изделие.startsWith('столешница'));
      return о ? [о.позиция[0] / 1000, (о.позиция[1] + о.габариты.в) / 1000, о.позиция[2] / 1000] : [0, 0.9, -1.1];
    });
    const камера = (d, высота) =>
      S(
        (ц, d2, в) => {
          const px = ц[0], py = ц[1] + в, pz = ц[2] + d2;
          const dx = ц[0] - px, dy = ц[1] - py, dz = ц[2] - pz;
          window.__кухня.поставитьКамеру(px, py, pz, Math.atan2(-dx, -dz), Math.asin(dy / Math.hypot(dx, dy, dz)));
        },
        цель,
        d,
        высота,
      );
    await S(() => window.__верстакStore.getState().выбрать([]));
    await камера(0.9, 0.6);
    await пауза(800);
    await стр.screenshot({ path: path.join(снимки, '5-мрамор-вблизи.png') });
    await камера(4.2, 2.2);
    await пауза(800);
    await стр.screenshot({ path: path.join(снимки, '5-мрамор-издалека.png') });
    // обои, пол, фон, акцент
    await S(() => {
      const с = window.__верстакStore.getState();
      с.обновитьКомнату({ обои: '#7fa3b8', пол: '#c9bda9', фон: '#d9d5cc' });
      localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true, акцент: 'бирюза' }));
    });
    await пауза(600);
    const цвета = await S(() => {
      const п = window.__верстакStore.getState().проект2;
      return { стены: п.помещения[0].отделка.стены, пол: п.помещения[0].отделка.пол, фон: п.настройки.фон };
    });
    проверка('обои, пол и фон сцены красятся', цвета.стены === '#7fa3b8' && цвета.пол === '#c9bda9' && цвета.фон === '#d9d5cc', JSON.stringify(цвета));
    await S(() => window.__кухня.поставитьКамеру(0, 4.2, 4.6, 0, -0.62));
    await пауза(800);
    await стр.screenshot({ path: path.join(снимки, '5-покраска-всего.png') });
    // свет по времени суток
    for (const [ч, имя] of [[8, 'утро'], [14, 'день'], [20, 'вечер']]) {
      await S((х) => Promise.resolve(window.__верстакUI.getState().установитьЧас(х)), ч);
      await пауза(1200);
      await стр.screenshot({ path: path.join(снимки, `5-свет-${имя}.png`) });
    }
    const лампы = await S(() => window.__кухня.scene.children.filter((o) => o.isPointLight && o.visible).length);
    проверка('вечером включаются светильники (точечные лампы)', лампы >= 1, `ламп: ${лампы}`);
    await S(() => Promise.resolve(window.__верстакUI.getState().установитьЧас(null)));
    // «Показать клиенту»
    await S(() => Promise.resolve(window.__верстакUI.setState({ показатьКлиенту: true })));
    await пауза(2500);
    const клиент = await S(() => ({ панель: !!document.querySelector('.панель-клиента'), полоса: getComputedStyle(document.querySelector('.полоса')).display }));
    await стр.screenshot({ path: path.join(снимки, '5-показать-клиенту.png') });
    await стр.keyboard.press('Escape');
    await пауза(500);
    const вышел = await S(() => Promise.resolve(!window.__верстакUI.getState().показатьКлиенту));
    проверка('«Показать клиенту»: панель, скрытый интерфейс, выход по Esc', клиент.панель && клиент.полоса === 'none' && вышел);
    проверка('в консоли нет Shader Error и ошибок', к.шейдер.length === 0 && к.ошибки.length === 0, (к.шейдер[0] ?? к.ошибки[0] ?? '').slice(0, 300));
    браузер.disconnect();
  } finally {
    процесс.kill();
  }
  const упало = итоги.filter((x) => !x.ок);
  console.log(`Итого: ${итоги.length - упало.length} из ${итоги.length}`);
  process.exitCode = упало.length ? 2 : 0;
})().catch((e) => {
  console.error('УПАЛО:', e.stack || e.message);
  process.exit(1);
});
