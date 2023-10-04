#!/usr/bin/env node
import { ICustomReplace, IParam, IReplaceOpt } from './interfaces/IConfig';
import { Script, TypeReplacer } from './modules/Script';
import { FileUtils } from './modules/FileUtils';
import { error, log } from './modules/logger';
import { resetGit } from './modules/Reset';

const script = new Script();

function getScriptParam() {
    log('');
    log('Скрипт предназначен для автоматического переименовывание контролов и их опций.')
    log('Также предусмотрена возможность указать свое регулярное выражения для замены.');
    log('Поддерживаемые опции:');
    log('\t- config.json - переименовывание контролов или модулей');
    log('\t- replaceOpt config.json - переименовывание опций у контролов');
    log('\t- cssReplace config.json - переименовывание css переменных или классов');
    log('\t- customReplace config.json - кастомная замена');
    log('\t- resetGit - откатывает изменения. Стоит использовать в том случае, если скрипт отработал ошибочно.');
    log('');
}

function getScriptControlParam() {
    log('######################################################################');
    log('# Для корректной замены контролов укажите файл настроек              #');
    log('# Файл должен выглядеть следующим образом:                           #');
    log('# {                                                                  #');
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "module": "Текущее имя модуля"                            #');
    log('#          "newModule": "Новое имя модуля. Лучше не использовать"    #');
    log('#          "controls": [// Массив с контролами                       #');
    log('#              "name": "Текущее имя контрола"                        #');
    log('#              "newName": "Новое имя контрола"                       #');
    log('#              "newModuleName": "Новое имя модуля"                   #');
    log('#          ]                                                         #');
    log('#      ]                                                             #');
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log('# }                                                                  #');
    log('# newModule стоит использовать только в том случае, если             #');
    log('# перемещаются все контролы из модуля, иначе возможны ошибки         #');
    log('######################################################################');
}

function getScriptOptionParam() {
    log('######################################################################');
    log('# Для корректной замены опций укажите файл настроек                  #');
    log('# Файл должен выглядеть следующим образом:                           #');
    log('# {                                                                  #');
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "module": "Имя модуля"                                    #');
    log('#          "control": "Имя контрола"                                 #');
    log('#          "thisOpt": "Текущее имя опции"                            #');
    log('#          "newOpt": "Новое имя опции"                               #');
    log('#      ]                                                             #');
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log('# }                                                                  #');
    log('######################################################################');
}

function getScriptCSSParam() {
    log('######################################################################');
    log('# Для корректной замены опций укажите файл настроек                  #');
    log('# Файл должен выглядеть следующим образом:                           #');
    log('# {                                                                  #');
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "varName": "Текущее имя переменной или класса"            #');
    log('#          "newVarName": "Новое имя переменной или класса"           #');
    log('#          "isRemove": "Класс или переменная полностью удаляется"    #');
    log('#      ]                                                             #');
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log('# }                                                                  #');
    log('######################################################################');
}

function getScriptCustomParam() {
    log('######################################################################');
    log('# Для корректной замены укажите файл настроек                        #');
    log('# Файл должен выглядеть следующим образом:                           #');
    log('# {                                                                  #');
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "reg": "Регулярное выражение для замены"                  #');
    log('#          "flag": "Флаг для регулярного выражения. По умолчанию g"  #');
    log('#          "replace": "То как производится замена"                   #');
    log('#      ]                                                             #');
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log('# }                                                                  #');
    log('######################################################################');
}

const argv = process.argv;

function getType(value: string): TypeReplacer {
    if (value === 'replaceOpt') {
        return TypeReplacer.Options;
    } else if (value === 'customReplace') {
        return TypeReplacer.Custom;
    }
    return TypeReplacer.Css;
}

if (argv[2]) {
    if (argv[2].indexOf('.json') !== -1) {
        if (FileUtils.isFile(argv[2])) {
            const param = JSON.parse(FileUtils.read(argv[2]));
            if (param.path) {
                script.run(param);
            } else {
                getScriptControlParam();
            }
        } else {
            error(`Не удалось найти файл "${argv[2]}"`);
        }
    } else {
        switch (argv[2]) {
            case 'replaceOpt':
            case 'customReplace':
            case 'cssReplace':
                if (argv[3].indexOf('.json') !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param: IParam<IReplaceOpt | ICustomReplace> = JSON.parse(FileUtils.read(argv[3]));
                        const type: TypeReplacer = getType(argv[2]);
                        if (param.path) {
                            script.run(param, type);
                        } else {
                            switch (type) {
                                case TypeReplacer.Options:
                                    getScriptOptionParam();
                                    break;
                                case TypeReplacer.Custom:
                                    getScriptCustomParam();
                                    break;
                                case TypeReplacer.Css:
                                    getScriptCSSParam();
                                    break;
                            }
                        }
                    } else {
                        error(`Не удалось найти файл "${argv[3]}"`);
                    }
                } else {
                    error('Не передан файл с конфигурацией');
                }
                break;
            case 'resetGit':
                // на случай если скрипт по полной облажался
                if (argv[3].indexOf('.json') !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param = JSON.parse(FileUtils.read(argv[3]));
                        if (param.path) {
                            log('=== start ===');
                            resetGit(param.path);
                            log('==== end ====');
                        } else {
                            error('Укажите свойство path в конфигурации');
                        }
                    } else {
                        error(`Не удалось найти файл "${argv[3]}"`);
                    }
                } else {
                    error('Не передан файл с конфигурацией');
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
