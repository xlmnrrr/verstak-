/** Сохранение выгрузки: в Electron — диалог «Сохранить как», в браузере — скачивание файла */
interface МостЭкспорта {
  кухня?: { экспорт?: { сохранить: (имя: string, base64: string, расширение: string, фильтр?: string) => Promise<{ ок: boolean; путь?: string; ошибка?: string }>; pdf: (html: string, имя: string) => Promise<{ ок: boolean; путь?: string; ошибка?: string }> } };
}
const мост = () => (window as unknown as МостЭкспорта).кухня?.экспорт;

const вBase64 = (д: Uint8Array) => {
  let с = '';
  for (let i = 0; i < д.length; i += 0x8000) с += String.fromCharCode(...д.subarray(i, i + 0x8000));
  return btoa(с);
};

export async function сохранитьФайл(имя: string, данные: string | Uint8Array | ArrayBuffer, расширение: string, фильтр: string): Promise<{ ок: boolean; путь?: string; ошибка?: string }> {
  const байты = typeof данные === 'string' ? new TextEncoder().encode(данные) : данные instanceof Uint8Array ? данные : new Uint8Array(данные);
  const м = мост();
  if (м) return м.сохранить(имя, вBase64(байты), расширение, фильтр);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([байты as BlobPart]));
  a.download = `${имя}.${расширение}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { ок: true, путь: a.download };
}

export async function сохранитьPdf(html: string, имя: string) {
  const м = мост();
  if (m_есть(м)) return м!.pdf(html, имя);
  const окно = window.open('', '_blank');
  if (!окно) return { ок: false, ошибка: 'окно печати заблокировано' };
  окно.document.write(html);
  окно.document.close();
  окно.focus();
  setTimeout(() => окно.print(), 400);
  return { ок: true, путь: 'печать' };
}
const m_есть = (x: unknown) => !!x;

export const сохранитьФайлы = { файл: сохранитьФайл, pdf: сохранитьPdf };
