import { IConfig, ICustomReplace, IError, IReplaceOpt } from "../interfaces/IConfig";

interface IImportReplacer {
    name: string;
    control: string;
    lib: string;
    fullImport: string;
    importNames: string;
    importsList: string[];
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

export class Replacer {
    errors: IError[] = [];

    private static getImportMath(moduleName: string, str: string): RegExpMatchArray[] {
        const reg = new RegExp(`^import(\\n|[^('|")]+?)from ('|")${moduleName}('|");?$`, 'umg');
        return [...str.matchAll(reg)];
    }

    private importParse(str: string, controlName: string, moduleName: string): IImportReplacer[] | null {
        // Если будет несколько экспортов из 1 либы в файле, то есть вероятность, что что-то может пойти не так
        const match = Replacer.getImportMath(moduleName, str);

        if (match.length) {
            const paths: IImportReplacer[] = [];
            match.forEach((res) => {
                if (res[1]) {
                    const value = res[1].replace(/(\n|}|{)/g, ' ') as string;
                    const names = value.split(',').map((val) => val.trim());

                    names.forEach((name) => {
                        const val = name.split(' ');
                        for (let i = 0; i < val.length; i++) {
                            const path: IImportReplacer = {
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
                                // Если записали таким образом, то скорей всего хотят импортировать все,
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
                    });
                }
            });
            return paths;
        }
        return null
    }

    private static addedInImport(str: string, match: RegExpMatchArray[], importReplacer: IImportReplacer): string {
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
            } else {
                updateImport.push(startSeparator + importReplacer.control + ' as ' + importReplacer.name + endSeparator);
            }
            return value.replace(match[0][1], ' ' + updateImport.join(', ') + ' ');
        }
        return str;
    }

    private replaceImport(str: string, importReplacer: IImportReplacer, config: IConfig): string {
        if (config.moduleName === config.newModuleName) {
            return str;
        }
        let value = str;
        const match = Replacer.getImportMath(config.newModuleName, str);

        if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
            value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')),
                '\'' + (config.newModule || config.newModuleName) + '\'');
        } else {
            const imports: string[] = [];
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
                    value = Replacer.addedInImport(value, match, importReplacer);
                } else {
                    let newImport = `\'${config.moduleName}\'`;
                    if (config.controlName) {
                        newImport += `;\nimport {${importReplacer.control}${importReplacer.control !== importReplacer.name ? (' as ' + importReplacer.name) : ''}} from '${config.newModuleName}';`
                    }
                    value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')), newImport);
                    // Если накосячили немного с импортом, то удаляем лишнее
                    value = value.replace(';;', ';');
                }
            } else {
                // хз как подобное править
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

    private importReplacer(str: string, config: IConfig): string {
        const {controlName, newControlName, moduleName} = config;
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
                            } else {
                                value = value.replace((new RegExp('([^(.|/|:)])\\b' + importReplacer.control + '\\b([^(.|/|:)])')), '$1' + newControlName + '$2');
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
            });
            return value;
        }
        return str;
    }

    private textReplacer(str: string, config: IConfig): string {
        const {controlName, newControlName, moduleName, newModuleName} = config;
        const path = moduleName.split('/');
        const newPath: string[] = newModuleName.split('/');
        let value = str;
        let newName = newControlName;
        if (newName === '') {
            newName = newPath.at(-1) as string;
            newPath.pop();
        }

        SEPARATORS.forEach((separator) => {
            value = value.replace((new RegExp(path.join(separator.lib) + separator.control + controlName, 'g')),
                newPath.join(separator.lib) + (newControlName ? separator.control : separator.lib) + newName);
        });
        return value;
    }

    replaceControls(str: string, config: IConfig): string {
        let value = str;
        value = this.importReplacer(value, config);
        value = this.textReplacer(value, config);
        return value;
    }

    replaceOptions(str: string, config: IReplaceOpt): string {
        let value = str;
        const importsReplacer = this.importParse(str, config.control, config.module);
        if (importsReplacer) {
            importsReplacer.forEach(importReplacer => {
                if (importReplacer.name) {
                    value = value.replace(
                        (new RegExp('(<\\b' + importReplacer.name + '\\b(?:\\n|[^>])+?)\\b'
                            + config.thisOpt + '\\b((?:\\n|[^>])+?>)', 'g')),
                        '$1' + config.newOpt + '$2');
                } else {
                    value = value.replace(
                        (new RegExp('(<' + importReplacer.lib + '.' + importReplacer.control +
                            '\\b(?:\\n|[^>])+?)\\b' + config.thisOpt + '\\b((?:\\n|[^>])+?>)')),
                        '$1' + config.newOpt + '$2');
                }
            });
        }

        const path = config.module.split('/');
        SEPARATORS.forEach((separator) => {
            value = value.replace(
                (new RegExp(('(' + path.join(separator.lib) + separator.control + config.control + '\\b(?:\\n|[^>])+?)\\b'
                    + config.thisOpt + '\\b((?:\\n|[^>])+?>)'), 'g')),
                '$1' + config.newOpt + '$2');
        });

        return value;
    }

    customReplace(str: string, config: ICustomReplace): string {
        return str.replace((new RegExp(config.reg, config.flag || 'g')), config.replace);
    }

    clearErrors(): void {
        this.errors = [];
    }

    getErrors(): IError[] {
        return this.errors;
    }
}