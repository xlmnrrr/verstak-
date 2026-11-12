/**
 * Выгрузка: CSV (для программ раскроя), XLSX (деталировка и расход для правки в Excel), glTF (3D-модель), PDF-чертёж (HTML → печать в Electron).
 * Все таблицы строятся из model/производство.ts, поэтому сходятся с 3D и сметой.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { изделиеПоИд } from '../model/каталог';
import { стены as рёбра, площадьМ2 } from '../model/помещение';
import { коробаСтен } from '../model/стены';
import { пометкаПересечений, следУглы } from '../model/проверка';
import { деталировка, расход, спецификация, type СтрокаДеталировки } from '../model/производство';
import type { ПроектV2 } from '../model/типы';
import { примитивыЭкземпляра } from '../render/примитивы';
import { поверхность, умолчаниеПоверхности } from '../render/материалы';

export interface ПоляШтампа {
  заказ: string;
  клиент: string;
  дизайнер: string;
}

const ПОДПИСЬ_РОЛИ: Record<string, string> = {
  боковина: 'Боковина',
  дно: 'Дно',
  крыша: 'Крыша',
  полка: 'Полка',
  перегородка: 'Перегородка',
  задник: 'Задняя стенка',
  цоколь: 'Цоколь',
  фасад: 'Фасад',
  'ящик-фасад': 'Фасад ящика',
  'ящик-бок': 'Бок ящика',
  'ящик-перед': 'Перед ящика',
  'ящик-зад': 'Зад ящика',
  'ящик-дно': 'Дно ящика',
  столешница: 'Столешница',
  сиденье: 'Сиденье',
  спинка: 'Спинка',
  ножка: 'Ножка',
};
const роль = (р: string) => ПОДПИСЬ_РОЛИ[р] ?? р;
const кромкаТекст = (к: СтрокаДеталировки['кромка']) => (к.some((v) => v > 0) ? `д:${к[0] ? 1 : 0}${к[1] ? 1 : 0} ш:${к[2] ? 1 : 0}${к[3] ? 1 : 0}` : '—');

/* ------------------------------------------------------------------ таблицы */

export function таблицаДеталировки(п: ПроектV2, помещение?: string): (string | number)[][] {
  const шапка = ['№', 'Изделие', 'Деталь', 'Длина, мм', 'Ширина, мм', 'Толщина, мм', 'Кол-во', 'Материал', 'Кромка (длина 1/2, ширина 1/2), мм'];
  const строки = деталировка(п, помещение).map((с, i) => [i + 1, с.изделие, роль(с.роль), с.длина, с.ширина, с.толщина, с.количество, с.материал, с.кромка.join(' / ')]);
  return [шапка, ...строки];
}

export function таблицаСпецификации(п: ПроектV2, помещение?: string): (string | number)[][] {
  const шапка = ['№', 'Изделие', 'Помещение', 'Ширина, мм', 'Глубина, мм', 'Высота, мм', 'Кол-во'];
  const строки: (string | number)[][] = [шапка, ...спецификация(п, помещение).map((с, i) => [i + 1, с.название, с.помещение, с.ш, с.г, с.в, с.количество])];
  // пометка для цеха: в проекте есть пересечения предметов или выступы
  const пометка = пометкаПересечений(п);
  if (пометка) строки.push(['', `ПРИМЕЧАНИЕ: ${пометка}`, '', '', '', '', '']);
  return строки;
}

export function таблицаРасхода(п: ПроектV2, помещение?: string): (string | number)[][] {
  const р = расход(деталировка(п, помещение));
  const строки: (string | number)[][] = [['Показатель', 'Значение', 'Единица']];
  for (const [т, л] of Object.entries(р.листов)) строки.push([`ЛДСП ${т} мм, листов 2750 × 1830 (без отхода)`, Math.round(л * 100) / 100, 'лист']);
  строки.push(['Площадь плит ЛДСП', Math.round(р.плитМ2 * 100) / 100, 'м²']);
  строки.push(['ХДФ (задние стенки, дно ящиков)', Math.round(р.хдфМ2 * 100) / 100, 'м²']);
  for (const [т, м] of Object.entries(р.кромкаМ)) строки.push([`Кромка ${т} мм`, Math.round(м * 10) / 10, 'м']);
  строки.push(['Кромка всего', Math.round(р.кромкаВсегоМ * 10) / 10, 'м']);
  строки.push(['Деталей', р.деталей, 'шт']);
  return строки;
}

/* ------------------------------------------------------------------ CSV */

/** CSV для программ раскроя: разделитель «;», UTF-8 с BOM (Excel и раскройные программы читают русский текст) */
export function csv(п: ПроектV2, помещение?: string): string {
  const шапка = ['Длина', 'Ширина', 'Толщина', 'Количество', 'Материал', 'Деталь', 'Изделие', 'Кромка длина 1', 'Кромка длина 2', 'Кромка ширина 1', 'Кромка ширина 2'];
  const экран = (v: string | number) => {
    const с = String(v);
    return /[;"\n]/.test(с) ? `"${с.replace(/"/g, '""')}"` : с;
  };
  const строки = деталировка(п, помещение).map((с) => [с.длина, с.ширина, с.толщина, с.количество, с.материал, роль(с.роль), с.изделие, ...с.кромка]);
  return '﻿' + [шапка, ...строки].map((р) => р.map(экран).join(';')).join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ XLSX */

const экранXml = (с: string) => с.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const буква = (i: number) => {
  let с = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) с = String.fromCharCode(65 + ((n - 1) % 26)) + с;
  return с;
};

function листXml(таблица: (string | number)[][]): string {
  const строки = таблица
    .map((р, ri) => {
      const ячейки = р
        .map((v, ci) => {
          const адрес = `${буква(ci)}${ri + 1}`;
          const стиль = ri === 0 ? ' s="1"' : '';
          return typeof v === 'number' ? `<c r="${адрес}"${стиль}><v>${v}</v></c>` : `<c r="${адрес}" t="inlineStr"${стиль}><is><t xml:space="preserve">${экранXml(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${ячейки}</row>`;
    })
    .join('');
  const ширины = (таблица[0] ?? []).map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(44, Math.max(10, ...таблица.map((р) => String(р[i] ?? '').length + 2)))}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${ширины}</cols><sheetData>${строки}</sheetData></worksheet>`;
}

/** XLSX с тремя листами: Деталировка, Спецификация, Расход. Собирается вручную (zip без сжатия не нужен — fflate жмёт). */
export function xlsx(п: ПроектV2, помещение?: string): Uint8Array {
  const листы: [string, (string | number)[][]][] = [
    ['Деталировка', таблицаДеталировки(п, помещение)],
    ['Спецификация', таблицаСпецификации(п, помещение)],
    ['Расход', таблицаРасхода(п, помещение)],
  ];
  const файлы: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${листы.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${листы.map(([н], i) => `<sheet name="${н}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${листы.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${листы.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
    ),
  };
  листы.forEach(([, т], i) => (файлы[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(листXml(т))));
  return zipSync(файлы, { level: 6 });
}

/* ------------------------------------------------------------------ glTF */

/** 3D-модель .glb: детали из тех же примитивов, что рисует рендер; стены и пол — коробками. Единицы — метры. */
export async function glb(п: ПроектV2, помещениеId?: string): Promise<ArrayBuffer> {
  const сцена = new THREE.Scene();
  const материалы = new Map<string, THREE.MeshStandardMaterial>();
  const материал = (цвет: [number, number, number], шер: number, мет: number) => {
    const к = `${цвет.map((v) => v.toFixed(3)).join(',')}|${шер}|${мет}`;
    let м = материалы.get(к);
    if (!м) {
      м = new THREE.MeshStandardMaterial({ roughness: шер, metalness: мет });
      м.color.setRGB(цвет[0], цвет[1], цвет[2], THREE.LinearSRGBColorSpace);
      материалы.set(к, м);
    }
    return м;
  };
  const геом = new Map<string, THREE.BufferGeometry>();
  const получить = (форма: string, ш: number, в: number, г: number) => {
    const к = `${форма}|${ш}|${в}|${г}`;
    let x = геом.get(к);
    if (!x) {
      x = форма === 'цилиндр' ? new THREE.CylinderGeometry(ш / 2, ш / 2, в, 16) : форма === 'сфера' ? new THREE.SphereGeometry(ш / 2, 16, 10) : форма === 'конус' ? new THREE.ConeGeometry(ш / 2, в, 16) : new THREE.BoxGeometry(ш, в, г);
      геом.set(к, x);
    }
    return x;
  };
  for (const э of п.объекты) {
    if (помещениеId && э.помещение !== помещениеId) continue;
    const изд = изделиеПоИд(э.изделие);
    if (!изд) continue;
    const группа = new THREE.Group();
    группа.name = э.название ?? изд.название;
    группа.position.set(э.позиция[0] / 1000, э.позиция[1] / 1000, э.позиция[2] / 1000);
    группа.rotation.y = (-э.поворот * Math.PI) / 180;
    for (const пр of примитивыЭкземпляра(изд, э).примитивы) {
      const [a, b, c] = пр.размер;
      const форма = пр.форма === 'стекло' ? 'плита' : пр.форма;
      let цв: [number, number, number];
      let шер: number;
      let мет: number;
      if (typeof пр.мат === 'string') {
        const k = пр.мат;
        const знач = k === 'зеркало' || k === 'стекло' ? undefined : ((э.материалы as Record<string, string> | undefined)?.[k] ?? (изд.материалы as Record<string, string>)[k]);
        const р = знач ? поверхность(знач, k) : умолчаниеПоверхности(k);
        [цв, шер, мет] = [р.цвет, р.шер, р.мет];
      } else {
        const р = поверхность(пр.мат.цвет, 'корпус');
        [цв, шер, мет] = [р.цвет, пр.мат.шер, пр.мат.мет];
      }
      const mesh = new THREE.Mesh(получить(форма, a / 1000, b / 1000, c / 1000), материал(цв, шер, мет));
      const R = пр.R;
      mesh.matrixAutoUpdate = false;
      mesh.matrix.set(R[0], R[1], R[2], пр.t[0] / 1000, R[3], R[4], R[5], пр.t[1] / 1000, R[6], R[7], R[8], пр.t[2] / 1000, 0, 0, 0, 1);
      группа.add(mesh);
    }
    сцена.add(группа);
  }
  for (const пом of п.помещения) {
    if (помещениеId && пом.id !== помещениеId) continue;
    const { стены } = коробаСтен(пом);
    for (const с of стены) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(с.размер[0] / 1000, с.размер[1] / 1000, с.размер[2] / 1000), материал([0.6, 0.55, 0.48], 0.95, 0));
      mesh.position.set(с.центр[0] / 1000, с.центр[1] / 1000, с.центр[2] / 1000);
      mesh.rotation.y = Math.atan2(-с.вдоль[1], с.вдоль[0]);
      mesh.name = `стена ${пом.название}`;
      сцена.add(mesh);
    }
  }
  return (await new GLTFExporter().parseAsync(сцена, { binary: true })) as ArrayBuffer;
}

/* ------------------------------------------------------------------ PDF-чертёж (HTML для печати) */

const мм = (v: number) => Math.round(v).toLocaleString('ru-RU');

function планSvg(п: ПроектV2, помещениеId: string): string {
  const пом = п.помещения.find((x) => x.id === помещениеId) ?? п.помещения[0];
  const xs = пом.контур.map((p) => p[0]);
  const zs = пом.контур.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const поле = Math.max(x1 - x0, z1 - z0) * 0.12;
  const вид = `${x0 - поле} ${z0 - поле} ${x1 - x0 + 2 * поле} ${z1 - z0 + 2 * поле}`;
  const с = (x1 - x0 + 2 * поле) / 900;
  const объекты = п.объекты.filter((о) => о.помещение === пом.id && изделиеПоИд(о.изделие)?.тип !== 'проём');
  const фигуры = объекты
    .map((о, i) => {
      const у = следУглы(о.позиция, о.поворот, о.габариты.ш, о.габариты.г);
      const ц = [у.reduce((a, p) => a + p[0], 0) / 4, у.reduce((a, p) => a + p[1], 0) / 4];
      return `<polygon points="${у.map((p) => p.join(',')).join(' ')}" fill="#e9e1d0" stroke="#3a2f22" stroke-width="${с * 1.4}"/><text x="${ц[0]}" y="${ц[1]}" font-size="${с * 15}" text-anchor="middle" dominant-baseline="central" fill="#142019">${i + 1}</text>`;
    })
    .join('');
  const стеныСвг = рёбра(пом.контур)
    .map((р) => `<line x1="${р.а[0]}" y1="${р.а[1]}" x2="${р.б[0]}" y2="${р.б[1]}" stroke="#142019" stroke-width="${с * 3}"/>`)
    .join('');
  const выноска = (ax: number, ay: number, bx: number, by: number, текст: string, вертикально: boolean) =>
    `<g stroke="#174b8a" stroke-width="${с * 1.2}" fill="#174b8a"><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/><line x1="${ax - (вертикально ? 0 : 0)}" y1="${ay - (вертикально ? 0 : с * 8)}" x2="${ax}" y2="${ay + (вертикально ? 0 : с * 8)}"/><line x1="${bx}" y1="${by - (вертикально ? 0 : с * 8)}" x2="${bx}" y2="${by + (вертикально ? 0 : с * 8)}"/><text x="${(ax + bx) / 2}" y="${(ay + by) / 2 - с * 6}" font-size="${с * 15}" text-anchor="middle" stroke="none">${текст}</text></g>`;
  const размеры =
    выноска(x0, z1 + поле * 0.55, x1, z1 + поле * 0.55, `${мм(x1 - x0)} мм`, false) +
    `<g transform="rotate(-90 ${x0 - поле * 0.55} ${(z0 + z1) / 2})">${выноска(x0 - поле * 0.55 - (z1 - z0) / 2, (z0 + z1) / 2 + 0, x0 - поле * 0.55 + (z1 - z0) / 2, (z0 + z1) / 2, `${мм(z1 - z0)} мм`, false)}</g>`;
  return `<svg viewBox="${вид}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">${стеныСвг}${фигуры}${размеры}</svg>`;
}

const таблицаHtml = (т: (string | number)[][]) =>
  `<table><thead><tr>${т[0].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${т.slice(1).map((р) => `<tr>${р.map((x) => `<td>${typeof x === 'string' ? x.replace(/&/g, '&amp;').replace(/</g, '&lt;') : x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

/** Чертёж в стиле PROSTO: рамка и штамп на каждом листе, план с выносками, спецификация, деталировка, расход и кромка */
export function htmlЧертежа(п: ПроектV2, штамп: ПоляШтампа, помещениеId?: string): string {
  const дата = new Date().toLocaleDateString('ru-RU');
  const пометка = пометкаПересечений(п);
  const помещения = помещениеId ? п.помещения.filter((x) => x.id === помещениеId) : п.помещения;
  const планы = помещения
    .map((пом) => {
      const объекты = п.объекты.filter((о) => о.помещение === пом.id && изделиеПоИд(о.изделие)?.тип !== 'проём');
      const легенда = объекты.map((о, i) => `<tr><td>${i + 1}</td><td>${о.название ?? изделиеПоИд(о.изделие)?.название ?? о.изделие}</td><td>${о.габариты.ш} × ${о.габариты.г} × ${о.габариты.в}</td></tr>`).join('');
      return `<section class="лист"><h2>План: ${пом.название} (${площадьМ2(пом.контур).toFixed(1)} м², высота стен ${typeof пом.высота === 'number' ? пом.высота : 'не задана'} мм)</h2><div class="план"><div class="рис">${планSvg(п, пом.id)}</div><table class="легенда"><thead><tr><th>№</th><th>Изделие</th><th>Ш × Г × В, мм</th></tr></thead><tbody>${легенда}</tbody></table></div></section>`;
    })
    .join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${п.название}: чертёж</title><style>
@page { size: A4 landscape; margin: 10mm 10mm 34mm 10mm; }
* { box-sizing: border-box; }
body { font: 10pt/1.3 'Segoe UI', Arial, sans-serif; color: #142019; margin: 0; }
.рамка { position: fixed; left: 0; top: 0; right: 0; bottom: -24mm; border: 0.6mm solid #142019; pointer-events: none; }
.штамп { position: fixed; right: 0; bottom: -24mm; width: 130mm; border: 0.4mm solid #142019; border-right: 0; border-bottom: 0; background: #fff; font-size: 8.5pt; display: grid; grid-template-columns: 26mm 1fr 20mm 30mm; }
.штамп div { padding: 1.2mm 2mm; border-right: 0.2mm solid #142019; border-bottom: 0.2mm solid #142019; }
.штамп .з { background: #eef1ef; font-size: 7.5pt; color: #36443d; }
.штамп .назв { grid-column: 1 / -1; font-weight: 700; font-size: 10pt; }
.штамп .прим { grid-column: 1 / -1; color: #982e1a; font-weight: 700; font-size: 8pt; }
.пометка { border: 0.4mm solid #982e1a; color: #982e1a; font-weight: 700; padding: 1.5mm 3mm; margin: 0 2mm 3mm; }
h1 { font-size: 15pt; margin: 0 0 3mm; } h2 { font-size: 11pt; margin: 0 0 3mm; }
.лист { page-break-after: always; padding: 2mm 2mm 0; }
.план { display: grid; grid-template-columns: 1fr 70mm; gap: 6mm; align-items: start; }
.рис { border: 0.2mm solid #b8c1bc; height: 150mm; } table { border-collapse: collapse; width: 100%; font-size: 8.5pt; }
th, td { border: 0.2mm solid #8e9a94; padding: 0.8mm 1.6mm; text-align: left; } thead { display: table-header-group; } tr { page-break-inside: avoid; }
th { background: #eef1ef; } .легенда { height: fit-content; }
</style></head><body>
<div class="рамка"></div>
<div class="штамп"><div class="назв">${п.название}</div><div class="з">Заказ №</div><div>${штамп.заказ || '—'}</div><div class="з">Дата</div><div>${дата}</div><div class="з">Клиент</div><div>${штамп.клиент || '—'}</div><div class="з">Дизайнер</div><div>${штамп.дизайнер || '—'}</div>${пометка ? `<div class="прим">${пометка}</div>` : ''}</div>
${пометка ? `<div class="пометка">ПРИМЕЧАНИЕ: ${пометка}</div>` : ''}
${планы}
<section class="лист"><h1>Спецификация модулей</h1>${таблицаHtml(таблицаСпецификации(п, помещениеId))}</section>
<section class="лист"><h1>Расход материалов и кромка</h1>${таблицаHtml(таблицаРасхода(п, помещениеId))}</section>
<section><h1>Деталировка</h1>${таблицаHtml(таблицаДеталировки(п, помещениеId))}</section>
</body></html>`;
}
