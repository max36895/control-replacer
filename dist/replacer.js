'use strict';

var childProcess = require('child_process');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var childProcess__namespace = /*#__PURE__*/_interopNamespaceDefault(childProcess);

const fs = require('fs');
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;
class FileUtils {
    static isFile(file) {
        try {
            const stat = fs.lstatSync(file);
            return stat.isFile();
        }
        catch (e) {
            return false;
        }
    }
    static isDir(file) {
        try {
            const stat = fs.lstatSync(file);
            return stat.isDirectory();
        }
        catch (e) {
            return false;
        }
    }
    static mkDir(path) {
        fs.mkdirSync(path);
    }
    static fread(fileName) {
        return fs.readFileSync(fileName, 'utf-8');
    }
    static fwrite(fileName, fileContent, mode = 'w') {
        if (mode === 'w') {
            fs.writeFileSync(fileName, fileContent);
        }
        else {
            fs.appendFileSync(fileName, fileContent);
        }
    }
    static fileSize(path, prefix = 'bite') {
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
    static getDirs(path) {
        return fs.readdirSync(path);
    }
}

const SEPARATORS = [
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
];
class Replacer {
    errors = [];
    static getImportMath(moduleName, str) {
        const reg = new RegExp(`^import(\\n|[^('|")]+?)from ('|")${moduleName}('|");?$`, 'umg');
        return [...str.matchAll(reg)];
    }
    importParse(str, controlName, moduleName) {
        const match = Replacer.getImportMath(moduleName, str);
        if (match.length) {
            const paths = [];
            match.forEach((res) => {
                if (res[1]) {
                    const value = res[1].replace(/(\n|}|{)/g, ' ');
                    const names = value.split(',').map((val) => val.trim());
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
                                }
                                else {
                                    if (val[i - 1] !== 'as') {
                                        path.name = controlName;
                                        path.control = controlName;
                                    }
                                }
                            }
                            else if (val[i] === '*') {
                                if (val[i + 1] === 'as') {
                                    path.control = controlName;
                                    path.lib = val[i + 2];
                                }
                            }
                            if (path.name || path.lib || path.control) {
                                paths.push(path);
                            }
                        }
                    });
                }
            });
            return paths;
        }
        return null;
    }
    static addedInImport(str, match, importReplacer) {
        if (match.length) {
            let value = str;
            const updateImport = match[0][1].split(',');
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
            }
            else {
                updateImport.push(startSeparator + importReplacer.control + ' as ' + importReplacer.name + endSeparator);
            }
            return value.replace(match[0][1], ' ' + updateImport.join(', ') + ' ');
        }
        return str;
    }
    replaceImport(str, importReplacer, config) {
        if (config.moduleName === config.newModuleName) {
            return str;
        }
        let value = str;
        const match = Replacer.getImportMath(config.newModuleName, str);
        if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
            value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')), '\'' + (config.newModule || config.newModuleName) + '\'');
        }
        else {
            const imports = [];
            let startSeparator = '';
            let endSeparator = '';
            if (importReplacer.name) {
                importReplacer.importNames.split(',').forEach(imp => {
                    if (!(new RegExp(`\\b${importReplacer.control}\\b`)).test(imp)) {
                        imports.push(imp);
                    }
                    else {
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
                    value = Replacer.addedInImport(value, match, importReplacer);
                }
                else {
                    let newImport = `\'${config.moduleName}\'`;
                    if (config.controlName) {
                        newImport += `;\nimport {${importReplacer.control}${importReplacer.control !== importReplacer.name ? (' as ' + importReplacer.name) : ''}} from '${config.newModuleName}';`;
                    }
                    value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')), newImport);
                    value = value.replace(';;', ';');
                }
            }
            else {
                this.errors.push({
                    fileName: config.thisContext,
                    comment: `Используется страшный импорт(import * as ${importReplacer.lib} from \'${config.moduleName}\')! Не знаю как его правильно обработать!`,
                    date: (new Date())
                });
            }
        }
        let emptyImportMatch = Replacer.getImportMath(config.moduleName, value);
        if (emptyImportMatch.length) {
            const emptyValue = emptyImportMatch[0][1].replace(/\n/g, '').trim();
            if (emptyValue === '' || emptyValue === '{}') {
                value = value.replace(emptyImportMatch[0][0] + '\n', '');
            }
        }
        return value;
    }
    importReplacer(str, config) {
        const { controlName, newControlName, moduleName } = config;
        const importsReplacer = this.importParse(str, controlName, moduleName);
        if (importsReplacer) {
            let value = str;
            importsReplacer.forEach((importReplacer) => {
                let reg = (new RegExp(importReplacer.control));
                if (!importReplacer.name) {
                    reg = (new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g'));
                }
                if (reg.test(str)) {
                    value = this.replaceImport(value, importReplacer, config);
                    if (importReplacer.name) {
                        if (newControlName) {
                            if (importReplacer.name === importReplacer.control) {
                                value = value.replace((new RegExp('\\b' + importReplacer.control + '\\b([^(/|\'|\")])', 'g')), newControlName + '$1');
                                value = value.replace((new RegExp('\\b' + importReplacer.control + '\\b/>', 'g')), newControlName + '/>');
                            }
                            else {
                                value = value.replace((new RegExp('([^(\.|/|:)])\\b' + importReplacer.control + '\\b([^(\.|/|:)])')), '$1' + newControlName + '$2');
                            }
                        }
                        else {
                            const reg = (new RegExp('\\b' + importReplacer.control + '\\b'));
                            if (importReplacer.name === importReplacer.control) {
                                value = value.replace(reg, ('default as ' + controlName));
                            }
                            else {
                                value = value.replace(reg, ('default'));
                            }
                        }
                    }
                    else {
                        value = value.replace((new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g')), importReplacer.lib + '.' + newControlName);
                    }
                }
            });
            return value;
        }
        return str;
    }
    textReplacer(str, config) {
        const { controlName, newControlName, moduleName, newModuleName } = config;
        const path = moduleName.split('/');
        const newPath = newModuleName.split('/');
        let value = str;
        let newName = newControlName;
        if (newName === '') {
            newName = newPath.at(-1);
            newPath.pop();
        }
        SEPARATORS.forEach((separator) => {
            value = value.replace((new RegExp(path.join(separator.lib) + separator.control + controlName, 'g')), newPath.join(separator.lib) + (newControlName ? separator.control : separator.lib) + newName);
        });
        return value;
    }
    replaceControls(str, config) {
        let value = str;
        value = this.importReplacer(value, config);
        value = this.textReplacer(value, config);
        return value;
    }
    replaceOptions(str, config) {
        let value = str;
        const importsReplacer = this.importParse(str, config.control, config.module);
        if (importsReplacer) {
            importsReplacer.forEach(importReplacer => {
                if (importReplacer.name) {
                    value = value.replace((new RegExp('(<\\b' + importReplacer.name + '\\b(?:\\n|[^>])+?)\\b'
                        + config.thisOpt + '\\b((?:\\n|[^>])+?>)', 'g')), '$1' + config.newOpt + '$2');
                }
                else {
                    value = value.replace((new RegExp('(<' + importReplacer.lib + '.' + importReplacer.control +
                        '\\b(?:\\n|[^>])+?)\\b' + config.thisOpt + '\\b((?:\\n|[^>])+?>)')), '$1' + config.newOpt + '$2');
                }
            });
        }
        const path = config.module.split('/');
        SEPARATORS.forEach((separator) => {
            value = value.replace((new RegExp(('(' + path.join(separator.lib) + separator.control + config.control + '\\b(?:\\n|[^>])+?)\\b'
                + config.thisOpt + '\\b((?:\\n|[^>])+?>)'), 'g')), '$1' + config.newOpt + '$2');
        });
        return value;
    }
    customReplace(str, config) {
        return str.replace((new RegExp(config.reg, config.flag || 'g')), config.replace);
    }
    clearErrors() {
        this.errors = [];
    }
    getErrors() {
        return this.errors;
    }
}

const EXCLUDE_DIRS = ['node_modules', '.git', '.idea', 'build-ui', 'wasaby-cli_artifacts'];
class Script {
    replacer = new Replacer;
    errors = [];
    _controlsReplace(replace, newFileContent, newPath) {
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
                newModuleName = replace.newModule || newModuleName;
                newFileContent = this.replacer.replaceControls(newFileContent, {
                    controlName, newControlName,
                    moduleName, newModuleName,
                    newModule: replace.newModule,
                    thisContext: newPath
                });
            }
        });
        return newFileContent;
    }
    _optionsReplace(replace, newFileContent) {
        return this.replacer.replaceOptions(newFileContent, replace);
    }
    script(param, path, type = 'controls') {
        const dirs = FileUtils.getDirs(path);
        dirs.forEach((dir) => {
            const newPath = path + '/' + dir;
            if (EXCLUDE_DIRS.includes(dir)) {
                return;
            }
            if (FileUtils.isDir(newPath)) {
                this.script(param, newPath);
            }
            else {
                try {
                    const size = FileUtils.fileSize(newPath, 'mb');
                    if (size < param.maxFileSize) {
                        const fileContent = FileUtils.fread(newPath);
                        let newFileContent = fileContent;
                        param.replaces.forEach((replace) => {
                            if (type === "controls") {
                                newFileContent = this._controlsReplace(replace, newFileContent, newPath);
                            }
                            else if (type === 'options') {
                                newFileContent = this._optionsReplace(replace, newFileContent);
                            }
                            else if (type === 'custom') {
                                newFileContent = this.replacer.customReplace(newFileContent, replace);
                            }
                        });
                        if (fileContent !== newFileContent) {
                            console.log(`Обновляю файл ${newPath}`);
                            FileUtils.fwrite(newPath, newFileContent);
                        }
                        else {
                            if (type === "controls") {
                                let searchedModule = '';
                                param.replaces.forEach((replace) => {
                                    if (fileContent.includes(replace.module)) {
                                        searchedModule = replace.module;
                                    }
                                });
                                if (searchedModule) {
                                    console.log(`В файле "${newPath}" найдены вхождения этого модуля "${searchedModule}", но скрипт не смог их обработать`);
                                    this.errors.push({
                                        fileName: newPath,
                                        comment: 'Найдены вхождения для модуля "' + searchedModule + '", но скрипт не смог ничего сделать с ними. Возможно можно проигнорировать это предупреждение',
                                        date: (new Date())
                                    });
                                }
                                else {
                                }
                            }
                        }
                    }
                    else {
                        console.error(`Файл "${newPath}" много весит(${size}MB). Пропускаю его!`);
                        this.errors.push({
                            fileName: newPath,
                            comment: `Файл много весит(${size}MB).`,
                            date: (new Date())
                        });
                    }
                }
                catch (e) {
                    this.errors.push({
                        date: (new Date()),
                        fileName: newPath,
                        comment: e.message
                    });
                }
            }
        });
    }
    saveLog() {
        const errorDir = './errors';
        if (!FileUtils.isDir(errorDir)) {
            FileUtils.mkDir(errorDir);
        }
        let errorContent = '';
        this.errors.forEach(error => {
            errorContent += '\n===========================================================================';
            errorContent += '\n\tДата: ' + error.date;
            errorContent += '\n\tФайл: ' + error.fileName;
            errorContent += '\n\tОписание: ' + error.comment;
            errorContent += '\n===========================================================================\n';
        });
        FileUtils.fwrite((errorDir + '/' + 'logs.log'), errorContent, 'w');
        console.error(`При выполнении скрипта были обнаружены ошибки. Подробнее смотри в: ${errorDir}/logs.log`);
    }
    run(param, type = 'controls') {
        console.log('script start');
        console.log('=================================================================');
        this.errors = [];
        this.replacer.clearErrors();
        const correctParam = Script.getCorrectParam(param);
        this.script(correctParam, param.path, type);
        this.errors = [...this.errors, ...this.replacer.getErrors()];
        if (this.errors.length) {
            this.saveLog();
        }
        console.log('=================================================================');
        console.log('script end');
    }
    static getCorrectParam(param) {
        const correctParam = {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize || 50
        };
        return correctParam;
    }
}

const REP_FILES = ['README.md', 'package.json', '.gitignore'];
function resetGit(path) {
    const dirs = FileUtils.getDirs(path);
    let isRep = false;
    dirs.forEach(dir => {
        if (REP_FILES.includes(dir)) {
            isRep = true;
        }
    });
    if (isRep) {
        childProcess__namespace.execSync(`cd ${path} && git reset --hard`);
        return;
    }
    else {
        dirs.forEach((dir) => {
            const newPath = path + '/' + dir;
            if (EXCLUDE_DIRS.includes(dir)) {
                return;
            }
            if (FileUtils.isDir(newPath)) {
                resetGit(newPath);
            }
        });
    }
}

const script = new Script();
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
const argv = process.argv;
if (argv[2]) {
    if (argv[2].indexOf('.json') !== -1) {
        if (FileUtils.isFile(argv[2])) {
            const param = JSON.parse(FileUtils.fread(argv[2]));
            if (param.path) {
                script.run(param);
            }
            else {
                getScriptControlParam();
            }
        }
        else {
            console.error('Передан не корректный файл с конфигурацией');
        }
    }
    else {
        switch (argv[2]) {
            case 'replaceOpt':
            case 'customReplace':
                if (argv[3].indexOf('.json') !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param = JSON.parse(FileUtils.fread(argv[3]));
                        const type = argv[2] === 'replaceOpt' ? 'options' : 'custom';
                        if (param.path) {
                            script.run(param, type);
                        }
                        else {
                            if (type === 'options') {
                                getScriptOptionParam();
                            }
                            else {
                                getScriptCustomParam();
                            }
                        }
                    }
                    else {
                        console.error('Передан не корректный файл с конфигурацией');
                    }
                }
                break;
            case 'resetGit':
                const param = JSON.parse(FileUtils.fread(argv[3]));
                if (param.path) {
                    console.log('=== start ===');
                    resetGit(param.path);
                    console.log('==== end ====');
                }
                else {
                    console.error('Укажите json файл для отката изменений. В файле должно присутствовать поле path');
                }
                break;
            default:
                console.error('Укажите json файл с конфигурацией');
                getScriptParam();
        }
    }
}
else {
    getScriptParam();
}
process.exitCode = 1;
