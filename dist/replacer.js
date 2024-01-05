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
    console.log("\x1b[32m", str, "\x1b[0m");
}
function warning(str) {
    console.log("\x1b[33m", str, "\x1b[0m");
}
function error(str) {
    console.log("\x1b[31m", str, "\x1b[0m");
}

const fs = require("fs");
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
        return fs.readFileSync(fileName, "utf-8");
    }
    static write(fileName, fileContent, mode = "w") {
        if (mode === "w") {
            fs.writeFileSync(fileName, fileContent);
        }
        else {
            fs.appendFileSync(fileName, fileContent);
        }
    }
    static fileSize(path, prefix = "mb") {
        const stat = fs.statSync(path);
        let size = stat.size;
        switch (prefix) {
            case "kb":
                size /= KB;
                break;
            case "mb":
                size /= MB;
                break;
            case "gb":
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
        lib: "/",
        control: ":",
    },
    {
        lib: "/",
        control: "/",
    },
    {
        lib: ".",
        control: ":",
    },
    {
        lib: ".",
        control: ".",
    },
];
class Replacer {
    errors = [];
    static getImportMatch(moduleName, str) {
        const reg = new RegExp(`^import(\\n|[^('|")]+?)from ['|"]${moduleName}['|"];?$`, "umg");
        return [...str.matchAll(reg)];
    }
    static addedInImport(str, match, importReplacer) {
        if (match.length) {
            let value = str;
            const updateImport = match[0][1].split(",");
            let startSeparator = "{";
            let endSeparator = "}";
            for (let i = 0; i < updateImport.length; i++) {
                if (updateImport[i].includes("{")) {
                    startSeparator = "";
                }
                if (updateImport[i].includes("}")) {
                    updateImport[i] = updateImport[i].replace("}", "");
                }
                updateImport[i] = updateImport[i].trim();
            }
            if (importReplacer.name === importReplacer.control) {
                updateImport.push(startSeparator + importReplacer.control + endSeparator);
            }
            else {
                updateImport.push(startSeparator + importReplacer.control + " as " + importReplacer.name + endSeparator);
            }
            return value.replace(match[0][1], " " + updateImport.join(", ") + " ");
        }
        return str;
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
            importsReplacer.forEach((importReplacer) => {
                if (importReplacer.name) {
                    value = value.replace(new RegExp("(<\\b" + importReplacer.name + "\\b(?:\\n|[^>])+?)\\b" + config.thisOpt + "\\b((?:\\n|[^>])+?>)", "g"), "$1" + config.newOpt + "$2");
                }
                else {
                    value = value.replace(new RegExp("(<" +
                        importReplacer.lib +
                        "." +
                        importReplacer.control +
                        "\\b(?:\\n|[^>])+?)\\b" +
                        config.thisOpt +
                        "\\b((?:\\n|[^>])+?>)"), "$1" + config.newOpt + "$2");
                }
            });
        }
        const path = config.module.split("/");
        SEPARATORS.forEach((separator) => {
            value = value.replace(new RegExp("(" +
                path.join(separator.lib) +
                separator.control +
                config.control +
                "\\b(?:\\n|[^>])+?)\\b" +
                config.thisOpt +
                "\\b((?:\\n|[^>])+?>)", "g"), "$1" + config.newOpt + "$2");
        });
        return value;
    }
    cssReplace(str, config) {
        let value = str;
        const isCssVar = config.varName.indexOf("--") === 0;
        const isClassName = config.varName.includes(".");
        if (config.isRemove || (isClassName && !config.newVarName)) {
            if (isCssVar) {
                value = value.replace(new RegExp("(" + config.varName + ":[^;]+;)", "g"), "");
            }
            else if (isClassName) {
                const reg = new RegExp("(^\\" + config.varName + "[^}]+})", "mg");
                const find = value.match(reg);
                if (find) {
                    if (find[0].match(/{/g).length === 1) {
                        value = value.replace(reg, "");
                    }
                    else {
                        this.errors.push({
                            fileName: config.thisContext,
                            comment: `Не удалось удалить класс ${config.varName}, так как у него есть вложенные классы.`,
                            date: new Date(),
                        });
                    }
                }
                else {
                    if (value.match(new RegExp("(\\" + config.varName + "[^}]+})", "mg"))) {
                        this.errors.push({
                            fileName: config.thisContext,
                            comment: `Не удалось удалить класс ${config.varName}, так как он используется в связке с другим классом.`,
                            date: new Date(),
                        });
                    }
                }
            }
            else {
                value = value.replace(new RegExp("(" + config.varName + ")", "g"), "");
                return value;
            }
        }
        let find = config.varName;
        if (isCssVar) {
            find = "--\\b" + find.replace("--", "") + "\\b";
        }
        else if (isClassName) {
            find = "\\b" + config.varName.replace(".", "") + "\\b";
        }
        else {
            find = "\\b" + find + "\\b";
        }
        const replace = isClassName ? config.newVarName.replace(".", "") : config.newVarName;
        value = value.replace(new RegExp("(" + find + ")", "g"), replace);
        return value;
    }
    customReplace(str, config) {
        if (config.reg) {
            return str.replace(new RegExp(config.reg, config.flag || "g"), config.replace);
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
                this.errors.push({ fileName: config.file, comment: res.error, date: new Date() });
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
                    const correctImport = importValue[1].replace(/[\n|}|{]/g, " ");
                    const names = correctImport.split(",").map((val) => val.trim());
                    names.forEach((name) => {
                        const value = name.split(" ");
                        for (let i = 0; i < value.length; i++) {
                            const path = {
                                name: "",
                                control: "",
                                lib: "",
                                fullImport: importValue[0],
                                importNames: importValue[1],
                                importsList: names,
                            };
                            if (value[i] === controlName) {
                                if (value[i + 1] === "as") {
                                    path.name = value[i + 2];
                                    path.control = controlName;
                                }
                                else {
                                    if (value[i - 1] !== "as") {
                                        path.name = controlName;
                                        path.control = controlName;
                                    }
                                }
                            }
                            else if (value[i] === "*") {
                                if (value[i + 1] === "as") {
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
        let value = str;
        const match = Replacer.getImportMatch(config.newModuleName, str);
        if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
            value = value.replace(new RegExp("(\"|')" + config.moduleName + "(\"|')"), "'" + (config.newModule || config.newModuleName) + "'");
        }
        else {
            const imports = [];
            let startSeparator = "";
            let endSeparator = "";
            if (importReplacer.name) {
                importReplacer.importNames.split(",").forEach((imp) => {
                    if (!new RegExp(`\\b${importReplacer.control}\\b`).test(imp)) {
                        imports.push(imp);
                    }
                    else {
                        if (imp.includes("{")) {
                            startSeparator = " {";
                        }
                        if (imp.includes("}")) {
                            endSeparator = "} ";
                        }
                    }
                });
                value = value.replace(importReplacer.importNames, startSeparator + imports.join(", ") + endSeparator);
                if (match.length) {
                    value = Replacer.addedInImport(value, match, importReplacer);
                }
                else {
                    let newImport = `\'${config.moduleName}\'`;
                    if (config.controlName) {
                        newImport += `;\nimport {${importReplacer.control}${importReplacer.control !== importReplacer.name ? " as " + importReplacer.name : ""}} from '${config.newModuleName}';`;
                    }
                    value = value.replace(new RegExp("(\"|')" + config.moduleName + "(\"|')"), newImport);
                    value = value.replace(";;", ";");
                }
            }
            else {
                this.errors.push({
                    fileName: config.thisContext,
                    comment: `Используется сложный импорт(import * as ${importReplacer.lib} from \'${config.moduleName}\'). Скрипт не знает как его правильно обработать!`,
                    date: new Date(),
                });
            }
        }
        let emptyImportMatch = Replacer.getImportMatch(config.moduleName, value);
        if (emptyImportMatch.length) {
            const emptyValue = emptyImportMatch[0][1].replace(/\n/g, "").trim();
            if (emptyValue === "" || emptyValue === "{}") {
                value = value.replace(emptyImportMatch[0][0] + "\n", "");
            }
        }
        return value;
    }
    importReplacer(str, config) {
        const { controlName, newControlName, moduleName } = config;
        if (controlName === "*") {
            return str.replace(new RegExp("(\"|')" + moduleName + "(\"|')", "g"), "'" + config.newModuleName + "'");
        }
        if (moduleName[moduleName.length - 1] === "*") {
            const correctModuleName = moduleName.replace("/*", "");
            const correctNewModuleName = config.newModuleName.replace("/*", "");
            return str.replace(new RegExp("(\"|')" + correctModuleName, "g"), "$1" + correctNewModuleName);
        }
        const importsReplacer = this.importParse(str, controlName, moduleName);
        if (importsReplacer) {
            let value = str;
            importsReplacer.forEach((importReplacer) => {
                let reg = new RegExp(importReplacer.control);
                if (!importReplacer.name) {
                    reg = new RegExp(importReplacer.lib + "\\." + importReplacer.control, "g");
                }
                if (reg.test(str)) {
                    value = this.updateImport(value, importReplacer, config);
                    if (importReplacer.name) {
                        if (newControlName) {
                            if (importReplacer.name === importReplacer.control) {
                                value = value.replace(new RegExp("\\b" + importReplacer.control + "\\b([^(/|'|\")])", "g"), newControlName + "$1");
                                value = value.replace(new RegExp("\\b" + importReplacer.control + "\\b/>", "g"), newControlName + "/>");
                                value = value.replace(new RegExp("\\b" + importReplacer.control + "\\b\\(", "g"), newControlName + "(");
                            }
                            else {
                                value = value.replace(new RegExp("([^(.|/|:)])\\b" + importReplacer.control + "\\b([^(.|/|:)])"), "$1" + newControlName + "$2");
                            }
                        }
                        else {
                            const replaceReg = new RegExp("\\b" + importReplacer.control + "\\b");
                            const rValue = importReplacer.name === importReplacer.control ? `default as ${controlName}` : "default";
                            const updateImportReplacer = this.importParse(value, importReplacer.control, config.newModuleName);
                            if (updateImportReplacer && updateImportReplacer.length) {
                                const replaceValue = updateImportReplacer[0].fullImport.replace(replaceReg, rValue);
                                const reg = new RegExp(updateImportReplacer[0].fullImport);
                                value = value.replace(reg, replaceValue);
                            }
                            else {
                                if (importReplacer.name === importReplacer.control) {
                                    value = value.replace(reg, `default as ${controlName}`);
                                }
                                else {
                                    const replaceValue = importReplacer.importNames.replace(replaceReg, rValue);
                                    const reg = new RegExp(importReplacer.importNames);
                                    value = value.replace(reg, replaceValue);
                                }
                            }
                        }
                    }
                    else {
                        value = value.replace(new RegExp(importReplacer.lib + "\\." + importReplacer.control, "g"), importReplacer.lib + "." + newControlName);
                    }
                }
            });
            if (value !== str) {
                const reg = /import(\\n|[^('|")]+?)from ['|"][^('|")]+['|"];?/gmu;
                const imports = [...value.matchAll(reg)];
                imports.forEach((imp) => {
                    if (imp[1] && imp[0].includes("{") && imp[0].includes("}")) {
                        let importName = imp[1]
                            .replace(/[{|}]/g, "")
                            .split(",")
                            .map((res) => {
                            return res.trim();
                        })
                            .join(", ");
                        const replaceValue = imp[0].replace(imp[1], ` { ${importName} } `);
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
        const path = moduleName.split("/");
        const newPath = newModuleName.split("/");
        let value = str;
        let newName = newControlName;
        if (newName === "") {
            newName = newPath.at(-1);
            newPath.pop();
        }
        SEPARATORS.forEach((separator) => {
            if (newName === "*") {
                if (separator.control === ":") {
                    return;
                }
            }
            if (newName === "*" || moduleName[moduleName.length - 1] === "*") {
                const correctPath = moduleName.replace("/*", "").split("/");
                const correctNewPath = newModuleName.replace("/*", "").split("/");
                const replace = "(<|\"|'|/|!)" + correctPath.join(separator.lib);
                const replacer = "$1" + correctNewPath.join(separator.lib);
                value = value.replace(new RegExp(replace, "g"), replacer);
            }
            else {
                const replace = path.join(separator.lib) + separator.control + controlName;
                const replacer = newPath.join(separator.lib) + (newControlName ? separator.control : separator.lib) + newName;
                value = value.replace(new RegExp(replace, "g"), replacer);
            }
        });
        return value;
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
const EXCLUDE_DIRS = ["node_modules", ".git", ".idea", "build-ui", "wasaby-cli_artifacts"];
class Script {
    replacer = new Replacer();
    errors = [];
    customScripts = {};
    _controlsReplace(replace, newFileContent, newPath) {
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
    _optionsReplace(replace, newFileContent) {
        return this.replacer.replaceOptions(newFileContent, replace);
    }
    static getCorrectParam(param) {
        return {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize ?? 50,
        };
    }
    async script(param, path, type = TypeReplacer.Controls) {
        const dirs = FileUtils.getDirs(path);
        for (const dir of dirs) {
            const newPath = path + "/" + dir;
            if (EXCLUDE_DIRS.includes(dir)) {
                continue;
            }
            if (FileUtils.isDir(newPath)) {
                await this.script(param, newPath, type);
            }
            else {
                try {
                    const fileSize = FileUtils.fileSize(newPath, "mb");
                    if (fileSize < param.maxFileSize) {
                        const fileContent = FileUtils.read(newPath);
                        let newFileContent = fileContent;
                        for (const replace of param.replaces) {
                            switch (type) {
                                case TypeReplacer.Controls:
                                    newFileContent = this._controlsReplace(replace, newFileContent, newPath);
                                    break;
                                case TypeReplacer.Options:
                                    newFileContent = this._optionsReplace(replace, newFileContent);
                                    break;
                                case TypeReplacer.Custom:
                                    if (replace.scriptPath) {
                                        const scriptPath = replace.scriptPath;
                                        if (!this.customScripts.hasOwnProperty(scriptPath)) {
                                            if (FileUtils.isFile(scriptPath)) {
                                                const res = await import(scriptPath);
                                                this.customScripts[scriptPath] = res.run;
                                                if (typeof this.customScripts[scriptPath] !== "function") {
                                                    this.errors.push({
                                                        fileName: scriptPath,
                                                        comment: `В файле "${scriptPath}" отсутствует метод run. См доку на github.`,
                                                        date: new Date(),
                                                    });
                                                }
                                            }
                                            else {
                                                this.errors.push({
                                                    fileName: scriptPath,
                                                    comment: `Не удалось найти файл "${scriptPath}", для запуска скрипта`,
                                                    date: new Date(),
                                                });
                                                this.customScripts[scriptPath] = undefined;
                                            }
                                        }
                                        if (typeof this.customScripts[scriptPath] === "function") {
                                            newFileContent = this.replacer.customScriptReplace({
                                                path,
                                                file: dir,
                                                fileContent: newFileContent,
                                            }, this.customScripts[scriptPath]);
                                        }
                                    }
                                    else {
                                        newFileContent = this.replacer.customReplace(newFileContent, replace);
                                    }
                                    break;
                                case TypeReplacer.Css:
                                    newFileContent = this.replacer.cssReplace(newFileContent, replace);
                                    break;
                            }
                        }
                        if (fileContent !== newFileContent) {
                            success(`Обновляю файл: ${newPath}`);
                            FileUtils.write(newPath, newFileContent);
                        }
                    }
                    else {
                        warning(`Файл "${newPath}" весит ${fileSize}MB. Пропускаю его, так как стоит огрнаничение на ${param.maxFileSize}MB.`);
                        this.errors.push({
                            fileName: newPath,
                            comment: `Файл весит ${fileSize}MB. Задано ограничение в ${param.maxFileSize}MB.`,
                            date: new Date(),
                        });
                    }
                }
                catch (e) {
                    this.errors.push({
                        date: new Date(),
                        fileName: newPath,
                        comment: e.message,
                    });
                    error(e.message);
                }
            }
        }
    }
    async run(param, type = TypeReplacer.Controls) {
        log("script start");
        log("=================================================================");
        this.errors = [];
        this.replacer.clearErrors();
        await this.script(Script.getCorrectParam(param), param.path, type);
        this.errors = [...this.errors, ...this.replacer.getErrors()];
        if (this.errors.length) {
            this.saveLog();
        }
        log("=================================================================");
        log("script end");
    }
    saveLog() {
        const errorDir = "./errors";
        if (!FileUtils.isDir(errorDir)) {
            FileUtils.mkDir(errorDir);
        }
        let errorContent = "";
        this.errors.forEach((error) => {
            errorContent += "\n===========================================================================";
            errorContent += "\n\tДата: " + error.date;
            errorContent += "\n\tФайл: " + error.fileName;
            errorContent += "\n\tОписание: " + error.comment;
            errorContent += "\n===========================================================================\n";
        });
        const fileName = Date.now();
        FileUtils.write(`${errorDir}/${fileName}.log`, errorContent, "w");
        warning(`При выполнении скрипта были обнаружены ошибки. Подробнее в: ${errorDir}/${fileName}.log`);
    }
}

const REP_FILES = ["README.md", "package.json", ".gitignore"];
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
            const newPath = path + "/" + dirFile;
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

function fixCommit(dir) {
    executeInRep(dir, (path) => {
        const gitStatus = childProcess__namespace.execSync(`cd ${path} && git status`);
        if (gitStatus.toString().includes('use "git push"')) {
            childProcess__namespace.execSync(`cd ${path} && git reset --soft HEAD~`);
            success(`Коммит по пути: ${path} успешно отменен`);
        }
    });
}

const script = new Script();
function getScriptParam() {
    log("");
    log("Скрипт предназначен для автоматического переименовывание контролов и их опций.");
    log("Также предусмотрена возможность указать свое регулярное выражения для замены.");
    log("Поддерживаемые опции:");
    log("\t- config.json - переименовывание контролов или модулей");
    log("\t- replaceOpt config.json - переименовывание опций у контролов");
    log("\t- cssReplace config.json - переименовывание css переменных или классов");
    log("\t- customReplace config.json - кастомная замена");
    log("\t- resetGit - откатывает изменения. Стоит использовать в том случае, если скрипт отработал ошибочно.");
    log("\t- fixCommit - откатывает коммит. Стоит использовать в том случае, если нужно повторно запустить скрипт для создания mr.");
    log("");
}
function getScriptControlParam() {
    log("######################################################################");
    log("# Для корректной замены контролов укажите файл настроек              #");
    log("# Файл должен выглядеть следующим образом:                           #");
    log("# {                                                                  #");
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "module": "Текущее имя модуля"                            #');
    log('#          "newModule": "Новое имя модуля. Лучше не использовать"    #');
    log('#          "controls": [// Массив с контролами                       #');
    log('#              "name": "Текущее имя контрола"                        #');
    log('#              "newName": "Новое имя контрола"                       #');
    log('#              "newModuleName": "Новое имя модуля"                   #');
    log("#          ]                                                         #");
    log("#      ]                                                             #");
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log("# }                                                                  #");
    log("# newModule стоит использовать только в том случае, если             #");
    log("# перемещаются все контролы из модуля, иначе возможны ошибки         #");
    log("######################################################################");
}
function getScriptOptionParam() {
    log("######################################################################");
    log("# Для корректной замены опций укажите файл настроек                  #");
    log("# Файл должен выглядеть следующим образом:                           #");
    log("# {                                                                  #");
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "module": "Имя модуля"                                    #');
    log('#          "control": "Имя контрола"                                 #');
    log('#          "thisOpt": "Текущее имя опции"                            #');
    log('#          "newOpt": "Новое имя опции"                               #');
    log("#      ]                                                             #");
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log("# }                                                                  #");
    log("######################################################################");
}
function getScriptCSSParam() {
    log("######################################################################");
    log("# Для корректной замены опций укажите файл настроек                  #");
    log("# Файл должен выглядеть следующим образом:                           #");
    log("# {                                                                  #");
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "varName": "Текущее имя переменной или класса"            #');
    log('#          "newVarName": "Новое имя переменной или класса"           #');
    log('#          "isRemove": "Класс или переменная полностью удаляется"    #');
    log("#      ]                                                             #");
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log("# }                                                                  #");
    log("######################################################################");
}
function getScriptCustomParam() {
    log("######################################################################");
    log("# Для корректной замены укажите файл настроек                        #");
    log("# Файл должен выглядеть следующим образом:                           #");
    log("# {                                                                  #");
    log('#      "path": "Путь к репозиториям, где нужно выполнить замену"     #');
    log('#      "replaces": [ // Массив модулей с контролами                  #');
    log('#          "reg": "Регулярное выражение для замены"                  #');
    log('#          "flag": "Флаг для регулярного выражения. По умолчанию g"  #');
    log('#          "replace": "То как производится замена"                   #');
    log('#          "scriptPath": "Путь до пользовательского скрипта"         #');
    log("#      ]                                                             #");
    log('#      "maxFileSize": "Максимальный размер файла. По умолчанию 50mb" #');
    log("# }                                                                  #");
    log("######################################################################");
}
const argv = process.argv;
function getType(value) {
    if (value === "replaceOpt") {
        return TypeReplacer.Options;
    }
    else if (value === "customReplace") {
        return TypeReplacer.Custom;
    }
    return TypeReplacer.Css;
}
if (argv[2]) {
    if (argv[2].indexOf(".json") !== -1) {
        if (FileUtils.isFile(argv[2])) {
            const param = JSON.parse(FileUtils.read(argv[2]));
            if (param.path) {
                script.run(param);
            }
            else {
                getScriptControlParam();
            }
        }
        else {
            error(`Не удалось найти файл "${argv[2]}"`);
        }
    }
    else {
        switch (argv[2]) {
            case "replaceOpt":
            case "customReplace":
            case "cssReplace":
                if (argv[3].indexOf(".json") !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param = JSON.parse(FileUtils.read(argv[3]));
                        const type = getType(argv[2]);
                        if (param.path) {
                            script.run(param, type);
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
                    }
                    else {
                        error(`Не удалось найти файл "${argv[3]}"`);
                    }
                }
                else {
                    error("Не передан файл с конфигурацией");
                }
                break;
            case "resetGit":
                if (argv[3].indexOf(".json") !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param = JSON.parse(FileUtils.read(argv[3]));
                        if (param.path) {
                            log("=== start ===");
                            resetGit(param.path);
                            log("==== end ====");
                        }
                        else {
                            error("Укажите свойство path в конфигурации");
                        }
                    }
                    else {
                        error(`Не удалось найти файл "${argv[3]}"`);
                    }
                }
                else {
                    error("Не передан файл с конфигурацией");
                }
                break;
            case "fixCommit":
                if (argv[3].indexOf(".json") !== -1) {
                    if (FileUtils.isFile(argv[3])) {
                        const param = JSON.parse(FileUtils.read(argv[3]));
                        if (param.path) {
                            log("=== start ===");
                            fixCommit(param.path);
                            log("Можно перезапускать скрипт для создания mr");
                            log("==== end ====");
                        }
                        else {
                            error("Укажите свойство path в конфигурации");
                        }
                    }
                    else {
                        error(`Не удалось найти файл "${argv[3]}"`);
                    }
                }
                else {
                    error("Не передан файл с конфигурацией");
                }
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
