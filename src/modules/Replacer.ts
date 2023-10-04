import { IConfig, IContext, ICSSReplace, ICustomReplace, IError, IReplaceOpt } from '../interfaces/IConfig';

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

    /**
     * Ищет нужный импорт по названию модуля
     * @param moduleName
     * @param str
     * @private
     */
    private static getImportMatch(moduleName: string, str: string): RegExpMatchArray[] {
        const reg = new RegExp(`^import(\\n|[^('|")]+?)from ['|"]${moduleName}['|"];?$`, 'umg');
        return [...str.matchAll(reg)];
    }

    /**
     * Добавляет новый импорт по необходимости.
     * @param str
     * @param match
     * @param importReplacer
     * @private
     */
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

    /**
     * Осуществляет замену контролов
     * @param str
     * @param config
     */
    replaceControls(str: string, config: IConfig & IContext): string {
        let value = str;
        value = this.importReplacer(value, config);
        value = this.textReplacer(value, config);
        return value;
    }

    /**
     * Осуществляет замену для опций
     * @param str
     * @param config
     */
    replaceOptions(str: string, config: IReplaceOpt): string {
        let value = str;
        const importsReplacer = this.importParse(str, config.control, config.module);

        if (importsReplacer) {
            importsReplacer.forEach(importReplacer => {
                if (importReplacer.name) {
                    value = value.replace(
                        (new RegExp('(<\\b' + importReplacer.name + '\\b(?:\\n|[^>])+?)\\b'
                            + config.thisOpt + '\\b((?:\\n|[^>])+?>)', 'g')),
                        '$1' + config.newOpt + '$2'
                    );
                } else {
                    value = value.replace(
                        (new RegExp('(<' + importReplacer.lib + '.' + importReplacer.control +
                            '\\b(?:\\n|[^>])+?)\\b' + config.thisOpt + '\\b((?:\\n|[^>])+?>)')),
                        '$1' + config.newOpt + '$2'
                    );
                }
            });
        }

        const path = config.module.split('/');
        SEPARATORS.forEach((separator) => {
            value = value.replace(
                (new RegExp(
                        (
                            '(' + path.join(separator.lib) + separator.control + config.control + '\\b(?:\\n|[^>])+?)\\b'
                            + config.thisOpt + '\\b((?:\\n|[^>])+?>)'
                        ), 'g')
                ),
                '$1' + config.newOpt + '$2'
            );
        });

        return value;
    }

    /**
     * Осуществляет замену для css-переменных и классов
     * @param str
     * @param config
     */
    cssReplace(str: string, config: ICSSReplace & IContext): string {
        let value = str;
        const isCssVar = config.varName.indexOf('--') === 0;
        const isClassName = config.varName.includes('.');

        if (config.isRemove || (isClassName && !config.newVarName)) {
            if (isCssVar) {
                value = value.replace((new RegExp('(' + config.varName + ':[^;]+;)', 'g')), '');
            } else if (isClassName) {
                const reg = (new RegExp('(^\\' + config.varName + '[^}]+})', 'mg'));
                const find = value.match(reg);
                if (find) {
                    if ((find[0].match(/{/g) as string[]).length === 1) {
                        value = value.replace(reg, '');
                    } else {
                        this.errors.push({
                            fileName: config.thisContext,
                            comment: `Не удалось удалить класс ${config.varName}, так как у него есть вложенные элементы!`,
                            date: (new Date())
                        });
                    }
                } else {
                    if (value.match((new RegExp('(\\' + config.varName + '[^}]+})', 'mg')))) {
                        this.errors.push({
                            fileName: config.thisContext,
                            comment: `Не удалось удалить класс ${config.varName}, так как он используется в связке с другим классом!`,
                            date: (new Date())
                        });
                    }
                }
            } else {
                value = value.replace((new RegExp('(' + config.varName + ')', 'g')), '');
                return value;
            }
        }

        let find = config.varName;
        if (isCssVar) {
            find = '--\\b' + find.replace('--', '') + '\\b';
        } else if (isClassName) {
            find = '\\b' + config.varName.replace('.', '') + '\\b';
        } else {
            find = '\\b' + find + '\\b';
        }

        const replace = isClassName ? config.newVarName.replace('.', '') : config.newVarName;
        value = value.replace((new RegExp('(' + find + ')', 'g')), replace);

        return value;
    }

    /**
     * Пользовательская замена
     * @param str
     * @param config
     */
    customReplace(str: string, config: ICustomReplace): string {
        return str.replace((new RegExp(config.reg, config.flag || 'g')), config.replace);
    }

    /**
     * Парсит импорт, чтобы вернуть удобный для работы вид
     * @param str
     * @param controlName
     * @param moduleName
     * @private
     */
    private importParse(str: string, controlName: string, moduleName: string): IImportReplacer[] | null {
        // Если будет несколько экспортов из 1 либы в файле, то есть вероятность, что что-то может пойти не так
        const importsValue = Replacer.getImportMatch(moduleName, str);

        if (importsValue.length) {
            const paths: IImportReplacer[] = [];
            importsValue.forEach((importValue) => {
                if (importValue[1]) {
                    const correctImport = importValue[1].replace(/[\n|}|{]/g, ' ') as string;
                    const names = correctImport.split(',').map((val) => val.trim());

                    names.forEach((name) => {
                        const value = name.split(' ');
                        for (let i = 0; i < value.length; i++) {
                            const path: IImportReplacer = {
                                name: '',
                                control: '',
                                lib: '',
                                fullImport: importValue[0],
                                importNames: importValue[1],
                                importsList: names
                            };
                            if (value[i] === controlName) {
                                if (value[i + 1] === 'as') {
                                    path.name = value[i + 2];
                                    path.control = controlName;
                                } else {
                                    if (value[i - 1] !== 'as') {
                                        path.name = controlName;
                                        path.control = controlName;
                                    }
                                }
                            } else if (value[i] === '*') {
                                // Если записали таким образом, то скорей всего хотят импортировать все,
                                // но в таком случае может возникнуть проблема когда контрол превращается в модуль
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

    /**
     * Обновляет импорты. В случае необходимости добавляются импорты с новым модулем
     * @param str
     * @param importReplacer
     * @param config
     * @private
     */
    private updateImport(str: string, importReplacer: IImportReplacer, config: IConfig & IContext): string {
        if (config.moduleName === config.newModuleName) {
            return str;
        }

        let value = str;
        const match = Replacer.getImportMatch(config.newModuleName, str);

        if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
            value = value.replace((new RegExp('("|\')' + config.moduleName + '("|\')')),
                '\'' + (config.newModule || config.newModuleName) + '\'');
        } else {
            const imports: string[] = [];
            let startSeparator = '';
            let endSeparator = '';
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
                    // Если испортили импорт, то удаляем лишнее
                    value = value.replace(';;', ';');
                }
            } else {
                // непонятно как подобное править, поэтому просто кинем ошибку
                this.errors.push({
                    fileName: config.thisContext,
                    comment: `Используется сложный импорт(import * as ${importReplacer.lib} from \'${config.moduleName}\')! Не знаю как его правильно обработать!`,
                    date: (new Date())
                });
            }
        }

        let emptyImportMatch = Replacer.getImportMatch(config.moduleName, value);
        if (emptyImportMatch.length) {
            const emptyValue = emptyImportMatch[0][1].replace(/\n/g, '').trim();
            if (emptyValue === '' || emptyValue === '{}') {
                value = value.replace(emptyImportMatch[0][0] + '\n', '');
            }
        }

        return value;
    }

    /**
     * Производит полную замену импортов, включая имя модуля, или название экспортируемой переменной.
     * Также заменяет имя контрола, на то что в импорте для tsx файлов
     * Также приводи импорты к корректному виду
     * @param str
     * @param config
     * @private
     */
    private importReplacer(str: string, config: IConfig & IContext): string {
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
                    value = this.updateImport(value, importReplacer, config);
                    if (importReplacer.name) {
                        if (newControlName) {
                            if (importReplacer.name === importReplacer.control) {
                                value = value.replace(
                                    (new RegExp('\\b' + importReplacer.control + '\\b([^(/|\'|\")])', 'g')),
                                    newControlName + '$1');
                                value = value.replace(
                                    (new RegExp('\\b' + importReplacer.control + '\\b/>', 'g')),
                                    newControlName + '/>');
                            } else {
                                value = value.replace(
                                    (new RegExp('([^(.|/|:)])\\b' + importReplacer.control + '\\b([^(.|/|:)])')),
                                    '$1' + newControlName + '$2');
                            }
                        } else {
                            const reg = (new RegExp('\\b' + importReplacer.control + '\\b'));
                            if (importReplacer.name === importReplacer.control) {
                                // опасная штука, но по другому пока никак
                                value = value.replace(reg, ('default as ' + controlName));
                            } else {
                                value = value.replace(reg, ('default'));
                            }
                        }
                    } else {
                        value = value.replace(
                            (new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g')),
                            importReplacer.lib + '.' + newControlName);
                    }
                }
            });

            // Правим импорты только в том случае, если были какие-то изменения
            if (value !== str) {
                // Приводим все импорты к корректному ввиду import { name1, name2 } from '...';
                const reg = /import(\\n|[^('|")]+?)from ['|"][^('|")]+['|"];?/umg;
                const imports = [...value.matchAll(reg)];
                imports.forEach((imp) => {
                    if (imp[1] && imp[0].includes('{') && imp[0].includes('}')) {
                        let importName = imp[1]
                            .replace(/[{|}]/g, '')
                            .split(',')
                            .map((res) => {
                                return res.trim();
                            })
                            .join(', ');
                        const replaceValue = imp[0].replace(imp[1], ` { ${importName} } `);
                        value = value.replace(imp[0], replaceValue);
                    }
                });
            }
            return value;
        }

        return str;
    }

    /**
     * Заменяет все текстовые вхождения. В основном для wml и wml подобного синтаксиса
     * @param str
     * @param config
     * @private
     */
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
            value = value.replace(
                (new RegExp(path.join(separator.lib) + separator.control + controlName, 'g')),
                newPath.join(separator.lib) + (newControlName ? separator.control : separator.lib) + newName
            );
        });

        return value;
    }

    clearErrors(): void {
        this.errors = [];
    }

    getErrors(): IError[] {
        return this.errors;
    }
}