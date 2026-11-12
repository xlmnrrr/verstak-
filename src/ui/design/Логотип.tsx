/**
 * Знак «Верстака»: мастерская + чертёж. Латунная столешница и ножки верстака под синей размерной линией с засечками.
 * Цвета берутся из токенов темы (латунь, текст, синька): в «Мастерской» и «Кальке» знак читается одинаково.
 * Иконка приложения (build/знак.svg → build/icon.ico) нарисована на тёмной плашке по тем же формам.
 */
export function Знак({ размер = 32, плашка = false }: { размер?: number; плашка?: boolean }) {
  return (
    <svg width={размер} height={размер} viewBox="0 0 64 64" role="img" aria-label="Верстак" className="знак-лого">
      {плашка && <rect width="64" height="64" rx="14" fill="var(--поверх-2)" />}
      <rect x="9" y="29" width="46" height="8" rx="1.5" fill="var(--латунь)" />
      <rect x="13" y="37" width="5" height="16" rx="1" fill="var(--текст-1)" />
      <rect x="46" y="37" width="5" height="16" rx="1" fill="var(--текст-1)" />
      <path d="M18 45h28" stroke="var(--текст-1)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9 18h46M9 14v8M55 14v8" stroke="var(--синька)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M16 18l4-3v6zM48 18l-4-3v6z" fill="var(--синька)" />
    </svg>
  );
}
