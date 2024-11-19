import { error, log, success, warning } from './logger';
import { FileUtils } from '../utils/FileUtils';
import { Replacer } from './Replacer';
import {
    IContext,
    ICorrectParam,
    ICSSReplace,
    ICustomReplace,
    IError,
    IParam,
    IReplace,
    IReplaceOpt,
    IResult,
    TCustomCb,
    TReplace,
} from '../interfaces/IConfig';

export enum TypeReplacer {
    Controls = 'controls',
    Options = 'options',
    Custom = 'custom',
    Find = 'find',
    Css = 'css',
}

export const EXCLUDE_DIRS = ['node_modules', '.git', '.idea', 'build-ui', 'wasaby-cli_artifacts'];
const LINE_SEPARATOR = '='.repeat(75);

export class Script {
    private replacer: Replacer = new Replacer();
    private errors: IError[] = [];
    protected res: IResult[] = [];
    private customScripts: {
        [name: string]: TCustomCb | undefined;
    } = {};

    /**
     *
     * @param replace Конфиг для замены
     * @param newFileContent Содержимое файла
     * @param newPath Текущая директория, чтобы понимать в каком контексте идет обработка
     * @returns
     */
    private controlsReplace(replace: IReplace, newFileContent: string, newPath: string) {
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

    private async script<TReplacesOption>(
        param: ICorrectParam<TReplacesOption>,
        path: string,
        type: TypeReplacer = TypeReplacer.Controls,
    ) {
        const dirs = FileUtils.getDirs(path);
        for (const dir of dirs) {
            const newPath = `${path}/${dir}`;
            if (EXCLUDE_DIRS.includes(dir)) {
                continue;
            }
            if (FileUtils.isDir(newPath)) {
                await this.script(param, newPath, type);
            } else {
                // На случай если нет прав на чтение или запись в директорию
                try {
                    const fileSize = FileUtils.fileSize(newPath, 'mb');
                    if (fileSize < param.maxFileSize) {
                        const fileContent = FileUtils.read(newPath);
                        let newFileContent = fileContent;
                        for (const replace of param.replaces) {
                            switch (type) {
                                case TypeReplacer.Controls:
                                    newFileContent = this.controlsReplace(
                                        replace as IReplace,
                                        newFileContent,
                                        newPath,
                                    );
                                    break;
                                case TypeReplacer.Options:
                                    newFileContent = this.replacer.replaceOptions(
                                        newFileContent,
                                        replace as IReplaceOpt,
                                    );
                                    break;
                                case TypeReplacer.Find:
                                    this.res = [
                                        ...this.res,
                                        ...this.replacer.findOptions(
                                            newFileContent,
                                            replace as IReplaceOpt,
                                            newPath,
                                        ),
                                    ];
                                    break;
                                case TypeReplacer.Custom:
                                    if ((replace as ICustomReplace).scriptPath) {
                                        // Могут подключить множество кастомных скриптов, для замены, но некоторые могут пересекаться.
                                        // Поэтому сохраняем скрипты, чтобы не грузить их повторно.
                                        // Возможно эта оптимизация избыточна, но пусть лучше будет.
                                        const scriptPath = (replace as ICustomReplace)
                                            .scriptPath as string;
                                        if (!this.customScripts.hasOwnProperty(scriptPath)) {
                                            if (FileUtils.isFile(scriptPath)) {
                                                const res = await import(scriptPath);
                                                this.customScripts[scriptPath] = res.run;
                                                if (
                                                    typeof this.customScripts[scriptPath] !==
                                                    'function'
                                                ) {
                                                    this.addError(
                                                        scriptPath,
                                                        `В файле "${scriptPath}" отсутствует метод run. См доку на github.`,
                                                        true,
                                                    );
                                                }
                                            } else {
                                                this.addError(
                                                    scriptPath,
                                                    `Не удалось найти файл "${scriptPath}", для запуска скрипта`,
                                                    true,
                                                );
                                                this.customScripts[scriptPath] = undefined;
                                            }
                                        }

                                        // Если передали кастомный скрипт, то отрабатываем через него.
                                        // В противном случае считаем что передана регулярка.
                                        if (typeof this.customScripts[scriptPath] === 'function') {
                                            newFileContent = this.replacer.customScriptReplace(
                                                {
                                                    path,
                                                    file: dir,
                                                    fileContent: newFileContent,
                                                },
                                                this.customScripts[scriptPath] as TCustomCb,
                                            );
                                        }
                                    } else {
                                        newFileContent = this.replacer.customRegReplace(
                                            newFileContent,
                                            replace as ICustomReplace,
                                        );
                                    }
                                    break;
                                case TypeReplacer.Css:
                                    newFileContent = this.replacer.cssReplace(
                                        newFileContent,
                                        replace as ICSSReplace & IContext,
                                    );
                                    break;
                            }
                        }
                        if (fileContent !== newFileContent) {
                            success(`Обновляю файл: "${newPath}"`);
                            FileUtils.write(newPath, newFileContent);
                        }
                    } else {
                        this.addError(
                            newPath,
                            `Файл "${newPath}" весит ${fileSize}MB. Пропускаю его, так как стоит ограничение в ${param.maxFileSize}MB.`,
                        );
                    }
                } catch (e) {
                    this.addError(newPath, (e as Error).message, true);
                }
            }
        }
    }

    async run<TReplacesOption>(
        param: IParam<TReplacesOption>,
        type: TypeReplacer = TypeReplacer.Controls,
    ) {
        log('script start');
        log(LINE_SEPARATOR);
        this.errors = [];
        this.res = [];
        this.replacer.clearErrors();
        await this.script(Script.getCorrectParam(param), param.path, type);
        this.errors = [...this.errors, ...this.replacer.getErrors()];
        if (this.errors.length) {
            this.saveLog();
        }
        if (this.res.length) {
            this.saveInfo(param.path, param.branch);
        }
        log(LINE_SEPARATOR);
        log('script end');
    }

    protected addError(fileName: string, msg: string, isError: boolean = false) {
        const comment = `file: "${fileName}";\n info:\n ${msg}`;
        if (isError) {
            error(comment);
        } else {
            warning(comment);
        }
        this.errors.push({
            fileName,
            comment: msg,
            date: new Date(),
            isError,
        });
    }

    private saveInfo(path: string, branch?: string) {
        const infoDir = './info';
        if (!FileUtils.isDir(infoDir)) {
            FileUtils.mkDir(infoDir);
        }
        let infoContent = `Найдено вхождений: ${this.res.length}`;
        this.res.forEach((res) => {
            const fileDir = res.fileName.replace(path + '/storage/', '');
            const paths = fileDir.split('/');
            let branchName;
            if (branch) {
                const bInfo = branch.match(/((rc-)?\d{1,2}\.)(.*)/);
                if (bInfo) {
                    branchName = bInfo[1] + (+bInfo[3] % 1000 ? bInfo[3] : Number(bInfo[3]) + 100);
                } else {
                    branchName = branch;
                }
            }
            let rep = `${paths[0]}/${paths[1]}/-/tree${branchName}`;
            for (let i = 2; i < paths.length; i++) {
                rep += '/' + paths[i];
            }
            infoContent += `\n${LINE_SEPARATOR}`;
            infoContent += `\n\tКонтрол: ${res.controlName}`;
            infoContent += `\n\tФайл: ${res.fileName}`;
            infoContent += `\n\tgit: https://git.sbis.ru/${rep}`;
            infoContent += `\n${LINE_SEPARATOR}\n`;
        });
        const fileName = Date.now();
        const infoFile = `${infoDir}/${fileName}.log`;
        FileUtils.write(infoFile, infoContent, 'w');
    }

    private saveLog() {
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

    static getCorrectParam<TReplacesOption extends TReplace = TReplace>(
        param: IParam<TReplacesOption>,
    ): ICorrectParam<TReplacesOption> {
        return {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize ?? 50,
        };
    }
}
