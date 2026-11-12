/**
 * Текстуры материалов «Верстака»: процедурные, бесшовные, 512×512 WebP. RGB — цвет, альфа — шероховатость.
 * Сгенерированы скриптом (CC0: авторские, без внешних источников), лежат в public/Библиотека/текстуры и вшиваются в приложение.
 * Запуск: node scripts/сделать-текстуры.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('C:\\Users\\makar\\.dsh\\profiles\\desktop\\node_modules\\puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const браузер = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const стр = await браузер.newPage();
  const результат = await стр.evaluate(() => {
    const N = 512;
    const хэш = (x, y, s) => {
      let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
      h = (h ^ (h >>> 13)) * 1274126177;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    // бесшовный шум значений с периодом p клеток
    const шум = (x, y, p, s) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const h = (a, b) => хэш(((a % p) + p) % p, ((b % p) + p) % p, s);
      return h(xi, yi) * (1 - u) * (1 - v) + h(xi + 1, yi) * u * (1 - v) + h(xi, yi + 1) * (1 - u) * v + h(xi + 1, yi + 1) * u * v;
    };
    const fbm = (x, y, p, s, окт = 5) => {
      let с = 0, а = 0.5, ч = 1, п = p;
      for (let i = 0; i < окт; i++) {
        с += а * шум(x * ч, y * ч, п, s + i);
        ч *= 2; п *= 2; а *= 0.5;
      }
      return с;
    };
    const смесь = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const сделать = (имя, f) => {
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      const d = g.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const [r, gg, b, ш] = f(x / N, y / N);
        const i = (y * N + x) * 4;
        d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; d.data[i + 3] = Math.max(0, Math.min(255, ш * 255));
      }
      g.putImageData(d, 0, 0);
      return [имя, c.toDataURL('image/webp', 0.9)];
    };
    const жилы = (x, y, масштаб, резкость, сдвиг, s) => {
      const т = fbm(x * 4, y * 4, 4, s) * 2.2;
      const v = Math.sin((x * масштаб + y * масштаб * 0.6 + т + сдвиг) * Math.PI);
      return Math.pow(1 - Math.abs(v), резкость);
    };
    const фаб = [];
    фаб.push(сделать('мрамор-каррара', (x, y) => {
      const ж = жилы(x, y, 3, 4, 0, 1) * 0.9 + жилы(x, y, 5, 7, 0.3, 7) * 0.6;
      const пятно = fbm(x * 6, y * 6, 6, 3);
      const c = смесь([236, 236, 232], [170, 172, 176], Math.min(1, ж * 0.9 + (пятно - 0.45) * 0.4));
      return [...c, 0.18 + ж * 0.05];
    }));
    фаб.push(сделать('мрамор-калакатта', (x, y) => {
      const ж = жилы(x, y, 2, 2.4, 0.1, 11);
      const ж2 = жилы(x, y, 4, 5, 0.6, 13) * 0.9;
      const зол = смесь([245, 244, 240], [150, 120, 80], Math.min(1, ж * 1.9));
      const c = смесь(зол, [90, 90, 96], Math.min(1, ж2 * 1.3));
      return [...c, 0.16];
    }));
    фаб.push(сделать('гранит', (x, y) => {
      const а = шум(x * 256, y * 256, 256, 21), б = шум(x * 128, y * 128, 128, 23), ф = fbm(x * 8, y * 8, 8, 25);
      const точ = а > 0.78 ? 1 : б > 0.82 ? -1 : 0;
      const основа = смесь([88, 88, 92], [128, 124, 120], ф);
      const c = точ === 1 ? смесь(основа, [28, 28, 30], 0.8) : точ === -1 ? смесь(основа, [214, 200, 190], 0.6) : основа;
      return [...c, 0.32];
    }));
    фаб.push(сделать('кварц', (x, y) => {
      const а = шум(x * 256, y * 256, 256, 31), ф = fbm(x * 6, y * 6, 6, 33);
      const c = смесь([222, 220, 214], [190, 188, 184], ф * 0.6 + (а > 0.85 ? 0.4 : 0));
      return [...c, 0.22];
    }));
    фаб.push(сделать('плитка', (x, y) => {
      const k = 4, u = (x * k) % 1, v = (y * k) % 1;
      const шов = u < 0.025 || v < 0.025 || u > 0.985 || v > 0.985;
      const ф = fbm(x * 10, y * 10, 10, 41);
      const c = шов ? [120, 118, 114] : смесь([232, 232, 228], [210, 210, 206], ф * 0.6);
      return [...c, шов ? 0.9 : 0.15];
    }));
    const дерево = (имя, светлый, тёмный, колец, шер, s) =>
      фаб.push(сделать(имя, (x, y) => {
        const т = fbm(x * 2, y * 24, 2, s) * 2.5;
        const кольца = ((x * колец + т) % 1);
        const волокно = fbm(x * 4, y * 200, 4, s + 5);
        const t = Math.pow(Math.abs(Math.sin(кольца * Math.PI)), 1.5) * 0.7 + волокно * 0.3;
        return [...смесь(светлый, тёмный, t), шер];
      }));
    дерево('дуб', [196, 156, 104], [140, 100, 58], 9, 0.55, 51);
    дерево('орех', [120, 84, 56], [66, 42, 28], 11, 0.5, 61);
    дерево('шпон', [210, 176, 130], [170, 128, 86], 7, 0.5, 71);
    дерево('лдсп-дерево', [186, 158, 120], [150, 122, 90], 6, 0.65, 81);
    фаб.push(сделать('текстиль', (x, y) => {
      const k = 128, a = Math.sin(x * k * Math.PI * 2) * 0.5 + 0.5, b = Math.sin(y * k * Math.PI * 2) * 0.5 + 0.5;
      const н = (a > 0.5) !== (b > 0.5) ? 0.12 : -0.08;
      const ф = шум(x * 256, y * 256, 256, 91) * 0.1;
      const c = [150 + н * 255 + ф * 255, 142 + н * 255 + ф * 255, 132 + н * 255 + ф * 255];
      return [...c, 0.95];
    }));
    фаб.push(сделать('металл-шлифованный', (x, y) => {
      const л = fbm(x * 2, y * 256, 2, 101, 4);
      const c = смесь([170, 172, 176], [205, 207, 210], л);
      return [...c, 0.35];
    }));
    return фаб;
  });
  await браузер.close();
  const куда = path.join('public', 'Библиотека', 'текстуры', 'запасные'); fs.mkdirSync(куда, { recursive: true });
  fs.mkdirSync(куда, { recursive: true });
  let всего = 0;
  for (const [имя, url] of результат) {
    const буф = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(куда, имя + '.webp'), буф);
    всего += буф.length;
    console.log(имя, Math.round(буф.length / 1024), 'КБ');
  }
  console.log('итого', (всего / 1048576).toFixed(2), 'МБ');
})();
