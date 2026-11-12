/**
 * Мини-превью изделия: картинка из public/Библиотека/превью/<id>.webp (снимается скриптом scripts/превью-изделий.cjs,
 * лежит внутри приложения, работает офлайн). Нет файла — запасной значок.
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useКухня } from '../store';
import type { Изделие } from '../model/типы';

export const адресПревью = (id: string) => `./Библиотека/превью/${id}.webp`;

export function ПревьюИзделия({ id, размер = 44, запас }: { id: string; размер?: number; запас?: ReactNode }) {
  const [нет, установитьНет] = useState(false);
  if (нет) return <>{запас ?? null}</>;
  return (
    <img
      className="превью-изделия"
      src={адресПревью(id)}
      width={размер}
      height={размер}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => установитьНет(true)}
    />
  );
}

/** Превью выбранного объекта (по id экземпляра) для шапки панели свойств */
export function ПревьюЭкземпляра({ ид, размер = 48 }: { ид: string; размер?: number }) {
  const изделие = useКухня((s) => s.проект2.объекты.find((x) => x.id === ид)?.изделие);
  if (!изделие) return null;
  return <ПревьюИзделия id={изделие} размер={размер} />;
}

/** Подсказка при наведении: крупное превью, название, габариты, заметка */
export function ПодсказкаИзделия({ и, x, y }: { и: Изделие; x: number; y: number }) {
  const верх = Math.max(8, Math.min(y, window.innerHeight - 300));
  // выезжающая панель каталога сдвигается через transform, поэтому fixed внутри неё считался бы от панели: выносим в body
  return createPortal(
    <div className="подсказка-изделия" role="tooltip" style={{ left: x, top: верх }}>
      <ПревьюИзделия id={и.id} размер={176} />
      <b>{и.название}</b>
      <span className="размер">
        {и.габариты.ш} × {и.габариты.г} × {и.габариты.в} мм{и.крепление === 'стена' ? ' · навесной' : ''}
      </span>
      {и.заметка && <span className="заметка">{и.заметка}</span>}
    </div>,
    document.body,
  );
}
