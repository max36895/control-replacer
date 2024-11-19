#!/usr/bin/env node
import {
    ICSSReplace,
    ICustomReplace,
    IParam,
    IPath,
    IReplace,
    IReplaceOpt,
} from './interfaces/IConfig';
import { Script, TypeReplacer } from './modules/Script';
import { FileUtils } from './utils/FileUtils';
import { error, log } from './modules/logger';
import { resetGit } from './modules/Reset';
import { fixCommit } from './modules/FixCommit';

enum TYPE {
    OPTION = 'replaceOpt',
    CUSTOM = 'customReplace',
    CSS = 'cssReplace',
    RESET_GIT = 'resetGit',
    FIX_COMMIT = 'fixCommit',
    FIND = 'find',
}

const DEFAULT_LINE_LENGTH = 70;

const script = new Script();

function getScriptParam() {
    log('');
    log('Скрипт предназначен для автоматического переименовывание контролов и их опций.');
    log('Также есть возможность указать свою настройку для замены.');
    log('Поддерживаемые параметры:');
    log('\t- config.json - переименовывание контролов или модулей');
    log(`\t- ${TYPE.OPTION} config.json - переименовывание опций`);
    log(`\t- ${TYPE.CSS} config.json - переименовывание css переменных и классов`);
    log(`\t- ${TYPE.CUSTOM} config.json - кастомная замена`);
    log(
        `\t- ${TYPE.RESET_GIT} - откатывает изменения. Стоит использовать в том случае, если скрипт отработал ошибочно.`,
    );
    log(
        `\t- ${TYPE.FIX_COMMIT} - откатывает коммит оставляя правки. Стоит использовать когда нужно повторно запустить скрипт для создания mr.`,
    );
    log('');
}

function showLine(str: string, maxLength: number = DEFAULT_LINE_LENGTH) {
    const repeat = maxLength - str.length - 3;
    if (repeat < 0) {
        const res = [''];
        let index = 0;
        str.split(' ').forEach((aStr) => {
            if (res[index].length + aStr.length + 3 > maxLength) {
                res[index] = res[index].trim();
                index++;
                res[index] = res[index] ?? '';
            }
            res[index] += `${aStr} `;
        });
        showMultiline(res, '', '');
    } else {
        log(`# ${str}` + ' '.repeat(repeat) + '#');
    }
}

function showMultiline(str: (string | string[])[], prefix = '    ', defaultStep = '    ') {
    str.forEach((s) => {
        if (typeof s === 'object') {
            showMultiline(s, prefix + defaultStep);
        } else {
            showLine(prefix + s);
        }
    });
}

function showConfigInfo(title: string, body: (string | string[])[], footer?: string) {
    const separator = '#'.repeat(DEFAULT_LINE_LENGTH);
    log(separator);
    showLine(title);
    showLine('Конфигурация файла выглядит следующим образом:');
    showLine('{');
    showLine('    "path": "Путь к репозиториям, где нужно выполнить замену"');
    showLine('    "replaces": [ // Массив с настройкой для замены');
    showMultiline(body, ' '.repeat(7));
    showLine('    ]');
    showLine('    "maxFileSize": "Максимальный размер файла. По умолчанию 50mb"');
    showLine('}');
    if (footer) {
        showLine(footer);
    }
    log(separator);
}

function getScriptControlParam() {
    showConfigInfo(
        'Перенос/переименовывание контролов и утилит',
        [
            '"module": "Текущее имя модуля"',
            '"newModule": "Новое имя модуля. Лучше не использовать"',
            '"controls": [// Массив с контролами/утилитами',
            [
                '"name": "Текущее имя контрола"',
                '"newName": "Новое имя контрола"',
                '"newModuleName": "Новое имя модуля"',
            ],
        ],
        'newModule стоит использовать только в том случае, если перемещаются все контролы из модуля, иначе возможны ошибки',
    );
}

function getScriptOptionParam() {
    showConfigInfo('Переименовывание опций для контрола', [
        '"module": "Имя модуля"',
        '"control": "Имя контрола"',
        '"thisOpt": "Текущее имя опции"',
        '"newOpt": "Новое имя опции"',
    ]);
}

function getScriptCSSParam() {
    showConfigInfo('Переименовывание css классов/переменных', [
        '"varName": "Текущее имя css переменной или класса"',
        '"newVarName": "Новое имя css переменной или класса"',
        '"isRemove": "CSS класс или переменная полностью удаляется"',
    ]);
}

function getScriptCustomParam() {
    showConfigInfo(
        'Пользовательская замена',
        [
            '"reg": "Регулярное выражение для замены"',
            '"flag": "Флаг для регулярного выражения. По умолчанию g"',
            '"replace": "То как производится замена"',
            '"scriptPath": "Путь до пользовательского скрипта"',
        ],
        'Обязательно должно быть передано "scriptPath", либо "reg" и "replace", если передать все свойства, то запуститься пользовательский скрипт, регулярное выражение будет проигнорировано',
    );
}

const argv = process.argv;

function getType(value: string): TypeReplacer {
    if (value === TYPE.OPTION) {
        return TypeReplacer.Options;
    } else if (value === TYPE.CUSTOM) {
        return TypeReplacer.Custom;
    } else if (value === TYPE.FIND) {
        return TypeReplacer.Find;
    }
    return TypeReplacer.Css;
}

function startScript<TParam>(configFile: string, cb: (param: TParam) => void) {
    if (configFile.indexOf('.json') !== -1) {
        if (FileUtils.isFile(configFile)) {
            const param: TParam = JSON.parse(FileUtils.read(configFile));
            cb(param);
        } else {
            error(`Не удалось найти файл "${configFile}"`);
        }
    } else {
        error('Не передан файл с конфигурацией');
    }
}

if (argv[2]) {
    if (argv[2].indexOf('.json') !== -1) {
        startScript<IParam<IReplace>>(argv[2], async (param) => {
            if (param.path) {
                await script.run(param);
            } else {
                getScriptControlParam();
            }
        });
    } else {
        switch (argv[2]) {
            case TYPE.OPTION:
            case TYPE.CUSTOM:
            case TYPE.CSS:
            case TYPE.FIND:
                startScript<IParam<IReplaceOpt | ICustomReplace | ICSSReplace>>(
                    argv[3],
                    async (param) => {
                        const type: TypeReplacer = getType(argv[2]);
                        if (param.path) {
                            await script.run(param, type);
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
                    },
                );
                break;
            case TYPE.RESET_GIT:
                // на случай если скрипт по полной облажался
                startScript<IPath>(argv[3], (param) => {
                    if (param.path) {
                        log('=== start ===');
                        resetGit(param.path);
                        log('=== end ===');
                    } else {
                        error('Укажите свойство path в конфигурации');
                    }
                });
                break;
            case TYPE.FIX_COMMIT:
                startScript<IPath>(argv[3], (param) => {
                    if (param.path) {
                        log('=== start ===');
                        fixCommit(param.path);
                        log('Можно перезапускать скрипт для создания mr');
                        log('=== end ===');
                    } else {
                        error('Укажите свойство path в конфигурации');
                    }
                });
                break;
            default:
                getScriptParam();
        }
    }
} else {
    getScriptParam();
}
process.exitCode = 1;
