# control-replacer
##Скрипт для автозамены

пока для удобства написан на js одним файлом. это сделано для того, чтобы можно было его тупо скопировать и вставить без сборки.

###Как работает
Запускается следующим образом
node replacer.js config.json

Например для замены Controls/toggle:Tumbler на Controls/toggle:NewTumbler
Файл JSON
```json
{
  "path": "",
  "replaces": [{
      "module": "Controls/toggle",
      "controls": [{
          "name": "Tumbler",
          "newName": "NewTumbler",
        }]
}
```

Если надо заменить Controls/toggle:Tumbler на Controls/Tumbler
```json
{
  "path": "",
  "replaces": [{
      "module": "Controls/toggle",
      "controls": [{
          "name": "Tumbler",
          "newName": "",
          "newModuleName": "Tumbler"
        }]
}
 ```

Важно чтобы в module разделение было сделано через / иначе возможна некорректная работа.

Скрипт умеет автоматически вносить правки в wml файлы. А также может заменять данные в ts tsx файлах
Корректно обрабатывает следующие сценарии:
import {Tumbler} from 'Controls/toggle'
<Tumbler>
import {Tumbler as View} from 'Controls/toggle'
<View>
import default as toggle from 'Controls/toggle'
<toggle.Tumbler>
import {Tumbler, Switch} from 'Controls/toggle'

Если из исходной библиотеки выносится 1 контрол, то скрипт сам создаст или найдет нужный импорт, и засунет туда новый контрол

Сейчас есть проблемы с импортом следующего вида:
import * as toggle from 'Controls/toggle';
Скрипт самостоятельно не сможет обработать подобные сценарии, на что кинет ошибку. Если вы полностью переносите всю библиотеку, то можно указать это название в replaces.newModule, в таком случае скрипт заменит импорт для библиотеки. Свойство стоит использовать только когда полностью переименовывается модуль, в противном случае скрипт отработает некорректно.

Также можно переименовывать различные утилиты, но возможно что-то будет работать не корректно

Скрипт проходится чисто по всем файлам, но не смотрит файлы меньше 50mb, но можно настроить другой размер(не рекомендуется устанавливать большее значение)
