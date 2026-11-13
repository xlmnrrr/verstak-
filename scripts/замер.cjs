/**
 * Замер скорости сцены: fps, время кадра, draw calls, треугольники, память.
 *
 * Где мерить:
 *   НАСТОЯЩИЙ замер — в окне Electron на реальной видеокарте:
 *     1) npm run dev                                   (Vite на 127.0.0.1:5273; если занят — npx vite --port 5274)
 *     2) $env:КУХНЯ_DEV_URL='http://127.0.0.1:5273/'; npx electron . --remote-debugging-port=9222
 *     3) node scripts/замер.cjs electron
 *   ОТНОСИТЕЛЬНЫЙ замер (только «до/после») — headless Chrome с программным рендером:
 *     node scripts/замер.cjs headless
 *
 * Как устроено: скрипт подгружает модули приложения через Vite (`/src/store/index.ts`),
 * собирает проект из N корпусных модулей сеткой, загружает его и несколько секунд рисует сцену каждый кадр
 * (requestAnimationFrame → renderer.render), медленно облетая камерой.
 *
 * ЗАМЕР_ТЕНИ=каждый-кадр (по умолчанию, основной зачёт): перед каждым gl.render ставится gl.shadowMap.needsUpdate = true,
 *   иначе приёмку можно пройти, ни разу не пересчитав тени (shadowMap.autoUpdate = false).
 * ЗАМЕР_ТЕНИ=по-изменению — тени считаются только по событиям (для сведения).
 * Дополнительно: сценарий «перетаскивание» (300 кадров, один модуль двигается командой изменитьОбъект, как мышью),
 * сборка сцены в мс, draw calls по проходам, профиль, MSAA, карта теней, кадры в простое.
 * Скрипт падает (код 3), если в консоли окна есть Shader Error.
 * Результат — в консоль и в проверка/замер-<режим>-<состав>-<тени>-<дата>.json.
 */
const path = require('node:path');
const fs = require('node:fs');

const PUPPETEER = 'C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const АДРЕС = process.env.КУХНЯ_URL || 'http://127.0.0.1:5273/';
const РЕЖИМ = process.argv[2] || 'electron';
const НАБОРЫ = (process.env.ЗАМЕР_N || '50,100,200,500').split(',').map(Number);
const СЕКУНД = Number(process.env.ЗАМЕР_СЕК || 6);
/** Замедление процессора (эмуляция слабого ноутбука): ЗАМЕР_CPU=3 — в 3 раза медленнее */
const CPU = Number(process.env.ЗАМЕР_CPU || 1);
/** ЗАМЕР_СОСТАВ=пустые (как в замере этапа 0) или «интерфейс» (полки и ящики по умолчанию) */
const СОСТАВ = process.env.ЗАМЕР_СОСТАВ || 'пустые';
/** каждый-кадр | по-изменению */
const ТЕНИ = process.env.ЗАМЕР_ТЕНИ || 'каждый-кадр';
/** Проход 1: профиль качества замера — VERSTAK_QUALITY=fast | standard | photo (по умолчанию «авто» проекта) */
const КАЧЕСТВО = { fast: 'слабый ноутбук', standard: 'высокое', photo: 'фото' }[process.env.VERSTAK_QUALITY || ''] || null;
const ПЕРЕТАСКИВАНИЕ = process.env.ЗАМЕР_ПЕРЕТАСКИВАНИЕ !== '0';

const puppeteer = require(PUPPETEER);
const пауза = (мс) => new Promise((r) => setTimeout(r, мс));

async function страницаПриложения(браузер) {
  for (let i = 0; i < 40; i++) {
    const стр = (await браузер.pages()).find((p) => p.url().startsWith(АДРЕС));
    if (стр) return стр;
    await пауза(250);
  }
  throw new Error(`не нашёл окно приложения с адресом ${АДРЕС}`);
}

/** Выполняется в странице: собрать проект из N модулей и загрузить (через v1 и миграцию — как в замерах этапов 0 и 1А-1) */
async function загрузитьN(стр, N) {
  return стр.evaluate(async (N, состав, качество) => {
    const useКухня = window.__верстакStore ?? (await import('/src/store/index.ts')).useКухня;
    const { КАТАЛОГ } = await import('/src/data/modules.ts');
    const { новый_проект, пустая_комната } = await import('/src/types.ts');
    const корпуса = КАТАЛОГ.filter((m) => m.вид === 'корпус' || m.вид === 'навесной');
    const сторона = Math.ceil(Math.sqrt(N));
    const шаг = 1300;
    const длина = Math.max(3600, сторона * шаг + 600);
    const п = новый_проект(`замер ${N}`, пустая_комната(длина, длина, 2700));
    for (let i = 0; i < N; i++) {
      const м = корпуса[i % корпуса.length];
      const ш = Math.min(м.габариты.ш, 1200);
      const г = Math.min(м.габариты.г, 650);
      const x = (i % сторона) * шаг - (сторона * шаг) / 2 + шаг / 2;
      const z = Math.floor(i / сторона) * шаг - (сторона * шаг) / 2 + шаг / 2;
      п.объекты.push({
        id: `bench-${i}`,
        модуль: м.id,
        позиция: [Math.round(x), 0, Math.round(z)],
        поворот: (i * 90) % 360,
        габариты: { ш, г, в: м.габариты.в },
        подъём: м.крепление === 'навесное' ? (м.подъём_по_умолчанию ?? 1400) : undefined,
        фасад: м.фасад,
        цоколь: м.цоколь,
        // «пустые» — как в замере этапа 0 (полок и ящиков нет); иначе — как ставит интерфейс (полки и ящики по умолчанию)
        ...(состав === 'пустые' ? { полок: 0, ящиков: 0 } : {}),
      });
    }
    useКухня.getState().загрузитьV1(п);
    if (качество) {
      // профиль качества из настроек проекта: ядро применяет его при синхронизации
      const с = useКухня.getState();
      с.загрузить({ ...с.проект2, настройки: { ...с.проект2.настройки, качество } });
    }
    return { модулей: N, длинаКомнаты: длина, типов: корпуса.length, состав, качество: качество ?? 'авто' };
  }, N, СОСТАВ, КАЧЕСТВО);
}

/** Выполняется в странице: N секунд рисовать каждый кадр и считать */
async function мерить(стр, секунд, тени) {
  return стр.evaluate(async (секунд, тени) => {
    const к = window.__кухня;
    if (!к) throw new Error('нет window.__кухня — сцена не открыта');
    await к.самопроверкаГотова;
    const { gl, scene, camera } = к;
    const я = к.ядро;
    const ext = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    const видеокарта = ext ? gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'неизвестно';
    let объектов = 0;
    let мешей = 0;
    scene.traverse((o) => {
      объектов++;
      if (o.isMesh) мешей++;
    });

    // draw calls по проходам: кадр с пересчётом теней и без него
    gl.shadowMap.needsUpdate = true;
    gl.render(scene, camera);
    const сТенью = gl.info.render.calls;
    gl.render(scene, camera);
    const безТени = gl.info.render.calls;

    // кадры в простое: 2 секунды без просьб — число кадров ядра не должно расти
    const кадровДо = я.кадров;
    await new Promise((r) => setTimeout(r, 2000));
    const кадровВПростое = я.кадров - кадровДо;

    const кадры = [];
    const времяРендера = [];
    let calls = 0;
    let triangles = 0;
    const старт = performance.now();
    const центр = camera.position.clone();
    const пересчётовДо = я.тени.пересчётов;
    await new Promise((готово) => {
      let прошлый = performance.now();
      const кадр = (t) => {
        const угол = ((t - старт) / 1000) * 0.4;
        camera.position.set(центр.x + Math.sin(угол) * 2, центр.y, центр.z + Math.cos(угол) * 2 - 2);
        camera.lookAt(0, 0.8, 0);
        я.проверитьФаску(t);
        if (тени === 'каждый-кадр') gl.shadowMap.needsUpdate = true;
        const t0 = performance.now();
        // «Фото»: кадр через постобработку ядра (GTAO, bloom, OutputPass)
        if (!(я.профиль?.фото && я.отрисоватьФото())) gl.render(scene, camera);
        времяРендера.push(performance.now() - t0);
        calls = gl.info.render.calls;
        triangles = gl.info.render.triangles;
        кадры.push(t - прошлый);
        прошлый = t;
        if (t - старт < секунд * 1000) requestAnimationFrame(кадр);
        else готово();
      };
      requestAnimationFrame(кадр);
    });
    кадры.shift();
    const сорт = [...кадры].sort((a, b) => a - b);
    const ср = кадры.reduce((a, b) => a + b, 0) / кадры.length;
    const худшие = сорт.slice(Math.floor(сорт.length * 0.99));
    const ср1 = худшие.reduce((a, b) => a + b, 0) / (худшие.length || 1);
    const срРендер = времяРендера.reduce((a, b) => a + b, 0) / времяРендера.length;
    const ст = к.статистика();
    return {
      видеокарта,
      профиль: ст.профиль,
      msaa: ст.msaa,
      карта_теней: ст.карта_теней,
      кадров: кадры.length,
      fps: +(1000 / ср).toFixed(1),
      fps_1проц_худших: +(1000 / ср1).toFixed(1),
      кадр_мс: +ср.toFixed(2),
      cpu_render_мс: +срРендер.toFixed(2),
      draw_calls: calls,
      draw_calls_с_тенью: сТенью,
      draw_calls_без_тени: безТени,
      draw_calls_проход_тени: сТенью - безТени,
      треугольников: triangles,
      сборка_сцены_мс: ст.сборка_мс,
      объектов_сцены: объектов,
      мешей,
      групп: Object.keys(ст.группы).length,
      фасок_вблизи: ст.группы['плита-фаска']?.занято ?? 0,
      геометрий: gl.info.memory.geometries,
      текстур: gl.info.memory.textures,
      js_память_мб: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      тени: gl.shadowMap.enabled,
      режим_теней: тени,
      пересчётов_теней_за_замер: я.тени.пересчётов - пересчётовДо,
      кадров_в_простое_2с: кадровВПростое,
      dpr: gl.getPixelRatio(),
      холст: `${gl.domElement.width}×${gl.domElement.height}`,
    };
  }, секунд, тени);
}

/** Сценарий «перетаскивание»: 300 кадров подряд один модуль двигается командой изменитьОбъект, как мышью */
async function перетаскивание(стр) {
  return стр.evaluate(async () => {
    const к = window.__кухня;
    const useКухня = window.__верстакStore ?? (await import('/src/store/index.ts')).useКухня;
    const { изменитьОбъект } = await import('/src/store/команды.ts');
    const { gl, scene, camera } = к;
    const с = useКухня.getState();
    const id = с.проект2.объекты[Math.floor(с.проект2.объекты.length / 2)].id;
    const старт = с.проект2.объекты.find((o) => o.id === id).позиция;
    с.начатьИзменение();
    const кадры = [];
    const времяШага = [];
    await new Promise((готово) => {
      let n = 0;
      let прошлый = performance.now();
      const кадр = (t) => {
        const t0 = performance.now();
        const dx = Math.round(Math.sin(n / 20) * 300);
        const dz = Math.round(Math.cos(n / 20) * 300);
        useКухня.getState().выполнить(изменитьОбъект(id, (э) => ({ ...э, позиция: [старт[0] + dx, э.позиция[1], старт[2] + dz] }), 'Переместить'));
        gl.shadowMap.needsUpdate = true;
        gl.render(scene, camera);
        времяШага.push(performance.now() - t0);
        кадры.push(t - прошлый);
        прошлый = t;
        if (++n < 301) requestAnimationFrame(кадр);
        else готово();
      };
      requestAnimationFrame(кадр);
    });
    useКухня.getState().завершитьИзменение();
    кадры.shift();
    const ср = кадры.reduce((a, b) => a + b, 0) / кадры.length;
    const срШаг = времяШага.reduce((a, b) => a + b, 0) / времяШага.length;
    return { кадров: кадры.length, fps: +(1000 / ср).toFixed(1), кадр_мс: +ср.toFixed(2), шаг_cpu_мс: +срШаг.toFixed(2), записей_истории: useКухня.getState().прошлое.length };
  });
}

(async () => {
  let браузер;
  if (РЕЖИМ === 'electron') {
    браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + (process.env.ЗАМЕР_ПОРТ || 9222), defaultViewport: null });
  } else {
    браузер = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--window-size=1920,1080'],
      defaultViewport: { width: 1920, height: 1080 },
    });
    const p = await браузер.newPage();
    await p.goto(АДРЕС, { waitUntil: 'networkidle2', timeout: 60000 });
  }
  const стр = await страницаПриложения(браузер);
  const ошибкиШейдера = [];
  стр.on('console', (м) => {
    const т = м.text();
    if (/Shader Error|THREE\.WebGLProgram|THREE\.WebGLShader/.test(т)) ошибкиШейдера.push(т.slice(0, 500));
  });
  if (РЕЖИМ === 'electron') {
    // кадр под приёмку: 1920×1080 при масштабе 1 (Electron не даёт менять окно через CDP — эмулируем размер вида)
    const cdp = await стр.createCDPSession();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await пауза(800);
  }
  const окно = await стр.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const итоги = [];
  for (const N of НАБОРЫ) {
    const п = await загрузитьN(стр, N);
    await пауза(2500);
    const р = await мерить(стр, СЕКУНД, ТЕНИ);
    if (ПЕРЕТАСКИВАНИЕ && N === 200) р.перетаскивание = await перетаскивание(стр);
    итоги.push({ ...п, ...р });
    console.log(
      `${String(N).padStart(4)} модулей: ${р.fps} fps (1% худших ${р.fps_1проц_худших}), кадр ${р.кадр_мс} мс, ` +
        `render CPU ${р.cpu_render_мс} мс, draw calls ${р.draw_calls} (проход тени ${р.draw_calls_проход_тени}), треугольников ${р.треугольников}, ` +
        `сборка ${р.сборка_сцены_мс} мс, профиль ${р.профиль}, простой ${р.кадров_в_простое_2с} кадров` +
        (р.перетаскивание ? ` | перетаскивание: ${р.перетаскивание.fps} fps, шаг ${р.перетаскивание.шаг_cpu_мс} мс` : ''),
    );
  }
  const отчёт = {
    режим: РЕЖИМ,
    состав: СОСТАВ,
    замедление_cpu: CPU,
    режим_теней: ТЕНИ,
    ошибок_шейдера: ошибкиШейдера.length,
    где: РЕЖИМ === 'electron' ? 'окно Electron, реальная видеокарта' : 'headless Chrome, программный рендер (только до/после)',
    окно,
    дата: new Date().toISOString(),
    итоги,
  };
  const куда = path.join(process.cwd(), 'проверка');
  fs.mkdirSync(куда, { recursive: true });
  const файл = path.join(куда, `замер-${РЕЖИМ}-${СОСТАВ}-${ТЕНИ}${CPU > 1 ? `-cpu${CPU}` : ''}-${отчёт.дата.slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(файл, JSON.stringify(отчёт, null, 2), 'utf8');
  console.log('видеокарта:', итоги[0]?.видеокарта, '| окно', окно, '| файл:', файл);
  if (РЕЖИМ === 'electron') браузер.disconnect();
  else await браузер.close();
  if (ошибкиШейдера.length) {
    console.error('ОШИБКА ШЕЙДЕРА В КОНСОЛИ ОКНА:', ошибкиШейдера[0]);
    process.exit(3);
  }
})().catch((e) => {
  console.error('ЗАМЕР УПАЛ:', e.message);
  process.exit(1);
});
