import {
    IConfig,
    IContext,
    ICSSReplace,
    ICustomReplace,
    ICustomScriptParam,
    IError,
    IReplaceOpt,
    IResult,
    TCustomCb,
} from '../interfaces/IConfig';
import { warning } from './logger';

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

export class Replacer {
    errors: IError[] = [];

    /**
     * Поиск импорта по названию модуля
     * @param moduleName Имя модуля/библиотеки, которую нужно найти
     * @param str Содержимое для обработки
     * @private
     */
    private static getImportMatch(moduleName: string, str: string): RegExpMatchArray[] {
        return [
            ...str.matchAll(
                new RegExp(`^import(\\n|[^('|")]+?)from ['|"]${moduleName}['|"];?$`, 'umg'),
            ),
        ];
    }

    /**
     * Добавление значение в импорт. Добавление происходит только в том случае, если ранее значения не было.
     * @param str Содержимое для обработки
     * @param match Обрабатываемый импорт
     * @param importReplacer Конфиг для замены
     * @private
     */
    private static addedInImport(
        str: string,
        match: RegExpMatchArray[],
        importReplacer: IImportReplacer,
    ): string {
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
            } else {
                updateImport.push(
                    `${startSeparator}${importReplacer.control} as ${importReplacer.name}${endSeparator}`,
                );
            }

            return str.replace(match[0][1], ` ${updateImport.join(', ')} `);
        }
        return str;
    }

    /**
     * Замена контролов
     * @param str Обрабатываемая строка
     * @param config Конфигурация для обработки
     */
    replaceControls(str: string, config: IConfig & IContext): string {
        return this.textReplacer(this.importReplacer(str, config), config);
    }

    /**
     * Замена опций компонента
     * @param str Обрабатываемая строка
     * @param config Конфигурация для обработки
     */
    replaceOptions(str: string, config: IReplaceOpt): string {
        const importsReplacer = this.importParse(str, config.control, config.module);
        const beforeReg = '\\b(?:\\n|[^>])+?)\\b';
        const afterReg = '\\b((?:\\n|[^>])+?>)';

        if (importsReplacer) {
            importsReplacer.forEach((importReplacer) => {
                if (importReplacer.name) {
                    str = str.replace(
                        new RegExp(
                            '(<\\b' + importReplacer.name + beforeReg + config.thisOpt + afterReg,
                            'g',
                        ),
                        `$1${config.newOpt}$2`,
                    );
                } else {
                    str = str.replace(
                        new RegExp(
                            `(<${importReplacer.lib}.${importReplacer.control}${beforeReg}${config.thisOpt}${afterReg}`,
                        ),
                        `$1${config.newOpt}$2`,
                    );
                }
            });
        }

        const path = config.module.split('/');
        // Замена для wml для всех сценариев
        SEPARATORS.forEach((separator) => {
            // Такой вариант немного производительнее и стабильнее чем собирать 1 большую регулярку
            str = str.replace(
                new RegExp(
                    '(<' +
                        path.join(separator.lib) +
                        separator.control +
                        config.control +
                        beforeReg +
                        config.thisOpt +
                        afterReg,
                    'g',
                ),
                `$1${config.newOpt}$2`,
            );
        });

        return str;
    }

    findOptions(str: string, config: IReplaceOpt, fileName: string): IResult[] {
        if (!fileName.match(/\.wml\b|\.js\b|\.jsx\b|\.ts\b|\.tsx\b/)) {
            return [];
        }
        const importsReplacer = this.importParse(str, config.control, config.module);
        const beforeReg = '\\b(?:\\n|[^>])+?)\\b';
        const afterReg = '\\b((?:\\n|[^>])+?>)';
        const results: IResult[] = [];

        if (importsReplacer) {
            importsReplacer.forEach((importReplacer) => {
                if (importReplacer.name) {
                    const find = str.match(
                        new RegExp(
                            '(<\\b' + importReplacer.name + beforeReg + config.thisOpt + afterReg,
                            'g',
                        ),
                    );
                    if (find) {
                        results.push({
                            controlName: importReplacer.name,
                            fileName,
                        });
                    }
                } else {
                    const find = str.match(
                        new RegExp(
                            `(<${importReplacer.lib}.${importReplacer.control}${beforeReg}${config.thisOpt}${afterReg}`,
                        ),
                    );
                    if (find) {
                        results.push({
                            controlName: importReplacer.name,
                            fileName,
                        });
                    }
                }
            });
        }

        const path = config.module.split('/');
        // Замена для wml для всех сценариев
        SEPARATORS.forEach((separator) => {
            // Такой вариант немного производительнее и стабильнее чем собирать 1 большую регулярку
            const find = str.match(
                new RegExp(
                    '(<' +
                        path.join(separator.lib) +
                        separator.control +
                        config.control +
                        beforeReg +
                        config.thisOpt +
                        afterReg,
                    'g',
                ),
            );
            if (find) {
                results.push({
                    controlName: config.control,
                    fileName,
                });
            }
        });
        return results;
    }

    /**
     * Осуществляет замену для css-переменных и классов
     * @param str Обрабатываемая строка
     * @param config Конфигурация для обработки
     */
    cssReplace(str: string, config: ICSSReplace & IContext): string {
        const isCssVar = config.varName.indexOf('--') === 0;
        const isClassName = config.varName.includes('.');

        if (config.isRemove || (isClassName && !config.newVarName)) {
            if (isCssVar) {
                str = str.replace(new RegExp(`((\\n[^-]+|\\n)?${config.varName}:[^;]+;)`, 'g'), '');
            } else if (isClassName) {
                const reg = new RegExp('(^\\' + config.varName + '[^}]+})', 'mg');
                const find = str.match(reg);
                if (find) {
                    if ((find[0].match(/{/g) as string[]).length === 1) {
                        str = str.replace(reg, '');
                    } else {
                        this.addError(
                            config.thisContext,
                            `Не удалось удалить класс ${config.varName}, так как у него есть вложенные классы.`,
                        );
                    }
                } else {
                    if (str.match(new RegExp('(\\' + config.varName + '[^}]+})', 'mg'))) {
                        this.addError(
                            config.thisContext,
                            `Не удалось удалить класс ${config.varName}, так как он используется в связке с другим классом.`,
                        );
                    }
                }
            } else {
                return str.replace(new RegExp(`(${config.varName})`, 'g'), '');
            }
        }

        let find = config.varName;
        if (isCssVar) {
            find = `--\\b${find.replace('--', '')}\\b`;
        } else if (isClassName) {
            find = `\\b${find.replace('.', '')}\\b`;
        } else {
            find = `\\b${find}\\b`;
        }

        const replace = isClassName ? config.newVarName.replace('.', '') : config.newVarName;
        return str.replace(new RegExp(`(${find})`, 'g'), replace);
    }

    /**
     * Пользовательская замена через свою регулярку
     * @param str Обрабатываемая строка
     * @param config Конфигурация для обработки
     */
    customRegReplace(str: string, config: ICustomReplace): string {
        if (config.reg) {
            return str.replace(new RegExp(config.reg, config.flag || 'g'), config.replace);
        }
        return str;
    }

    /**
     * Пользовательская замена через свой скрипт
     * @param config Конфигурация для обработки
     * @param customScript Кастомный скрипт
     * @returns
     */
    customScriptReplace(config: ICustomScriptParam, customScript: TCustomCb): string {
        if (customScript) {
            const res = customScript(config);
            if (res.status) {
                return res.result as string;
            } else if (res.error) {
                this.addError(config.file, res.error, true);
            }
        }
        return config.fileContent;
    }

    /**
     * Парсит импорты, находя нужный, возвращая в удобном для работы виде
     * @param str Обрабатываемая строка
     * @param controlName Имя контрола/компонента
     * @param moduleName Имя модуля
     * @private
     */
    private importParse(
        str: string,
        controlName: string,
        moduleName: string,
    ): IImportReplacer[] | null {
        // Если будет несколько экспортов из 1 либы в файле, то есть вероятность, что что-то может пойти не так
        const importsValue = Replacer.getImportMatch(moduleName, str);

        if (importsValue.length) {
            const paths: IImportReplacer[] = [];
            importsValue.forEach((importValue) => {
                if (importValue[1]) {
                    const correctImport = importValue[1].replace(/[\n}{]/g, ' ') as string;
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
                                importsList: names,
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
     * @param str Обрабатываемая строка
     * @param importReplacer Обрабатываемый импорт
     * @param config Конфигурация для обработки
     * @private
     */
    private updateImport(
        str: string,
        importReplacer: IImportReplacer,
        config: IConfig & IContext,
    ): string {
        if (config.moduleName === config.newModuleName) {
            return str;
        }
        const moduleNameReg = new RegExp(`[\"']${config.moduleName}[\"']`);

        const match = Replacer.getImportMatch(config.newModuleName, str);
        if ((importReplacer.importsList.length === 1 && !match.length) || config.newModule) {
            str = str.replace(moduleNameReg, `'${config.newModule || config.newModuleName}'`);
        } else {
            const imports: string[] = [];
            let startSeparator = '';
            let endSeparator = '';
            if (importReplacer.name) {
                importReplacer.importNames.split(',').forEach((imp) => {
                    // Если импорта нет, то добавляем его. В противном случае добавляем значение в существующий импорт
                    if (!new RegExp(`\\b${importReplacer.control}\\b`).test(imp)) {
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
                str = str.replace(
                    importReplacer.importNames,
                    startSeparator + imports.join(', ') + endSeparator,
                );

                if (match.length) {
                    str = Replacer.addedInImport(str, match, importReplacer);
                } else {
                    let newImport = `\'${config.moduleName}\'`;
                    if (config.controlName) {
                        newImport += `;\nimport {${importReplacer.control}${
                            importReplacer.control !== importReplacer.name
                                ? ' as ' + importReplacer.name
                                : ''
                        }} from '${config.newModuleName}';`;
                    }
                    str = str.replace(moduleNameReg, newImport);
                    // Если при обработке испортили импорт, то удаляем лишнее
                    str = str.replace(';;', ';');
                }
            } else {
                // непонятно как подобное править, поэтому просто кинем ошибку
                this.addError(
                    config.thisContext,
                    `Используется сложный импорт(import * as ${importReplacer.lib} from \'${config.moduleName}\'). Скрипт не знает как его правильно обработать!`,
                );
            }
        }

        // Может произойти так, что после обработке появился пустой импорт. Поэтому проверяем этот момент, удаляя все лишнее.
        let emptyImportMatch = Replacer.getImportMatch(config.moduleName, str);
        if (emptyImportMatch.length) {
            const importValue = emptyImportMatch[0][1].replace(/\n/g, '').trim();
            if (importValue === '' || importValue === '{}') {
                str = str.replace(emptyImportMatch[0][0] + '\n', '');
            }
        }

        return str;
    }

    /**
     * Производит полную замену импортов. Заменяя имя модуля, или название экспортируемой переменной.
     * Также заменяет имя контрола в обрабатываемой строке, на то что указано в импорте
     * Также приводи импорты к корректному виду, удаляя все лишнее
     * @param str Обрабатываемая строка
     * @param config Конфигурация для обработки
     * @private
     */
    private importReplacer(str: string, config: IConfig & IContext): string {
        const { controlName, newControlName, moduleName } = config;
        if (controlName === '*') {
            return str.replace(
                new RegExp(`[\"']${moduleName}[\"']`, 'g'),
                "'" + config.newModuleName + "'",
            );
        }
        if (moduleName[moduleName.length - 1] === '*') {
            const correctModuleName = moduleName.replace('/*', '');
            const correctNewModuleName = config.newModuleName.replace('/*', '');
            return str.replace(
                new RegExp('(["\'])' + correctModuleName, 'g'),
                '$1' + correctNewModuleName,
            );
        }
        const importsReplacer = this.importParse(str, controlName, moduleName);
        if (importsReplacer) {
            let value = str;
            importsReplacer.forEach((importReplacer) => {
                let reg;
                if (!importReplacer.name) {
                    reg = new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g');
                } else {
                    reg = new RegExp(importReplacer.control);
                }

                if (reg.test(str)) {
                    value = this.updateImport(value, importReplacer, config);
                    if (importReplacer.name) {
                        if (newControlName) {
                            // Значения равны в том случае, если в импорте у компонента не меняется имя через as
                            // Так сделано для того, что обработка должна отличаться, так как если есть as, то нужно поправить только импорт.
                            if (importReplacer.name === importReplacer.control) {
                                const replace = newControlName + '$1';
                                value = value.replace(
                                    new RegExp(`\\b${importReplacer.control}\\b([^(/'\")])`, 'g'),
                                    replace,
                                );
                                // Нельзя использовать замену \\b${importReplacer.control}\\b
                                // Ранее могла произойти замена импорта, либо есть модуль с этим именем,
                                // из-за чего замена может отработать не корректно
                                // Поэтому дополнительно заменяем различные утилиты, функций и компоненты
                                value = value.replace(
                                    new RegExp(`\\b${importReplacer.control}\\b((\\()|(/>))`, 'g'),
                                    replace,
                                );
                            } else {
                                value = value.replace(
                                    new RegExp(
                                        `([^(./:)])\\b${importReplacer.control}\\b([^(./:)])`,
                                    ),
                                    `$1${newControlName}$2`,
                                );
                            }
                        } else {
                            const replaceReg = new RegExp(`\\b${importReplacer.control}\\b`);
                            const rValue =
                                importReplacer.name === importReplacer.control
                                    ? `default as ${controlName}`
                                    : 'default';
                            const updateImportReplacer = this.importParse(
                                value,
                                importReplacer.control,
                                config.newModuleName,
                            );
                            if (updateImportReplacer && updateImportReplacer.length) {
                                value = value.replace(
                                    new RegExp(updateImportReplacer[0].fullImport),
                                    updateImportReplacer[0].fullImport.replace(replaceReg, rValue),
                                );
                            } else {
                                // Если контрол превращается в модуль, то идем по опасной ветке.
                                if (importReplacer.name === importReplacer.control) {
                                    // опасная штука, но по другому пока никак
                                    value = value.replace(reg, `default as ${controlName}`);
                                } else {
                                    value = value.replace(
                                        new RegExp(importReplacer.importNames),
                                        importReplacer.importNames.replace(replaceReg, rValue),
                                    );
                                }
                            }
                        }
                    } else {
                        value = value.replace(
                            new RegExp(importReplacer.lib + '\\.' + importReplacer.control, 'g'),
                            importReplacer.lib + '.' + newControlName,
                        );
                    }
                }
            });

            // Правим импорты только в том случае, если были какие-то изменения в обрабатываемой строке
            if (value !== str) {
                // Приводим все импорты к корректному ввиду import { name1, name2 } from '...';
                const reg = /import( type|)(\\n|[^('|")]+?)from ['|"][^('|")]+['|"];?/gmu;
                const imports = [...value.matchAll(reg)];
                imports.forEach((imp) => {
                    if (imp[2] && imp[0].includes('{') && imp[0].includes('}')) {
                        // Если в импорте есть переносы строки, то считаем вид корректным, и не пытаемся его как-то преобразовать
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

    /**
     * Заменяет все текстовые вхождения. В основном для wml и wml подобного синтаксиса.
     * Также заменяются моменты вида const module = required('...'),
     * и другие текстовые вхождения, которые хоть как-то соответствует условию для замены.
     * @param str Обрабатываемая строка
     * @param config Конфигурация для обработки
     * @private
     */
    private textReplacer(str: string, config: IConfig): string {
        const { controlName, newControlName, moduleName, newModuleName } = config;
        const path = moduleName.split('/');
        const newPath: string[] = newModuleName.split('/');
        let newName = newControlName;
        if (newName === '') {
            newName = newPath.at(-1) as string;
            newPath.pop();
        }

        SEPARATORS.forEach((separator) => {
            if (newName === '*') {
                if (separator.control === ':') {
                    return;
                }
            }

            // На случай когда весь модуль с содержимым переносится
            if (newName === '*' || moduleName[moduleName.length - 1] === '*') {
                const correctPath = moduleName.replace('/*', '').split('/');
                const correctNewPath = newModuleName.replace('/*', '').split('/');
                str = str.replace(
                    new RegExp('(<|"|\'|/|!)' + correctPath.join(separator.lib), 'g'),
                    '$1' + correctNewPath.join(separator.lib),
                );
            } else {
                str = str.replace(
                    new RegExp(path.join(separator.lib) + separator.control + controlName, 'g'),
                    newPath.join(separator.lib) +
                        (newControlName ? separator.control : separator.lib) +
                        newName,
                );
            }
        });

        return str;
    }

    protected addError(fileName: string, msg: string, isError: boolean = false) {
        warning(`file: "${fileName}";\n info:\n ${msg}`);
        this.errors.push({
            fileName,
            comment: msg,
            date: new Date(),
            isError,
        });
    }

    clearErrors(): void {
        this.errors = [];
    }

    getErrors(): IError[] {
        return this.errors;
    }
}
