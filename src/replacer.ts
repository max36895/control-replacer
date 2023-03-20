#!/usr/bin/env node
import { Script, TypeReplacer } from './modules/Script';
import { FileUtils } from './modules/FileUtils';
import { resetGit } from "./modules/Reset";
import { ICustomReplace, IParam, IReplaceOpt } from "./interfaces/IConfig";

const script = new Script();

// ===== помощь
function getScriptParam() {
    console.log('Скрипт предназначен для автоматического переименовывание контролов и их опций.' +
        ' Также предусмотрена возможность указать свое регулярное выражения для замены.');
    console.log(' -\t config.json - преименовывание контролов или модулей');
    console.log(' -\t replaceOpt config.json - переименовывание опций у контролов');
    console.log(' -\t customReplace config.json - кастомная замена');
    console.log(' -\t resetGit - откатывает изменения. Стоит использовать в том случае, если скрипт отработал не корректно.');
    console.log(' -\t');
}

function getScriptControlParam() {
    console.log('######################################################################');
    console.log('# Для корректной замены контролов укажите файл настроек              #');
    console.log('# Файл должен выглядеть следующим образом:                           #');
    console.log('# {                                                                  #');
    console.log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    console.log('#      "replaces": [ // Массив модулей с контролами                  #');
    console.log('#          "module": "Текущее имя модуля"                            #');
    console.log('#          "newModule": "Новое имя модуля. Лучше не использовать"    #');
    console.log('#          "controls": [// Массив с контролами                       #');
    console.log('#              "name": "Текущее имя контрола"                        #');
    console.log('#              "newName": "Новое имя контрола"                       #');
    console.log('#              "newModuleName": "Новое имя модуля"                   #');
    console.log('#          ]                                                         #');
    console.log('#      ]                                                             #');
    console.log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    console.log('# }                                                                  #');
    console.log('# newModule стоит использовать только в том случае, если             #');
    console.log('# перемещаются все контролы из модуля, иначе возможны ошибки         #');
    console.log('######################################################################');
}

function getScriptOptionParam() {
    console.log('######################################################################');
    console.log('# Для корректной замены опций укажите файл настроек                  #');
    console.log('# Файл должен выглядеть следующим образом:                           #');
    console.log('# {                                                                  #');
    console.log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    console.log('#      "replaces": [ // Массив модулей с контролами                  #');
    console.log('#          "module": "Имя модуля"                                    #');
    console.log('#          "control": "Имя контрола"                                 #');
    console.log('#          "thisOpt": "Текущее имя опции"                            #');
    console.log('#          "newOpt": "Новое имя опции"                               #');
    console.log('#      ]                                                             #');
    console.log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    console.log('# }                                                                  #');
    console.log('######################################################################');
}

function getScriptCustomParam() {
    console.log('######################################################################');
    console.log('# Для корректной замены укажите файл настроек                        #');
    console.log('# Файл должен выглядеть следующим образом:                           #');
    console.log('# {                                                                  #');
    console.log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    console.log('#      "replaces": [ // Массив модулей с контролами                  #');
    console.log('#          "reg": "Регулярное выражение для замены"                  #');
    console.log('#          "flag": "Флаг для регулярного выражения. По умолчанию g"  #');
    console.log('#          "replace": "То как произведется замена"                   #');
    console.log('#      ]                                                             #');
    console.log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    console.log('# }                                                                  #');
    console.log('######################################################################');
}

// console
const argv = process.argv;

if (argv[2]) {
    if (argv[2].indexOf('.json') !== -1) {
        // на всякий случай вдруг кто-то упоролся
        if (FileUtils.isFile(argv[2])) {
            const param = JSON.parse(FileUtils.fread(argv[2]));
            if (param.path) {
                script.run(param);
            } else {
                getScriptControlParam();
            }
        } else {
            console.error('Передан не корректный файл с конфигурацией');
        }
    } else {
        switch (argv[2]) {
            case 'replaceOpt':
            case 'customReplace':
                if (argv[3].indexOf('.json') !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param: IParam<IReplaceOpt | ICustomReplace> = JSON.parse(FileUtils.fread(argv[3]));
                        const type: TypeReplacer = argv[2] === 'replaceOpt' ? 'options' : 'custom'
                        if (param.path) {
                            script.run(param, type);
                        } else {
                            if (type === 'options') {
                                getScriptOptionParam();
                            } else {
                                getScriptCustomParam();
                            }
                        }
                    } else {
                        console.error('Передан не корректный файл с конфигурацией');
                    }
                }
                break;
            case 'resetGit':
                // на случай если скрипт по полной облажался
                if (argv[3]) {
                    const param = JSON.parse(FileUtils.fread(argv[3]));
                    if (param.path) {
                        console.log('=== start ===');
                        resetGit(param.path);
                        console.log('==== end ====');
                    } else {
                        console.error('Укажите свойство path в конфигурации');
                    }
                } else {
                    console.error('Укажите json файл для отката изменений. В файле должно присутствовать поле path');
                }
                break;
            default:
                getScriptParam();
        }
    }
} else {
    getScriptParam();
}
process.exitCode = 1;
