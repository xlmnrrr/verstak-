/**
 * Картинка на листе проекта (обложка, экран «Проекты»): снимок сцены, а если его нет или он не открылся —
 * план помещения чертёжной линией по данным файла. Так лист не бывает пустым: у проекта, написанного руками,
 * и у варианта планировки снимка ещё нет, а план есть всегда.
 */
import { useState } from 'react';
import type { СхемаЛиста } from '../../electron/схема-плана.mjs';
import { Иконка } from './design/Иконки';

export function ПланЛиста({ схема, className }: { схема: СхемаЛиста; className?: string }) {
  const xs = схема.контур.map((т) => т[0]);
  const zs = схема.контур.map((т) => т[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const поле = Math.max(x1 - x0, z1 - z0) * 0.08 + 60;
  const путь = схема.контур.map((т, i) => `${i ? 'L' : 'M'}${т[0]} ${т[1]}`).join(' ') + ' Z';
  const линия = Math.max(x1 - x0, z1 - z0) / 160;
  return (
    <svg className={`план-листа ${className ?? ''}`} viewBox={`${x0 - поле} ${z0 - поле} ${x1 - x0 + 2 * поле} ${z1 - z0 + 2 * поле}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={путь} fill="var(--поверх-2)" stroke="currentColor" strokeWidth={линия * 2.2} strokeLinejoin="round" />
      {схема.объекты.map(([x, z, ш, г, поворот, навесной], i) => (
        <rect
          key={i}
          x={-ш / 2}
          y={-г / 2}
          width={ш}
          height={г}
          transform={`translate(${x} ${z}) rotate(${поворот})`}
          fill={навесной ? 'none' : 'var(--латунь-фон, rgba(212,168,90,0.22))'}
          stroke="var(--синька, #7fb3e6)"
          strokeWidth={линия}
          strokeDasharray={навесной ? `${линия * 4} ${линия * 3}` : undefined}
        />
      ))}
    </svg>
  );
}

/** Снимок или план; ошибка загрузки снимка тоже уводит на план */
export function КартинкаЛиста({ превью, схема, размерЗначка = 32, className }: { превью?: string; схема?: СхемаЛиста; размерЗначка?: number; className: string }) {
  const [сломано, установитьСломано] = useState(false);
  if (превью && !сломано) {
    return (
      <span className={className}>
        <img src={превью} alt="" draggable={false} onError={() => установитьСломано(true)} />
      </span>
    );
  }
  if (схема && схема.контур.length >= 3) {
    return (
      <span className={`${className} есть-план`}>
        <ПланЛиста схема={схема} />
      </span>
    );
  }
  return (
    <span className={className}>
      <Иконка имя="помещение" размер={размерЗначка} />
    </span>
  );
}
