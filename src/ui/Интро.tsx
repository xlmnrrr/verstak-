/**
 * Вступление при запуске: логотип «строится» чертёжными линиями (столешница, ножки, размерная линия), затем сцена
 * комнаты собирается на глазах, камера пролетает по ней, вечером зажигается свет и всё плавно переходит в приложение.
 * ~18 секунд; пропуск — кнопка, Esc, Пробел, Enter. Выключается в «Настройках → Вступление при запуске».
 * Не показывается в автотестах (окно Electron с отладочным портом) и при «уменьшить анимацию» в системе.
 */
import { useEffect, useRef, useState } from 'react';
import { создатьИнтро3D, ДЛИТЕЛЬНОСТЬ_ИНТРО, type Интро3D } from './интро/сцена3d';
import './интро/интро.css';

const ПОДПИСИ: { с: number; до: number; текст: string; ниже: string }[] = [
  { с: 4.6, до: 7.7, текст: 'Комната — по вашим замерам', ниже: 'стены, проёмы и высота такие, как в жизни' },
  { с: 7.9, до: 11.1, текст: '141 изделие в каталоге', ниже: 'шкафы, кухня, техника, мебель, свет и декор' },
  { с: 11.3, до: 14.1, текст: 'Каждая деталь — настоящая', ниже: 'петли, ручки, стекло, вечерний свет' },
  { с: 14.3, до: 17.3, текст: 'Проверка размеров, смета и чертёж', ниже: 'сразу, пока вы расставляете мебель' },
];

const БУКВЫ = 'ВЕРСТАК'.split('');

/** Показывать ли вступление: не в автотестах, не при «уменьшить анимацию», не если выключено в настройках */
export function вступлениеНужно(включено: boolean): boolean {
  if (!включено) return false;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('без-интро')) return false;
    if (q.has('интро')) return true;
    if ((window as unknown as { кухня?: { тест?: boolean } }).кухня?.тест) return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  } catch {
    /* без проверок — показываем */
  }
  return true;
}

export function Интро({ закончено, большеНеПоказывать }: { закончено: () => void; большеНеПоказывать: () => void }) {
  const холст = useRef<HTMLCanvasElement>(null);
  const корень = useRef<HTMLDivElement>(null);
  const [подпись, setПодпись] = useState(-1);
  const [уходит, setУходит] = useState(false);
  const [кнопка, setКнопка] = useState(false);
  const пропуск = useRef<() => void>(() => {});

  useEffect(() => {
    const к = холст.current;
    const р = корень.current;
    if (!к || !р) return;
    let сцена: Интро3D | null = null;
    try {
      сцена = создатьИнтро3D(к);
    } catch {
      закончено();
      return;
    }
    const размер = () => сцена?.изменитьРазмер(р.clientWidth, р.clientHeight);
    размер();
    window.addEventListener('resize', размер);
    let t = 0;
    let прошлый = performance.now();
    let кадр = 0;
    let остановлено = false;
    let текущая = -1;
    const тик = (сейчас: number) => {
      if (остановлено) return;
      // долгий кадр (вкладка была скрыта) не прыгает вперёд: максимум 0,1 с за шаг
      t += Math.min(0.1, (сейчас - прошлый) / 1000);
      прошлый = сейчас;
      сцена?.кадр(t);
      к.style.opacity = String(Math.min(1, Math.max(0, (t - 3.3) / 1.2)));
      const н = ПОДПИСИ.findIndex((п) => t >= п.с && t < п.до);
      if (н !== текущая) {
        текущая = н;
        setПодпись(н);
      }
      if (t >= ДЛИТЕЛЬНОСТЬ_ИНТРО - 1.2 && !уход) {
        уход = true;
        setУходит(true);
      }
      if (t >= ДЛИТЕЛЬНОСТЬ_ИНТРО) {
        закончить();
        return;
      }
      кадр = requestAnimationFrame(тик);
    };
    let уход = false;
    const закончить = () => {
      if (остановлено) return;
      остановлено = true;
      cancelAnimationFrame(кадр);
      закончено();
    };
    пропуск.current = () => {
      if (уход) return;
      уход = true;
      setУходит(true);
      setTimeout(закончить, 420);
    };
    const кн = setTimeout(() => setКнопка(true), 900);
    const клавиша = (e: KeyboardEvent) => {
      if (['Escape', 'Space', 'Enter'].includes(e.code)) {
        e.preventDefault();
        пропуск.current();
      }
    };
    window.addEventListener('keydown', клавиша);
    кадр = requestAnimationFrame(тик);
    return () => {
      остановлено = true;
      cancelAnimationFrame(кадр);
      clearTimeout(кн);
      window.removeEventListener('resize', размер);
      window.removeEventListener('keydown', клавиша);
      сцена?.освободить();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={корень} className={`интро${уходит ? ' уходит' : ''}`} role="presentation" aria-label="Вступление «Верстак»">
      <canvas ref={холст} className="интро-холст" />
      <div className="интро-виньетка" />
      {/* чертёжная сетка и логотип строится линиями */}
      <div className="интро-логотип">
        <div className="интро-сетка" />
        <svg className="интро-знак" viewBox="0 0 64 64" role="img" aria-label="Верстак">
          <rect className="л-столешница" x="9" y="29" width="46" height="8" rx="1.5" pathLength={1} />
          <rect className="л-ножка" x="13" y="37" width="5" height="16" rx="1" pathLength={1} />
          <rect className="л-ножка л-н2" x="46" y="37" width="5" height="16" rx="1" pathLength={1} />
          <path className="л-перекладина" d="M18 45h28" pathLength={1} />
          <path className="л-размер" d="M9 18h46M9 14v8M55 14v8" pathLength={1} />
          <path className="л-стрелка" d="M16 18l4-3v6zM48 18l-4-3v6z" />
        </svg>
        <div className="интро-имя" aria-hidden="true">
          {БУКВЫ.map((б, i) => (
            <span key={i} style={{ animationDelay: `${3.0 + i * 0.09}s` }}>
              {б}
            </span>
          ))}
        </div>
        <div className="интро-слоган">конструктор мебели по размерам комнаты</div>
      </div>
      {/* подписи во время стройки */}
      <div className="интро-подписи" aria-live="polite">
        {ПОДПИСИ.map((п, i) => (
          <div key={i} className={`интро-подпись${подпись === i ? ' видна' : ''}`}>
            <b>{п.текст}</b>
            <span>{п.ниже}</span>
          </div>
        ))}
      </div>
      <div className={`интро-знак-угол${подпись >= 0 ? ' видна' : ''}`}>Верстак</div>
      {кнопка && (
        <div className="интро-кнопки">
          <button type="button" className="интро-пропуск" onClick={() => пропуск.current()}>
            Пропустить
          </button>
          <button
            type="button"
            className="интро-тихо"
            onClick={() => {
              большеНеПоказывать();
              пропуск.current();
            }}
          >
            Не показывать при запуске
          </button>
        </div>
      )}
    </div>
  );
}
