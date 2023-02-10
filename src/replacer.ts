#!/usr/bin/env node
import {Script} from './modules/Script';
import {FileUtils} from './modules/FileUtils';
import {resetGit} from "./modules/Reset";

const script = new Script();

// ===== помощь
function getScriptParam() {
    console.log();
    console.log('######################################################################');
    console.log('# Для корректной работы скрипта укажите файл настроек                #');
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
    console.log();
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
                getScriptParam();
            }
        } else {
            console.error('Передан не корректный файл с конфигурацией');
        }
    } else if (argv[2] === 'resetGit') {
        // на случай если скрипт по полной облажался
        const param = JSON.parse(FileUtils.fread(argv[3]));
        if (param.path) {
            console.log('=== start ===');
            resetGit(param.path);
            console.log('==== end ====');
        } else {
            console.error('Укажите json файл для отката изменений. В файле должно присутствовать поле path');
        }
    } else {
        console.error('Укажите json файл с конфигурацией');
        getScriptParam();
    }
} else {
    getScriptParam();
}
process.exitCode = 1;
