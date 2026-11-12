/**
 * Мини-превью изделий: один раз снимаются из 3D (изометрия, свой светлый фон) и кладутся файлами
 * public/Библиотека/превью/<id>.webp. Переснимается только то, у чего изменилась геометрия (хэш рисуемых примитивов
 * в превью/_манифест.json) или версия съёмки. Запуск в окне Electron на живой сцене приложения:
 *   1) npx vite --port 5274 --strictPort
 *   2) node scripts/превью-изделий.cjs http://127.0.0.1:5274/            (только новое и изменённое)
 *      node scripts/превью-изделий.cjs http://127.0.0.1:5274/ --всё      (переснять всё)
 *      node scripts/превью-изделий.cjs http://127.0.0.1:5274/ --id холодильник-600,шкаф-купе-1800
 */
const path = require('node:path');
const fs = require('node:fs');
const { запуститьElectron, подключиться, слушатьКонсоль, пауза } = require('./электрон-общее.cjs');

const АДРЕС = process.argv.find((а) => a_url(а)) || 'http://127.0.0.1:5274/';
function a_url(а) {
  return /^https?:\/\//.test(а);
}
const ВСЁ = process.argv.includes('--всё');
const индексId = process.argv.indexOf('--id');
const ТОЛЬКО = индексId > 0 ? process.argv[индексId + 1].split(',') : null;
/** Меняется при изменении ракурса, фона, размера или качества: тогда переснимается всё */
const ВЕРСИЯ_СЪЁМКИ = 1;
const РАЗМЕР = 192;
const ФОН = '#d6d0c4';

const корень = process.cwd();
const папка = path.join(корень, 'public', 'Библиотека', 'превью');
const манифестПуть = path.join(папка, '_манифест.json');
const данные = path.join(корень, 'проверка', 'данные-превью');
fs.mkdirSync(папка, { recursive: true });

(async () => {
  fs.rmSync(данные, { recursive: true, force: true });
  fs.mkdirSync(path.join(данные, 'Проекты'), { recursive: true });
  const процесс = запуститьElectron({ адрес: АДРЕС, данные, порт: 9361, доп: { VERSTAK_AUTOSAVE_SEC: '3600' } });
  const t0 = Date.now();
  let манифест = { версия: ВЕРСИЯ_СЪЁМКИ, хэши: {} };
  try {
    const м = JSON.parse(fs.readFileSync(манифестПуть, 'utf8'));
    if (м.версия === ВЕРСИЯ_СЪЁМКИ) манифест = м;
  } catch {
    /* первого манифеста ещё нет */
  }
  try {
    const { браузер, стр } = await подключиться(АДРЕС, 9361);
    const к = слушатьКонсоль(стр);
    const S = (fn, ...а) => стр.evaluate(fn, ...а);
    await пауза(2500);
    await S(() => localStorage.setItem('верстак:интерфейс', JSON.stringify({ туркПройден: true })));
    await стр.reload();
    await пауза(2000);
    // пустая большая комната: стены прячем, пол и фон одного цвета, сетка выключена
    await S(
      (фон) => {
        const с = window.__верстакStore.getState();
        с.создать('превью', { длина: 12000, ширина: 12000, высота_стен: 2700, толщина_стен: 100, форма: 'прямоугольник', обои: фон, пол: фон, фон });
        if (с.сеткаВидна) с.переключитьСетку();
      },
      ФОН,
    );
    await пауза(2500);
    await S(() => {
      const я = window.__кухня.ядро;
      const ст = я.сборщик.группы.get('стена');
      if (ст) ст.mesh.visible = false;
    });

    // список изделий и хэши геометрии
    const список = await S(async () => {
      const { КАТАЛОГ_V2 } = await import('/src/model/каталог/index.ts');
      const { новыйЭкземпляр } = await import('/src/model/проект.ts');
      const { примитивыЭкземпляра } = await import('/src/render/примитивы.ts');
      const fnv = (с) => {
        let h = 2166136261;
        for (let i = 0; i < с.length; i++) {
          h ^= с.charCodeAt(i);
          h = Math.imul(h, 16777619) >>> 0;
        }
        return h.toString(16);
      };
      return КАТАЛОГ_V2.map((и) => {
        const э = новыйЭкземпляр(и, 'п1');
        const р = примитивыЭкземпляра(и, э);
        const ключ = JSON.stringify([
          р.примитивы.map((п) => [п.форма, п.размер.map((v) => +v.toFixed(1)), п.t.map((v) => +v.toFixed(1)), п.R.map((v) => +v.toFixed(3)), typeof п.мат === 'string' ? п.мат : п.мат.цвет, п.биты, п.r]),
          и.материалы,
          и.габариты,
        ]);
        return { id: и.id, название: и.название, тип: и.тип, подъём: и.подъём ?? 0, габ: и.габариты, хэш: fnv(ключ) };
      });
    });

    const нужные = список.filter((и) => (ТОЛЬКО ? ТОЛЬКО.includes(и.id) : ВСЁ || манифест.хэши[и.id] !== и.хэш || !fs.existsSync(path.join(папка, `${и.id}.webp`))));
    console.log(`изделий в каталоге: ${список.length}, снимать: ${нужные.length}${ВСЁ ? ' (--всё)' : ''}`);

    let снято = 0;
    const размерыФайлов = [];
    for (const и of нужные) {
      const данныеКартинки = await S(
        (изд, размер, фон) => {
          const с = window.__верстакStore.getState();
          const я = window.__кухня.ядро;
          const { gl, scene, camera } = window.__кухня;
          const y = изд.тип === 'свет' ? изд.подъём || 1800 : 0;
          const id = с.добавитьМодуль(изд.id, [0, y, 0]);
          if (!id) return null;
          window.__верстакStore.getState().выбрать([]);
          // центр и радиус габарита (метры)
          const cx = 0;
          const cy = (y + изд.габ.в / 2) / 1000;
          const cz = 0;
          const R = Math.hypot(изд.габ.ш, изд.габ.г, изд.габ.в) / 2000;
          camera.fov = 16;
          camera.aspect = gl.domElement.clientWidth / gl.domElement.clientHeight;
          const d = (R / Math.sin(((camera.fov / 2) * Math.PI) / 180)) * 1.05;
          const φ = (40 * Math.PI) / 180;
          const θ = (27 * Math.PI) / 180;
          camera.position.set(cx + d * Math.sin(φ) * Math.cos(θ), cy + d * Math.sin(θ), cz + d * Math.cos(φ) * Math.cos(θ));
          camera.lookAt(cx, cy, cz);
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          scene.fog = null;
          const углы = [];
          for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) углы.push(я.экраннаяТочка((sx * изд.габ.ш) / 2000, (y + sy * изд.габ.в) / 1000, (sz * изд.габ.г) / 2000));
          const r = gl.domElement.getBoundingClientRect();
          const масштаб = gl.domElement.width / r.width;
          const xs = углы.map((p) => (p.x - r.left) * масштаб);
          const ys = углы.map((p) => (p.y - r.top) * масштаб);
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          const сторона = Math.max(x1 - x0, y1 - y0) * 1.14;
          const sxц = (x0 + x1) / 2 - сторона / 2;
          const syц = (y0 + y1) / 2 - сторона / 2;
          я.тени.запросить();
          gl.shadowMap.needsUpdate = true;
          gl.render(scene, camera);
          const холст = document.createElement('canvas');
          холст.width = размер;
          холст.height = размер;
          const ctx = холст.getContext('2d');
          ctx.fillStyle = фон;
          ctx.fillRect(0, 0, размер, размер);
          ctx.drawImage(gl.domElement, sxц, syц, сторона, сторона, 0, 0, размер, размер);
          const url = холст.toDataURL('image/webp', 0.82);
          // убрать изделие
          const с2 = window.__верстакStore.getState();
          с2.выбрать([id]);
          с2.удалитьВыбранное();
          return { url, в_кадре: x0 >= 0 && y0 >= 0 && x1 <= gl.domElement.width && y1 <= gl.domElement.height, сторона: Math.round(сторона) };
        },
        и,
        РАЗМЕР,
        ФОН,
      );
      if (!данныеКартинки) {
        console.log('НЕ СНЯТО', и.id);
        continue;
      }
      const буфер = Buffer.from(данныеКартинки.url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(папка, `${и.id}.webp`), буфер);
      размерыФайлов.push(буфер.length);
      манифест.хэши[и.id] = и.хэш;
      снято++;
      if (!данныеКартинки.в_кадре) console.log('  вне кадра (обрезано):', и.id);
    }
    // убрать файлы изделий, которых больше нет
    const ид = new Set(список.map((и) => и.id));
    for (const ф of fs.readdirSync(папка)) {
      if (ф.endsWith('.webp') && !ид.has(ф.slice(0, -5))) {
        fs.unlinkSync(path.join(папка, ф));
        delete манифест.хэши[ф.slice(0, -5)];
      }
    }
    for (const id of Object.keys(манифест.хэши)) if (!ид.has(id)) delete манифест.хэши[id];
    fs.writeFileSync(манифестПуть, JSON.stringify(манифест, null, 1) + '\n', 'utf8');
    const всего = fs.readdirSync(папка).filter((ф) => ф.endsWith('.webp')).reduce((s, ф) => s + fs.statSync(path.join(папка, ф)).size, 0);
    const ошибок = к.ошибки.filter((e) => !/favicon|ResizeObserver/.test(e));
    console.log(`снято ${снято} за ${((Date.now() - t0) / 1000).toFixed(0)} с; файлов ${fs.readdirSync(папка).filter((ф) => ф.endsWith('.webp')).length}, всего ${(всего / 1024).toFixed(0)} КБ, средний файл ${размерыФайлов.length ? (размерыФайлов.reduce((a, b) => a + b, 0) / размерыФайлов.length / 1024).toFixed(1) : 0} КБ; ошибок консоли ${ошибок.length}, шейдера ${к.шейдер.length}`);
    if (ошибок.length) console.log(ошибок.slice(0, 3).join('\n'));
    await браузер.disconnect();
    process.exitCode = ошибок.length || к.шейдер.length ? 2 : 0;
  } catch (е) {
    console.log('СБОЙ', е && е.stack ? е.stack : е);
    process.exitCode = 3;
  } finally {
    процесс.kill();
  }
})();
