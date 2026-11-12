; Верстак: защита данных мастера при удалении и обновлении (этап 2).
; Папки «Проекты» и «Бэкапы» лежат рядом с программой (требование «данные рядом с приложением»),
; поэтому обычное удаление каталога установки стёрло бы работу. Здесь удаляется всё, кроме них.
; Стандартный сценарий electron-builder (RMDir /r $INSTDIR и перенос каталога при обновлении) заменяется целиком.
; Файл должен быть в UTF-8 с BOM (имена папок русские).

!macro customRemoveFiles
  SetOutPath $TEMP
  FindFirst $0 $1 "$INSTDIR\*.*"
  verstak_loop:
    StrCmp $1 "" verstak_done
    StrCmp $1 "." verstak_next
    StrCmp $1 ".." verstak_next
    StrCmp $1 "Проекты" verstak_next
    StrCmp $1 "Бэкапы" verstak_next
    IfFileExists "$INSTDIR\$1\*.*" 0 verstak_file
      RMDir /r "$INSTDIR\$1"
      Goto verstak_next
    verstak_file:
      Delete "$INSTDIR\$1"
    verstak_next:
    FindNext $0 $1
    Goto verstak_loop
  verstak_done:
  FindClose $0
  ; пустой каталог убираем; если внутри остались данные, RMDir без /r промолчит
  RMDir "$INSTDIR"
!macroend
