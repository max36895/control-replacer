#!/usr/bin/env node
'use strict';

const fs = require('fs');
let errors = [];
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

// ===== работа с папками и файлами
function isFile(file) {
    try {
        const stat = fs.lstatSync(file);
        return stat.isFile();
    } catch (e) {
        return false;
    }
}

function isDir(file) {
    try {
        const stat = fs.lstatSync(file);
        return stat.isDirectory()
    } catch (e) {
        return false;
    }
}

function mkDir(path) {
    fs.mkdirSync(path);
}

function fread(fileName) {
    return fs.readFileSync(fileName, 'utf-8');
}

function fwrite(fileName, fileContent, mode = 'w') {
    if (mode === 'w') {
        fs.writeFileSync(fileName, fileContent);
    } else {
        fs.appendFileSync(fileName, fileContent);
    }
}

function fileSize(path, prefix = 'bite') {
    const stat = fs.statSync(path);
    let size = stat.size;
    switch (prefix) {
        case 'kb':
            size /= KB;
            break;
        case 'mb':
            size /= MB;
            break;
        case 'gb':
            size /= GB;
            break;
    }
    return size;
}

function getDirs(path) {
    return fs.readdirSync(path);
}

// ===== работа с поиском и заменой вхождений
function getImportMath(moduleName, str) {
    const reg = new RegExp(`^import(\\n|[^('|")]+?)from ('|")${moduleName}('|");?$`, 'umg');
    return [...str.matchAll(reg)];
}

function importParse(str, controlName, moduleName) {
    // Если будет несколько экспортов из 1 либы в файле, то есть вероятность, что что-то может пойти не так
    let match = getImportMath(moduleName, str);

    if (match.length) {
        const paths = [];
        match.forEach((res) => {
            if (res[1]) {
                const value = res[1].replace(/(\n|}|{)/g, ' ');
                const names = value.split(',').map(val => val.trim());

                names.forEach((name) => {
                    const val = name.split(' ');
                    for (let i = 0; i < val.length; i++) {
                        const path = {
                            name: '',
                            control: '',
                            lib: '',
                            fullImport: res[0],
                            importNames: res[1],
                            importsList: names
                        };
                        if (val[i] === controlName) {
                            if (val[i + 1] === 'as') {
                                path.name = val[i + 2];
                                path.control = controlName;
                            } else {
                                if (val[i - 1] !== 'as') {
                                    path.name = controlName
                                    path.control = controlName;
                                }
                            }
                        } else if (val[i] === '*') {
                            // Если записали таким образом, то скорей всего хотят импортировать все
                            // но в таком случае может возникнуть проблема когда контрол превращается в модуль
                            if (val[i + 1] === 'as') {
                                path.control = controlName;
                                path.lib = val[i + 2];
                            }
                        }
                        if (path.name || path.lib || path.control) {
                            paths.push(path);
                        }
                    }
                })
            }
        });
        return paths;
    }
    return null
}

function addedInImport(str, match, importReplacer) {
    if (match.length) {
        let value = str;
        let updateImport = match[0][1].split(',');
        let startSeparator = '{';
        let endSeparator = '}';
        for (let i = 0; i < updateImport.length; i++) {
            if (updateImport[i].includes('{')) {
                startSeparator = '';
            }
            if (updateImport[i].includes('}')) {
                updateImport[i] = updateImport[i].replace('}', '');
            }
            updateImport[i] = updateImport[i].trim();
        }
        if (importReplacer.name === importReplacer.control) {
            updateImport.push(startSeparator + importReplacer.control + endSeparator);
        } else {
            updateImport.push(startSeparator + importReplacer.control + ' as ' + importReplacer.name + endSeparator);
        }
        return value.replace(match[0][1], ' ' + updateImport.join(', ') + ' ');
    }
    return str;
}

function replaceImport(str, importReplacer, config) {
    if (config.moduleName === config.newModuleName) {
        return str;
    }
    let value = str;
    const match = getImportMath(config.newModuleName, str);
    if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
        value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')),
            '\'' + (config.newModule || config.newModuleName) + '\'');
    } else {
        const imports = [];
        let startSeparator = ''
        let endSeparator = ''
        if (importReplacer.name) {
            importReplacer.importNames.split(',').forEach(imp => {
                if (!(new RegExp(`\\b${importReplacer.control}\\b`)).test(imp)) {
                    imports.push(imp);
                } else {
                    if (imp.includes('{')) {
                        startSeparator = ' {';
                    }
                    if (imp.includes('}')) {
                        endSeparator = '} ';
                    }
                }
            });
            value = value.replace(importReplacer.importNames, startSeparator + imports.join(', ') + endSeparator);

            if (match.length) {
                value = addedInImport(value, match, importReplacer);
            } else {
                let newImport = `\'${config.moduleName}\'`;
                if (config.controlName) {
                    newImport += `;\nimport {${importReplacer.control}${importReplacer.control !== importReplacer.name ? (' as ' + importReplacer.name) : ''}} from '${config.newModuleName}';`
                }
                value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')), newImport);

                value = value.replace(';;', ';');
            }
        } else {
            // хз как подобное править
            errors.push({
                fileName: config.thisContext,
                comment: `Используется страшный импорт(import * as ${importReplacer.lib} from \'${config.moduleName}\')! Не знаю как его правильно обработать!`,
                date: (new Date())
            });
        }
    }
    let emptyImportMatch = getImportMath(config.moduleName, value);
    if (emptyImportMatch.length) {
        const emptyValue = emptyImportMatch[0][1].replace(/\n/g, '').trim()
        if (emptyValue === '' || emptyValue === '{}') {
            value = value.replace(emptyImportMatch[0][0] + '\n', '');
        }
    }

    return value
}

function importReplacer(str, config) {
    const {controlName, newControlName, moduleName, newModuleName} = config;
    const importsReplacer = importParse(str, controlName, moduleName);
    if (importsReplacer) {
        let value = str;
        importsReplacer.forEach((importReplacer) => {
            let reg = (new RegExp(importReplacer.control));
            if (!importReplacer.name) {
                reg = (new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g'));
            }
            if (reg.test(str)) {
                value = replaceImport(value, importReplacer, {
                    controlName,
                    newControlName,
                    moduleName,
                    newModuleName
                })
                // Ищем именно в кавычках, иначе могут быть проблемы при замене в тексте + логично что все должно быть в них
                //value = value.replace((new RegExp('("|\')' + moduleName + '("|\')')), '\'' + newModuleName + '\'')
                if (importReplacer.name) {
                    if (newControlName) {
                        if (importReplacer.name === importReplacer.control) {
                            value = value.replace((new RegExp('\\b' + importReplacer.control + '\\b([^(/|\')])', 'g')), newControlName + '$1');
                            value = value.replace((new RegExp('\\b' + importReplacer.control + '\\b/>', 'g')), newControlName + '/>');
                        } else {
                            value = value.replace((new RegExp('\\b' + importReplacer.control + '\\b')), newControlName);
                        }
                    } else {
                        const reg = (new RegExp('\\b' + importReplacer.control + '\\b'));
                        if (importReplacer.name === importReplacer.control) {
                            // опасная хрень, но по другому наверное никак
                            value = value.replace(reg, ('default as ' + controlName));
                        } else {
                            value = value.replace(reg, ('default'));
                        }
                    }
                } else {
                    value = value.replace((new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g')), importReplacer.lib + '.' + newControlName)
                }
            }
        })
        return value;
    }
    return str;
}

function textReplacer(str, config) {
    const {controlName, newControlName, moduleName, newModuleName} = config;
    const path = moduleName.split('/');
    const newPath = newModuleName.split('/');
    let value = str;
    const separators = [
        {
            lib: '/',
            control: ':'
        },
        {
            lib: '/',
            control: '/'
        },
        {
            lib: '.',
            control: ':'
        },
        {
            lib: '.',
            control: '.'
        }
    ]
    let newName = newControlName;
    if (newName === '') {
        newName = newPath.at(-1);
        newPath.pop();
    }

    separators.forEach((separator) => {
        value = value.replace((new RegExp(path.join(separator.lib) + separator.control + controlName, 'g')),
            newPath.join(separator.lib) + (newControlName ? separator.control : separator.lib) + newName);
    });
    return value;
}

function replaceText(str, config) {
    let value = str;
    value = importReplacer(value, config);
    value = textReplacer(value, config);
    return value;
}

// ===== сам скрипт
function script(param, path) {
    const dirs = getDirs(path);
    dirs.forEach((dir) => {
        const newPath = path + '/' + dir;
        if (isDir(newPath)) {
            script(param, newPath)
        } else {
            const size = fileSize(newPath, 'mb')

            if (size < (param.maxFileSize)) {
                let fileContent = fread(newPath);
                let newFileContent = fileContent;
                param.replaces.forEach((replace) => {
                    const moduleName = replace.module;
                    replace.controls.forEach((control) => {
                        const controlName = control.name;
                        if (control.newName || control.newModuleName) {
                            let newControlName = control.newName;
                            if (typeof newControlName === 'undefined') {
                                newControlName = controlName;
                            }
                            let newModuleName = control.newModuleName;
                            if (typeof newModuleName === 'undefined') {
                                newModuleName = moduleName;
                            }
                            newFileContent = replaceText(newFileContent, {
                                controlName, newControlName,
                                moduleName, newModuleName,
                                newModule: param.newModule,
                                thisContext: newPath
                            });
                        }
                    })
                });
                if (fileContent !== newFileContent) {
                    fwrite(newPath, newFileContent);
                    console.log(`Обновляю файл ${newPath}`);
                } else {
                    let isUpdated = false;
                    param.replaces.forEach((replace) => {
                        if (fileContent.includes(replace.module)) {
                            isUpdated = true;
                        }
                    })
                    if (isUpdated) {
                        console.log(`В файле ${newPath}" найдены вхождения, но скрипт не смог их обработать!`);
                        errors.push({
                            fileName: newPath,
                            comment: 'Найдены вхождения, но скрипт не смог ничего сделать с ними',
                            date: (new Date())
                        });
                    } else {
                        //console.log(`- ${newPath} нечего править`);
                    }
                }
            } else {
                console.error(`Файл "${newPath}" слишком много весит(${size}MB). Пропускаю его!`);
                errors.push({
                    fileName: newPath,
                    comment: `Файл много весит(${size}MB). Для экономии ресурсов пропускаю его`,
                    date: (new Date())
                });
            }
        }
    });
}

// ===== подготовка данных и логирование
function getCorrectParam(param) {
    const correctParam = {};
    correctParam.path = param.path;
    correctParam.replaces = param.replaces;
    correctParam.maxFileSize = param.maxFileSize || 50;
    return correctParam;
}

function saveLog() {
    const errorDir = './errors'
    if (!isDir(errorDir)) {
        mkDir(errorDir);
    }
    let errorContent = '';
    errors.forEach(error => {
        errorContent += '\n===========================================================================';
        errorContent += '\n\tДата: ' + error.date;
        errorContent += '\n\tФайл: ' + error.fileName;
        errorContent += '\n\tОписание: ' + error.comment;
        errorContent += '\n===========================================================================\n';

    })
    fwrite((errorDir + '/' + 'logs.log'), errorContent, 'w');
    console.error(`При выполнении скрипта были обнаружены ошибки. Подробнее смотри в: ${errorDir}/logs.log`);
}

function run(param) {
    console.log('script start');
    console.log('=================================================================');
    errors = [];

    const correctParam = getCorrectParam(param);

    script(correctParam, param.path);
    if (errors.length) {
        saveLog();
    }
    console.log('=================================================================')
    console.log('script end');
}

// ===== помощь
function getScriptParam() {
    console.log();
    console.log('######################################################################');
    console.log('# Для корректной работы скрипта укажите файл настроек                #');
    console.log('# Файл должен выглядеть следующим образом:                           #');
    console.log('# {                                                                  #');
    console.log('#      "path": "Путь к репозиторям, где нужно выполнить замену"      #');
    console.log('#      "replaces": [ // Массив модулей с контролами                  #');
    console.log('#          "module": "Текущее имя модуля"                            #');
    console.log('#          "newModule": "Новое имя модуля. Лучше не использовать"    #');
    console.log('#          "controls": [// Массив с контролами                       #');
    console.log('#              "name": "Новое имя контрола"                          #');
    console.log('#              "newName": "Новое имя контрола"                       #');
    console.log('#              "newModuleName": "Новое имя модуля"                   #');
    console.log('#          ]                                                         #');
    console.log('#      ]                                                             #');
    console.log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    console.log('# }                                                                  #');
    console.log('# newModule стоит использовать только в том случае, если             #');
    console.log('# перемещаются все контролы из модуля, иначе возможны ошибки         #');
    console.log('######################################################################');
    console.log('---Пример---');
    const exampleParam = {
        "path": ".\\test",
        "replaces": [
            {
                "module": "Controls/toggle",
                "controls": [
                    {
                        "name": "Tumbler",
                        "newName": "",
                        "newModuleName": "Controls/Tumbler"
                    },
                    {
                        "name": "BigSeparator",
                        "newName": "MoreButton"
                    }
                ]
            }
        ]
    };
    console.log(JSON.stringify(exampleParam, undefined, '  '));
    console.log();
}

// для тестов сделать нормально когда-то
function test(params) {
    param = getCorrectParam(params);
    const tests = [
        {
            start: `import {Toggle} from 'Controls/toggle'`,
            end: `import {default as Toggle} from 'Controls/Toggle'`
        },
        {
            start: `import {Toggle} from 'Controls/toggle';
            return <Toggle></Toggle>`,
            end: `import {default as Toggle} from 'Controls/Toggle';
            return <Toggle></Toggle>`
        },
        {
            start: `import {BigSeparator} from 'Controls/toggle'`,
            end: `import {MoreButton} from 'Controls/toggle'`
        },
        {
            start: `import {BigSeparator} from 'Controls/toggle';
            return <BigSeparator></BigSeparator>`,
            end: `import {MoreButton} from 'Controls/toggle';
            return <MoreButton></MoreButton>`
        },
        {
            start: `import {Toggle,BigSeparator} from 'Controls/toggle'`,
            end: `import {MoreButton} from 'Controls/toggle';\nimport {default as Toggle} from 'Controls/Toggle';`
        },
        {
            start: `import {Toggle,BigSeparator} from 'Controls/toggle';
            return <BigSeparator></BigSeparator>`,
            end: `import {MoreButton} from 'Controls/toggle';
import {default as Toggle} from 'Controls/Toggle';
            return <MoreButton></MoreButton>`
        },
        {
            start: `import {Toggle,BigSeparator} from 'Controls/toggle';
import {Test} from 'Controls/Toggle';
            return <BigSeparator></BigSeparator>`,
            end: `import {MoreButton} from 'Controls/toggle';
import {Test, default as Toggle} from 'Controls/Toggle';
            return <MoreButton></MoreButton>`
        },
        {
            start: `import {BigSeparator as Test} from 'Controls/toggle';
            return <Test></Test><BigSeparator>`,
            end: `import {MoreButton as Test} from 'Controls/toggle';
            return <Test></Test><BigSeparator>`
        },
        {
            start: `import * as toggle from 'Controls/toggle';
            return <Test></Test><toggle.BigSeparator>`,
            end: `import * as toggle from 'Controls/toggle';
            return <Test></Test><toggle.MoreButton>`
        },
        {
            start: `import {Tumbler} from 'Controls/toggle';
            return <Tumbler></Tumbler>`,
            end: `import {View} from 'Controls/Tumbler';
            return <View></View>`
        },
        {
            start: `import {Toggle,Tumbler} from 'Controls/toggle'`,
            end: `import {View} from 'Controls/Tumbler';\nimport {default as Toggle} from 'Controls/Toggle';`
        },
        {
            start: `import {Toggle,Tumbler} from 'Controls/toggle';
            return <Toggle/><Tumbler></Tumbler><Toggle></Toggle><Tumbler/><Tumbler {...props}/>`,
            end: `import {View} from 'Controls/Tumbler';\nimport {default as Toggle} from 'Controls/Toggle';
            return <Toggle/><View></View><Toggle></Toggle><View/><View {...props}/>`
        },
        {
            start: 'Controls.toggle:Tumbler',
            end: 'Controls.Tumbler:View',
        },
        {
            start: 'Controls.toggle:Toggle',
            end: 'Controls.Toggle',
        },
        {
            start: 'Controls/toggle:Toggle',
            end: 'Controls/Toggle',
        },
        {
            start: 'Controls.toggle:BigSeparator <ws:partial template="Controls/toggle:Toggle">',
            end: 'Controls.toggle:MoreButton <ws:partial template="Controls/Toggle">',
        }
    ];
    tests.forEach((test) => {
        let content = test.start;
        param.replaces.forEach((replace) => {
            const moduleName = replace.module;
            replace.controls.forEach((control) => {
                const controlName = control.name;
                if (control.newName || control.newModuleName) {
                    let newControlName = control.newName;
                    if (typeof newControlName === 'undefined') {
                        newControlName = controlName;
                    }
                    let newModuleName = control.newModuleName;
                    if (typeof newModuleName === 'undefined') {
                        newModuleName = moduleName;
                    }
                    content = replaceText(content, {
                        controlName, newControlName,
                        moduleName, newModuleName,
                        newModule: param.newModule
                    });
                }
            });
        });
        if (content === test.end) {
            console.log('ok');
        } else {
            console.log('');
            console.log(content);
            console.log(test.end);
            console.log('');
        }
    })

}

const argv = process.argv;

let param = {};
if (argv[2]) {
    if (argv[2].indexOf('.json') !== -1) {
        // на всякий случай вдруг кто-то упоролся
        if (isFile(argv[2])) {
            param = JSON.parse(fread(argv[2]));
            if (param.path) {
                if (argv[3] !== 'test') {
                    run(param);
                } else {
                    test(param);
                }
            } else {
                getScriptParam();
            }
        } else {
            console.error('Передан не корректный файл с конфигурацией');
        }
    } else {
        console.error('Укажите json файл с конфигурацией');
        getScriptParam();
    }
} else {
    getScriptParam();
}
process.exitCode = 1;
