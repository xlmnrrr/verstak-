/**
 * Замер скорости сцены: fps, время кадра, draw calls, треугольники, память.
 *
 * Где мерить:
 *   НАСТОЯЩИЙ замер — в окне Electron на реальной видеокарте:
 *     1) npm run dev                                   (Vite на 127.0.0.1:5273)
 *     2) $env:КУХНЯ_DEV_URL='http://127.0.0.1:5273/'; npx electron . --remote-debugging-port=9222
 *     3) node scripts/замер.cjs electron
 *   ОТНОСИТЕЛЬНЫЙ замер (только «до/после») — headless Chrome с программным рендером:
 *     node scripts/замер.cjs headless
 *
 * Как устроено: скрипт подгружает модули приложения через Vite (`/src/store/index.ts`),
 * собирает проект из N корпусных модулей сеткой, загружает его и 6 секунд
 * рисует сцену каждый кадр (requestAnimationFrame → renderer.render), медленно облетая камерой.
 * Тени пересчитываются каждый кадр, как при перетаскивании объекта в v1.
 * Результат — в консоль и в проверка/замер-<режим>-<дата>.json.
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
/** ЗАМЕР_СОСТАВ=пустые (по умолчанию, как в замере этапа 0) или «интерфейс» (полки и ящики по умолчанию) */
const СОСТАВ = process.env.ЗАМЕР_СОСТАВ || 'пустые';

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

/** Выполняется в странице: собрать проект из N модулей и загрузить */
async function загрузитьN(стр, N) {
  return стр.evaluate(async (N, состав) => {
    const { useКухня } = await import('/src/store/index.ts');
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
    return { модулей: N, длинаКомнаты: длина, типов: корпуса.length, состав };
  }, N, СОСТАВ);
}

/** Выполняется в странице: N секунд рисовать каждый кадр и считать */
async function мерить(стр, секунд) {
  return стр.evaluate(async (секунд) => {
    const к = window.__кухня;
    if (!к) throw new Error('нет window.__кухня — сцена не открыта');
    const { gl, scene, camera } = к;
    const ext = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    const видеокарта = ext ? gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'неизвестно';
    let объектов = 0;
    let мешей = 0;
    scene.traverse((o) => {
      объектов++;
      if (o.isMesh) мешей++;
    });
    const кадры = [];
    const времяРендера = [];
    let calls = 0;
    let triangles = 0;
    const старт = performance.now();
    const центр = camera.position.clone();
    await new Promise((готово) => {
      let прошлый = performance.now();
      const кадр = (t) => {
        const угол = ((t - старт) / 1000) * 0.4;
        camera.position.set(центр.x + Math.sin(угол) * 2, центр.y, центр.z + Math.cos(угол) * 2 - 2);
        camera.lookAt(0, 0.8, 0);
        const t0 = performance.now();
        gl.render(scene, camera);
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
    return {
      видеокарта,
      кадров: кадры.length,
      fps: +(1000 / ср).toFixed(1),
      fps_1проц_худших: +(1000 / ср1).toFixed(1),
      кадр_мс: +ср.toFixed(2),
      cpu_render_мс: +срРендер.toFixed(2),
      draw_calls: calls,
      треугольников: triangles,
      объектов_сцены: объектов,
      мешей,
      геометрий: gl.info.memory.geometries,
      текстур: gl.info.memory.textures,
      js_память_мб: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      тени: gl.shadowMap.enabled,
      dpr: gl.getPixelRatio(),
      холст: `${gl.domElement.width}×${gl.domElement.height}`,
    };
  }, секунд);
}

(async () => {
  let браузер;
  if (РЕЖИМ === 'electron') {
    браузер = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
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
    const р = await мерить(стр, СЕКУНД);
    итоги.push({ ...п, ...р });
    console.log(
      `${String(N).padStart(4)} модулей: ${р.fps} fps (1% худших ${р.fps_1проц_худших}), кадр ${р.кадр_мс} мс, ` +
        `render CPU ${р.cpu_render_мс} мс, draw calls ${р.draw_calls}, треугольников ${р.треугольников}, мешей ${р.мешей}`,
    );
  }
  const отчёт = { режим: РЕЖИМ, состав: СОСТАВ, замедление_cpu: CPU, где: РЕЖИМ === 'electron' ? 'окно Electron, реальная видеокарта' : 'headless Chrome, программный рендер (только до/после)', окно, дата: new Date().toISOString(), итоги };
  const куда = path.join(process.cwd(), 'проверка');
  fs.mkdirSync(куда, { recursive: true });
  const файл = path.join(куда, `замер-${РЕЖИМ}-${СОСТАВ}${CPU > 1 ? `-cpu${CPU}` : ''}-${отчёт.дата.slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(файл, JSON.stringify(отчёт, null, 2), 'utf8');
  console.log('видеокарта:', итоги[0]?.видеокарта, '| окно', окно, '| файл:', файл);
  if (РЕЖИМ === 'electron') браузер.disconnect();
  else await браузер.close();
})().catch((e) => {
  console.error('ЗАМЕР УПАЛ:', e.message);
  process.exit(1);
});
