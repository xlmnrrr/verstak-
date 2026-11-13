/**
 * Окно «Смета» (13.11.2026): обмер помещения, материалы с отходом, фурнитура, свет и сантехника, отделка, работы.
 * Длины — в мм, см и м сразу; цены — мастера, помнятся на этом компьютере (useUI.цены); итог — по строкам с ценой.
 * «Копировать для Excel» кладёт таблицу в буфер с табуляциями.
 */
import { useMemo, useState } from 'react';
import { useКухня } from '../store';
import { useUI } from '../store/интерфейс';
import { полнаяСмета, суммаСтроки, ГРУППЫ_СМЕТЫ, type СтрокаСметы } from '../model/смета-полная';
import { спецификация } from '../model/производство';
import { обмерПомещения } from '../model/контур-правка';
import { длина, площадьМ2, всеЕдиницы, type Единица } from '../model/единицы';

const деньги = (v: number) => `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const число = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

export function Смета() {
  const п2 = useКухня((s) => s.проект2);
  const активное = useКухня((s) => s.помещениеАктивное);
  const е = useUI((s) => s.единицы);
  const цены = useUI((s) => s.цены);
  const установить = useUI((s) => s.установить);
  const [весь, задатьВесь] = useState(false);
  const помId = весь ? undefined : активное;
  const итог = useMemo(() => полнаяСмета(п2, помId), [п2, помId]);
  const спец = useMemo(() => спецификация(п2, помId), [п2, помId]);
  const помещения = п2.помещения.filter((п) => !помId || п.id === помId);
  const [скопировано, задатьСкопировано] = useState(false);

  const суммы = итог.строки.map((с) => суммаСтроки(с, цены[с.ключ]));
  const всего = суммы.reduce<number>((a, b) => a + (b ?? 0), 0);
  const безЦены = суммы.filter((x) => x === null).length;
  const задатьЦену = (ключ: string, v: number) => установить({ цены: { ...цены, [ключ]: v } });

  const копировать = async () => {
    const строки = [['Группа', 'Позиция', 'Количество', 'Ед.', 'Цена, ₽', 'Сумма, ₽', 'Как посчитано'].join('\t')];
    итог.строки.forEach((с, i) => строки.push([с.группа, с.название, число(с.количество), с.единица, цены[с.ключ] ? число(цены[с.ключ]) : '', суммы[i] !== null ? число(суммы[i]!) : '', с.пояснение].join('\t')));
    строки.push(['', 'Итого', '', '', '', число(всего), безЦены ? `без цены: ${безЦены}` : ''].join('\t'));
    try {
      await navigator.clipboard.writeText(строки.join('\n'));
      задатьСкопировано(true);
      window.setTimeout(() => задатьСкопировано(false), 2500);
    } catch {
      useКухня.getState().сообщить('Буфер обмена недоступен', 'ошибка');
    }
  };

  return (
    <div className="смета">
      <div className="смета-панель">
        {п2.помещения.length > 1 && (
          <div className="сегменты" role="group" aria-label="Что считать">
            <button type="button" aria-pressed={!весь} onClick={() => задатьВесь(false)}>
              Это помещение
            </button>
            <button type="button" aria-pressed={весь} onClick={() => задатьВесь(true)}>
              Вся квартира
            </button>
          </div>
        )}
        <div className="сегменты" role="group" aria-label="Единицы длин">
          {(['мм', 'см', 'м'] as Единица[]).map((x) => (
            <button key={x} type="button" aria-pressed={е === x} onClick={() => установить({ единицы: x })}>
              {x}
            </button>
          ))}
        </div>
        <button className="кн" type="button" onClick={копировать} data-действие="копировать-смету">
          {скопировано ? 'Скопировано' : 'Копировать для Excel'}
        </button>
      </div>

      <h4 className="подзаголовок">Обмер</h4>
      <table className="таблица-сравнения смета-обмер">
        <thead>
          <tr>
            <th>Помещение</th>
            <th>Пол</th>
            <th>Стены без проёмов</th>
            <th>Периметр</th>
            <th>Высота</th>
          </tr>
        </thead>
        <tbody>
          {помещения.map((п) => {
            const о = обмерПомещения(п);
            return (
              <tr key={п.id}>
                <td>{п.название}</td>
                <td>{площадьМ2(о.полМ2)}</td>
                <td>{площадьМ2(о.стеныМ2)}</td>
                <td title={всеЕдиницы(о.периметрМ * 1000)}>{длина(о.периметрМ * 1000, е === 'мм' ? 'м' : е)}</td>
                <td title={всеЕдиницы(о.высотаМ * 1000)}>{длина(о.высотаМ * 1000, е)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {ГРУППЫ_СМЕТЫ.map((г) => {
        const строки = итог.строки.map((с, i) => [с, i] as [СтрокаСметы, number]).filter(([с]) => с.группа === г);
        if (!строки.length) return null;
        return (
          <section key={г}>
            <h4 className="подзаголовок">{г}</h4>
            <table className="таблица-сравнения смета-таблица">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Кол-во</th>
                  <th>Цена за ед., ₽</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {строки.map(([с, i]) => (
                  <tr key={с.ключ} data-ключ={с.ключ}>
                    <td>
                      {с.название}
                      <small>{с.пояснение}</small>
                      {с.мм !== undefined && <small className="смета-единицы">{всеЕдиницы(с.мм)}</small>}
                    </td>
                    <td>
                      {число(с.количество)} {с.единица}
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        aria-label={`Цена: ${с.название}`}
                        defaultValue={цены[с.ключ] || ''}
                        onBlur={(e) => задатьЦену(с.ключ, Math.max(0, Number(e.target.value.replace(',', '.')) || 0))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>
                    <td>{суммы[i] !== null ? деньги(суммы[i]!) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <p className="смета-итог" role="status">
        Итого <b>{деньги(всего)}</b>
        {безЦены > 0 && <span> · без цены {безЦены} {безЦены === 1 ? 'строка' : безЦены < 5 ? 'строки' : 'строк'} — впишите цену, и сумма пересчитается</span>}
      </p>

      <h4 className="подзаголовок">Изделия · {итог.изделий}</h4>
      <table className="таблица-сравнения смета-изделия">
        <thead>
          <tr>
            <th>Изделие</th>
            <th>Ш × Г × В, {е}</th>
            <th>Шт</th>
          </tr>
        </thead>
        <tbody>
          {спец.map((с) => (
            <tr key={`${с.изделие}|${с.ш}|${с.г}|${с.в}|${с.помещение}`}>
              <td>
                {с.название}
                {весь && <small>{с.помещение}</small>}
              </td>
              <td title={`${всеЕдиницы(с.ш)} × ${всеЕдиницы(с.г)} × ${всеЕдиницы(с.в)}`}>{[с.ш, с.г, с.в].map((v) => длина(v, е).replace(` ${е}`, '')).join(' × ')}</td>
              <td>{с.количество}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="подсказка-мелко">Нормы расхода типовые: ЛДСП +15 % на раскрой, ХДФ +10 %, кромка +10 %, пол +7 %. Цены помнятся на этом компьютере для всех проектов.</p>
    </div>
  );
}
