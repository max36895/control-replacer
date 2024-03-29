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

function log(str) {
    console.log(str);
}
function success(str) {
    console.log('\x1b[32m', str, '\x1b[0m');
}
function warning(str) {
    console.log('\x1b[33m', str, '\x1b[0m');
}
function error(str) {
    console.log('\x1b[31m', str, '\x1b[0m');
}

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
    static read(fileName) {
        return fs.readFileSync(fileName, 'utf-8');
    }
    static write(fileName, fileContent, mode = 'w') {
        if (mode === 'w') {
            fs.writeFileSync(fileName, fileContent);
        }
        else {
            fs.appendFileSync(fileName, fileContent);
        }
    }
    static fileSize(path, prefix = 'mb') {
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
        control: ':',
    },
    {
        lib: '/',
        control: '/',
    },
    {
        lib: '.',
        control: ':',
    },
    {
        lib: '.',
        control: '.',
    },
];
class Replacer {
    errors = [];
    static getImportMatch(moduleName, str) {
        return [
            ...str.matchAll(new RegExp(`^import(\\n|[^('|")]+?)from ['|"]${moduleName}['|"];?$`, 'umg')),
        ];
    }
    static addedInImport(str, match, importReplacer) {
        if (match.length) {
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
                updateImport.push(`${startSeparator}${importReplacer.control} as ${importReplacer.name}${endSeparator}`);
            }
            return str.replace(match[0][1], ` ${updateImport.join(', ')} `);
        }
        return str;
    }
    replaceControls(str, config) {
        return this.textReplacer(this.importReplacer(str, config), config);
    }
    replaceOptions(str, config) {
        const importsReplacer = this.importParse(str, config.control, config.module);
        const beforeReg = '\\b(?:\\n|[^>])+?)\\b';
        const afterReg = '\\b((?:\\n|[^>])+?>)';
        if (importsReplacer) {
            importsReplacer.forEach((importReplacer) => {
                if (importReplacer.name) {
                    str = str.replace(new RegExp('(<\\b' + importReplacer.name + beforeReg + config.thisOpt + afterReg, 'g'), `$1${config.newOpt}$2`);
                }
                else {
                    str = str.replace(new RegExp(`(<${importReplacer.lib}.${importReplacer.control}${beforeReg}${config.thisOpt}${afterReg}`), `$1${config.newOpt}$2`);
                }
            });
        }
        const path = config.module.split('/');
        SEPARATORS.forEach((separator) => {
            str = str.replace(new RegExp('(' +
                path.join(separator.lib) +
                separator.control +
                config.control +
                beforeReg +
                config.thisOpt +
                afterReg, 'g'), `$1${config.newOpt}$2`);
        });
        return str;
    }
    cssReplace(str, config) {
        const isCssVar = config.varName.indexOf('--') === 0;
        const isClassName = config.varName.includes('.');
        if (config.isRemove || (isClassName && !config.newVarName)) {
            if (isCssVar) {
                str = str.replace(new RegExp(`((\\n[^-]+|\\n)?${config.varName}:[^;]+;)`, 'g'), '');
            }
            else if (isClassName) {
                const reg = new RegExp('(^\\' + config.varName + '[^}]+})', 'mg');
                const find = str.match(reg);
                if (find) {
                    if (find[0].match(/{/g).length === 1) {
                        str = str.replace(reg, '');
                    }
                    else {
                        this.addError(config.thisContext, `Не удалось удалить класс ${config.varName}, так как у него есть вложенные классы.`);
                    }
                }
                else {
                    if (str.match(new RegExp('(\\' + config.varName + '[^}]+})', 'mg'))) {
                        this.addError(config.thisContext, `Не удалось удалить класс ${config.varName}, так как он используется в связке с другим классом.`);
                    }
                }
            }
            else {
                return str.replace(new RegExp(`(${config.varName})`, 'g'), '');
            }
        }
        let find = config.varName;
        if (isCssVar) {
            find = `--\\b${find.replace('--', '')}\\b`;
        }
        else if (isClassName) {
            find = `\\b${find.replace('.', '')}\\b`;
        }
        else {
            find = `\\b${find}\\b`;
        }
        const replace = isClassName ? config.newVarName.replace('.', '') : config.newVarName;
        return str.replace(new RegExp(`(${find})`, 'g'), replace);
    }
    customRegReplace(str, config) {
        if (config.reg) {
            return str.replace(new RegExp(config.reg, config.flag || 'g'), config.replace);
        }
        return str;
    }
    customScriptReplace(config, customScript) {
        if (customScript) {
            const res = customScript(config);
            if (res.status) {
                return res.result;
            }
            else if (res.error) {
                this.addError(config.file, res.error, true);
            }
        }
        return config.fileContent;
    }
    importParse(str, controlName, moduleName) {
        const importsValue = Replacer.getImportMatch(moduleName, str);
        if (importsValue.length) {
            const paths = [];
            importsValue.forEach((importValue) => {
                if (importValue[1]) {
                    const correctImport = importValue[1].replace(/[\n}{]/g, ' ');
                    const names = correctImport.split(',').map((val) => val.trim());
                    names.forEach((name) => {
                        const value = name.split(' ');
                        for (let i = 0; i < value.length; i++) {
                            const path = {
                                name: '',
                                control: '',
                                lib: '',
                                fullImport: importValue[0],
                                importNames: importValue[1],
                                importsList: names,
                            };
                            if (value[i] === controlName) {
                                if (value[i + 1] === 'as') {
                                    path.name = value[i + 2];
                                    path.control = controlName;
                                }
                                else {
                                    if (value[i - 1] !== 'as') {
                                        path.name = controlName;
                                        path.control = controlName;
                                    }
                                }
                            }
                            else if (value[i] === '*') {
                                if (value[i + 1] === 'as') {
                                    path.control = controlName;
                                    path.lib = value[i + 2];
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
    updateImport(str, importReplacer, config) {
        if (config.moduleName === config.newModuleName) {
            return str;
        }
        const moduleNameReg = new RegExp(`[\"']${config.moduleName}[\"']`);
        const match = Replacer.getImportMatch(config.newModuleName, str);
        if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
            str = str.replace(moduleNameReg, `'${config.newModule || config.newModuleName}'`);
        }
        else {
            const imports = [];
            let startSeparator = '';
            let endSeparator = '';
            if (importReplacer.name) {
                importReplacer.importNames.split(',').forEach((imp) => {
                    if (!new RegExp(`\\b${importReplacer.control}\\b`).test(imp)) {
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
                str = str.replace(importReplacer.importNames, startSeparator + imports.join(', ') + endSeparator);
                if (match.length) {
                    str = Replacer.addedInImport(str, match, importReplacer);
                }
                else {
                    let newImport = `\'${config.moduleName}\'`;
                    if (config.controlName) {
                        newImport += `;\nimport {${importReplacer.control}${importReplacer.control !== importReplacer.name
                            ? ' as ' + importReplacer.name
                            : ''}} from '${config.newModuleName}';`;
                    }
                    str = str.replace(moduleNameReg, newImport);
                    str = str.replace(';;', ';');
                }
            }
            else {
                this.addError(config.thisContext, `Используется сложный импорт(import * as ${importReplacer.lib} from \'${config.moduleName}\'). Скрипт не знает как его правильно обработать!`);
            }
        }
        let emptyImportMatch = Replacer.getImportMatch(config.moduleName, str);
        if (emptyImportMatch.length) {
            const importValue = emptyImportMatch[0][1].replace(/\n/g, '').trim();
            if (importValue === '' || importValue === '{}') {
                str = str.replace(emptyImportMatch[0][0] + '\n', '');
            }
        }
        return str;
    }
    importReplacer(str, config) {
        const { controlName, newControlName, moduleName } = config;
        if (controlName === '*') {
            return str.replace(new RegExp(`[\"']${moduleName}[\"']`, 'g'), "'" + config.newModuleName + "'");
        }
        if (moduleName[moduleName.length - 1] === '*') {
            const correctModuleName = moduleName.replace('/*', '');
            const correctNewModuleName = config.newModuleName.replace('/*', '');
            return str.replace(new RegExp('(["\'])' + correctModuleName, 'g'), '$1' + correctNewModuleName);
        }
        const importsReplacer = this.importParse(str, controlName, moduleName);
        if (importsReplacer) {
            let value = str;
            importsReplacer.forEach((importReplacer) => {
                let reg;
                if (!importReplacer.name) {
                    reg = new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g');
                }
                else {
                    reg = new RegExp(importReplacer.control);
                }
                if (reg.test(str)) {
                    value = this.updateImport(value, importReplacer, config);
                    if (importReplacer.name) {
                        if (newControlName) {
                            if (importReplacer.name === importReplacer.control) {
                                const replace = newControlName + '$1';
                                value = value.replace(new RegExp(`\\b${importReplacer.control}\\b([^(/'\")])`, 'g'), replace);
                                value = value.replace(new RegExp(`\\b${importReplacer.control}\\b((\\()|(/>))`, 'g'), replace);
                            }
                            else {
                                value = value.replace(new RegExp(`([^(./:)])\\b${importReplacer.control}\\b([^(./:)])`), `$1${newControlName}$2`);
                            }
                        }
                        else {
                            const replaceReg = new RegExp(`\\b${importReplacer.control}\\b`);
                            const rValue = importReplacer.name === importReplacer.control
                                ? `default as ${controlName}`
                                : 'default';
                            const updateImportReplacer = this.importParse(value, importReplacer.control, config.newModuleName);
                            if (updateImportReplacer && updateImportReplacer.length) {
                                value = value.replace(new RegExp(updateImportReplacer[0].fullImport), updateImportReplacer[0].fullImport.replace(replaceReg, rValue));
                            }
                            else {
                                if (importReplacer.name === importReplacer.control) {
                                    value = value.replace(reg, `default as ${controlName}`);
                                }
                                else {
                                    value = value.replace(new RegExp(importReplacer.importNames), importReplacer.importNames.replace(replaceReg, rValue));
                                }
                            }
                        }
                    }
                    else {
                        value = value.replace(new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g'), importReplacer.lib + '.' + newControlName);
                    }
                }
            });
            if (value !== str) {
                const reg = /import( type|)(\\n|[^('|")]+?)from ['|"][^('|")]+['|"];?/gmu;
                const imports = [...value.matchAll(reg)];
                imports.forEach((imp) => {
                    if (imp[2] && imp[0].includes('{') && imp[0].includes('}')) {
                        if (imp[2].includes('\n')) {
                            return;
                        }
                        let importName = imp[2]
                            .trim()
                            .replace(/[{|}]/g, '')
                            .split(',')
                            .map((res) => {
                            return res.trim();
                        })
                            .join(', ');
                        const replaceValue = imp[0].replace(imp[2], ` { ${importName} } `);
                        value = value.replace(imp[0], replaceValue);
                    }
                });
            }
            return value;
        }
        return str;
    }
    textReplacer(str, config) {
        const { controlName, newControlName, moduleName, newModuleName } = config;
        const path = moduleName.split('/');
        const newPath = newModuleName.split('/');
        let newName = newControlName;
        if (newName === '') {
            newName = newPath.at(-1);
            newPath.pop();
        }
        SEPARATORS.forEach((separator) => {
            if (newName === '*') {
                if (separator.control === ':') {
                    return;
                }
            }
            if (newName === '*' || moduleName[moduleName.length - 1] === '*') {
                const correctPath = moduleName.replace('/*', '').split('/');
                const correctNewPath = newModuleName.replace('/*', '').split('/');
                str = str.replace(new RegExp('(<|"|\'|/|!)' + correctPath.join(separator.lib), 'g'), '$1' + correctNewPath.join(separator.lib));
            }
            else {
                str = str.replace(new RegExp(path.join(separator.lib) + separator.control + controlName, 'g'), newPath.join(separator.lib) +
                    (newControlName ? separator.control : separator.lib) +
                    newName);
            }
        });
        return str;
    }
    addError(fileName, msg, isError = false) {
        warning(`file: "${fileName}";\n info:\n ${msg}`);
        this.errors.push({
            fileName,
            comment: msg,
            date: new Date(),
            isError,
        });
    }
    clearErrors() {
        this.errors = [];
    }
    getErrors() {
        return this.errors;
    }
}

var TypeReplacer;
(function (TypeReplacer) {
    TypeReplacer["Controls"] = "controls";
    TypeReplacer["Options"] = "options";
    TypeReplacer["Custom"] = "custom";
    TypeReplacer["Css"] = "css";
})(TypeReplacer || (TypeReplacer = {}));
const EXCLUDE_DIRS = ['node_modules', '.git', '.idea', 'build-ui', 'wasaby-cli_artifacts'];
const LINE_SEPARATOR = '='.repeat(75);
class Script {
    replacer = new Replacer();
    errors = [];
    customScripts = {};
    controlsReplace(replace, newFileContent, newPath) {
        const moduleName = replace.module;
        replace.controls.forEach((control) => {
            const controlName = control.name;
            if (control.newName || control.newModuleName) {
                const newControlName = control.newName ?? controlName;
                const newModuleName = replace.newModule || (control.newModuleName ?? moduleName);
                newFileContent = this.replacer.replaceControls(newFileContent, {
                    controlName,
                    newControlName,
                    moduleName,
                    newModuleName,
                    newModule: replace.newModule,
                    thisContext: newPath,
                });
            }
        });
        return newFileContent;
    }
    async script(param, path, type = TypeReplacer.Controls) {
        const dirs = FileUtils.getDirs(path);
        for (const dir of dirs) {
            const newPath = `${path}/${dir}`;
            if (EXCLUDE_DIRS.includes(dir)) {
                continue;
            }
            if (FileUtils.isDir(newPath)) {
                await this.script(param, newPath, type);
            }
            else {
                try {
                    const fileSize = FileUtils.fileSize(newPath, 'mb');
                    if (fileSize < param.maxFileSize) {
                        const fileContent = FileUtils.read(newPath);
                        let newFileContent = fileContent;
                        for (const replace of param.replaces) {
                            switch (type) {
                                case TypeReplacer.Controls:
                                    newFileContent = this.controlsReplace(replace, newFileContent, newPath);
                                    break;
                                case TypeReplacer.Options:
                                    newFileContent = this.replacer.replaceOptions(newFileContent, replace);
                                    break;
                                case TypeReplacer.Custom:
                                    if (replace.scriptPath) {
                                        const scriptPath = replace
                                            .scriptPath;
                                        if (!this.customScripts.hasOwnProperty(scriptPath)) {
                                            if (FileUtils.isFile(scriptPath)) {
                                                const res = await import(scriptPath);
                                                this.customScripts[scriptPath] = res.run;
                                                if (typeof this.customScripts[scriptPath] !==
                                                    'function') {
                                                    this.addError(scriptPath, `В файле "${scriptPath}" отсутствует метод run. См доку на github.`, true);
                                                }
                                            }
                                            else {
                                                this.addError(scriptPath, `Не удалось найти файл "${scriptPath}", для запуска скрипта`, true);
                                                this.customScripts[scriptPath] = undefined;
                                            }
                                        }
                                        if (typeof this.customScripts[scriptPath] === 'function') {
                                            newFileContent = this.replacer.customScriptReplace({
                                                path,
                                                file: dir,
                                                fileContent: newFileContent,
                                            }, this.customScripts[scriptPath]);
                                        }
                                    }
                                    else {
                                        newFileContent = this.replacer.customRegReplace(newFileContent, replace);
                                    }
                                    break;
                                case TypeReplacer.Css:
                                    newFileContent = this.replacer.cssReplace(newFileContent, replace);
                                    break;
                            }
                        }
                        if (fileContent !== newFileContent) {
                            success(`Обновляю файл: "${newPath}"`);
                            FileUtils.write(newPath, newFileContent);
                        }
                    }
                    else {
                        this.addError(newPath, `Файл "${newPath}" весит ${fileSize}MB. Пропускаю его, так как стоит ограничение в ${param.maxFileSize}MB.`);
                    }
                }
                catch (e) {
                    this.addError(newPath, e.message, true);
                }
            }
        }
    }
    async run(param, type = TypeReplacer.Controls) {
        log('script start');
        log(LINE_SEPARATOR);
        this.errors = [];
        this.replacer.clearErrors();
        await this.script(Script.getCorrectParam(param), param.path, type);
        this.errors = [...this.errors, ...this.replacer.getErrors()];
        if (this.errors.length) {
            this.saveLog();
        }
        log(LINE_SEPARATOR);
        log('script end');
    }
    addError(fileName, msg, isError = false) {
        const comment = `file: "${fileName}";\n info:\n ${msg}`;
        if (isError) {
            error(comment);
        }
        else {
            warning(comment);
        }
        this.errors.push({
            fileName,
            comment: msg,
            date: new Date(),
            isError,
        });
    }
    saveLog() {
        const errorDir = './errors';
        if (!FileUtils.isDir(errorDir)) {
            FileUtils.mkDir(errorDir);
        }
        let errorContent = '';
        this.errors.forEach((error) => {
            errorContent += `\n${LINE_SEPARATOR}`;
            errorContent += `\n\tДата: ${error.date}`;
            errorContent += `\n\tТип: ${error.isError ? 'Ошибка' : 'Предупреждение'}`;
            errorContent += `\n\tФайл: ${error.fileName}`;
            errorContent += `\n\tОписание: ${error.comment}`;
            errorContent += `\n${LINE_SEPARATOR}\n`;
        });
        const fileName = Date.now();
        const errorFile = `${errorDir}/${fileName}.log`;
        FileUtils.write(errorFile, errorContent, 'w');
        warning(`При выполнении скрипта были обнаружены ошибки. Подробнее в: ${errorFile}`);
    }
    static getCorrectParam(param) {
        return {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize ?? 50,
        };
    }
}

const REP_FILES = ['README.md', 'package.json', '.gitignore'];
function executeInRep(path, cb) {
    const dirFiles = FileUtils.getDirs(path);
    let isRep = false;
    dirFiles.forEach((dirFile) => {
        if (REP_FILES.includes(dirFile)) {
            isRep = true;
        }
    });
    if (isRep) {
        cb(path);
        return;
    }
    else {
        dirFiles.forEach((dirFile) => {
            const newPath = path + '/' + dirFile;
            if (EXCLUDE_DIRS.includes(dirFile)) {
                return;
            }
            if (FileUtils.isDir(newPath)) {
                executeInRep(newPath, cb);
            }
        });
    }
}

function resetGit(dir) {
    executeInRep(dir, (path) => {
        childProcess__namespace.execSync(`cd ${path} && git reset --hard HEAD~`);
    });
}

const NOT_PUSHED_MSG = 'unknown revision or path not in the working tree.';
function isPushed(stdout) {
    if (stdout) {
        const msg = stdout.split('\n');
        return msg[0].includes(NOT_PUSHED_MSG) || msg[1]?.includes(NOT_PUSHED_MSG);
    }
    return false;
}
function gitReset(path) {
    childProcess__namespace.execSync(`cd "${path}" &&  git reset --soft HEAD~`);
    success(`Коммит по пути: "${path}" успешно отменен`);
}
function fixCommit(dir) {
    executeInRep(dir, (path) => {
        const gitStatus = childProcess__namespace.execSync(`cd "${path}" && git status`);
        if (gitStatus.toString().includes('use "git push"')) {
            gitReset(path);
        }
        else {
            const gitBranch = childProcess__namespace
                .execSync(`cd "${path}" && git branch -v`)
                .toString()
                .match(/\* ([^ |\n]+)/)?.[1];
            if (gitBranch) {
                let isPush;
                try {
                    isPush = isPushed(childProcess__namespace
                        .execSync(`cd "${path}" && git log origin/${gitBranch}`, {
                        stdio: 'pipe',
                    })
                        .toString());
                }
                catch (e) {
                    isPush = isPushed(e.message);
                }
                if (isPush) {
                    gitReset(path);
                }
            }
        }
    });
}

var TYPE;
(function (TYPE) {
    TYPE["OPTION"] = "replaceOpt";
    TYPE["CUSTOM"] = "customReplace";
    TYPE["CSS"] = "cssReplace";
    TYPE["RESET_GIT"] = "resetGit";
    TYPE["FIX_COMMIT"] = "fixCommit";
})(TYPE || (TYPE = {}));
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
    log(`\t- ${TYPE.RESET_GIT} - откатывает изменения. Стоит использовать в том случае, если скрипт отработал ошибочно.`);
    log(`\t- ${TYPE.FIX_COMMIT} - откатывает коммит оставляя правки. Стоит использовать когда нужно повторно запустить скрипт для создания mr.`);
    log('');
}
function showLine(str, maxLength = DEFAULT_LINE_LENGTH) {
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
    }
    else {
        log(`# ${str}` + ' '.repeat(repeat) + '#');
    }
}
function showMultiline(str, prefix = '    ', defaultStep = '    ') {
    str.forEach((s) => {
        if (typeof s === 'object') {
            showMultiline(s, prefix + defaultStep);
        }
        else {
            showLine(prefix + s);
        }
    });
}
function showConfigInfo(title, body, footer) {
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
    showConfigInfo('Перенос/переименовывание контролов и утилит', [
        '"module": "Текущее имя модуля"',
        '"newModule": "Новое имя модуля. Лучше не использовать"',
        '"controls": [// Массив с контролами/утилитами',
        [
            '"name": "Текущее имя контрола"',
            '"newName": "Новое имя контрола"',
            '"newModuleName": "Новое имя модуля"',
        ],
    ], 'newModule стоит использовать только в том случае, если перемещаются все контролы из модуля, иначе возможны ошибки');
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
    showConfigInfo('Пользовательская замена', [
        '"reg": "Регулярное выражение для замены"',
        '"flag": "Флаг для регулярного выражения. По умолчанию g"',
        '"replace": "То как производится замена"',
        '"scriptPath": "Путь до пользовательского скрипта"',
    ], 'Обязательно должно быть передано "scriptPath", либо "reg" и "replace", если передать все свойства, то запуститься пользовательский скрипт, регулярное выражение будет проигнорировано');
}
const argv = process.argv;
function getType(value) {
    if (value === TYPE.OPTION) {
        return TypeReplacer.Options;
    }
    else if (value === TYPE.CUSTOM) {
        return TypeReplacer.Custom;
    }
    return TypeReplacer.Css;
}
function startScript(configFile, cb) {
    if (configFile.indexOf('.json') !== -1) {
        if (FileUtils.isFile(configFile)) {
            const param = JSON.parse(FileUtils.read(configFile));
            cb(param);
        }
        else {
            error(`Не удалось найти файл "${configFile}"`);
        }
    }
    else {
        error('Не передан файл с конфигурацией');
    }
}
if (argv[2]) {
    if (argv[2].indexOf('.json') !== -1) {
        startScript(argv[2], async (param) => {
            if (param.path) {
                await script.run(param);
            }
            else {
                getScriptControlParam();
            }
        });
    }
    else {
        switch (argv[2]) {
            case TYPE.OPTION:
            case TYPE.CUSTOM:
            case TYPE.CSS:
                startScript(argv[3], async (param) => {
                    const type = getType(argv[2]);
                    if (param.path) {
                        await script.run(param, type);
                    }
                    else {
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
                });
                break;
            case TYPE.RESET_GIT:
                startScript(argv[3], (param) => {
                    if (param.path) {
                        log('=== start ===');
                        resetGit(param.path);
                        log('=== end ===');
                    }
                    else {
                        error('Укажите свойство path в конфигурации');
                    }
                });
                break;
            case TYPE.FIX_COMMIT:
                startScript(argv[3], (param) => {
                    if (param.path) {
                        log('=== start ===');
                        fixCommit(param.path);
                        log('Можно перезапускать скрипт для создания mr');
                        log('=== end ===');
                    }
                    else {
                        error('Укажите свойство path в конфигурации');
                    }
                });
                break;
            default:
                getScriptParam();
        }
    }
}
else {
    getScriptParam();
}
process.exitCode = 1;
