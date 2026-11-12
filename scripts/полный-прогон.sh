#!/bin/bash
# Этап 8: полный прогон: tsc, тесты, все приёмки в Electron. Итоги в проверка/полный-прогон.log
cd "$(dirname "$0")/.."
LOG="проверка/полный-прогон.log"
: > "$LOG"
echo "== tsc" >> "$LOG"; npx tsc --noEmit >> "$LOG" 2>&1; echo "tsc код: $?" >> "$LOG"
echo "== npm test" >> "$LOG"; npx vitest run 2>&1 | grep -E "Test Files|Tests " >> "$LOG"
for N in 1А1 1А2 1Б1 1Б2 2 3 4 5 6 A B C П интерфейса доп десктопа; do
  echo "== приёмка $N" >> "$LOG"
  timeout 600 node "scripts/проверка-$N.cjs" http://127.0.0.1:5274/ 2>&1 | grep -E "^НЕТ|Итог|Итого|сбой" >> "$LOG"
  echo "код: ${PIPESTATUS[0]}" >> "$LOG"
done
echo "== конец" >> "$LOG"
