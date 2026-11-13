import { it } from 'vitest';
import { КАТАЛОГ_V2 } from './src/model/каталог';
import { новыйЭкземпляр } from './src/model/проект';
import { примитивыЭкземпляра } from './src/render/примитивы';
import { треугольников } from './src/render/модели/геометрии-моделей';
it('x', () => {
  const рез: [string, number][] = [];
  for (const изд of КАТАЛОГ_V2) {
    const э = новыйЭкземпляр(изд, 'п1');
    const р = примитивыЭкземпляра(изд, э, true).примитивы;
    let т = 0;
    const по: Record<string, number> = {};
    for (const п of р) {
      if (п.форма === 'модель' && п.модель && !п.модель.геом.startsWith('gltf:')) {
        const k = треугольников(п.модель.геом);
        т += k;
        const ключ = п.модель.геом.split(':')[0];
        по[ключ] = (по[ключ] ?? 0) + k;
      } else if (п.форма === 'плита') т += 12;
    }
    рез.push([изд.id + ' ' + JSON.stringify(по), т]);
  }
  рез.sort((a, b) => b[1] - a[1]);
  console.log(рез.slice(0, 12).map(([a, b]) => b + ' ' + a).join('\n'));
});
