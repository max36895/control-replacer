import { FileUtils } from './FileUtils';
import { Replacer } from './Replacer';
import { ICustomReplace, IError, IParam, IReplace, IReplaceOpt } from "../interfaces/IConfig";
import { log, success, error, warning } from "./logger";

export type TypeReplacer = 'controls' | 'options' | 'custom';

export const EXCLUDE_DIRS = ['node_modules', '.git', '.idea', 'build-ui', 'wasaby-cli_artifacts'];

export class Script {
    private replacer: Replacer = new Replacer;
    private errors: IError[] = [];

    private _controlsReplace(replace: IReplace, newFileContent: string, newPath: string) {
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

    private _optionsReplace(replace: IReplaceOpt, newFileContent: string) {
        return this.replacer.replaceOptions(newFileContent, replace);
    }

    private script(param: IParam<IReplace | IReplaceOpt | ICustomReplace>, path: string, type: TypeReplacer = 'controls') {
        const dirs = FileUtils.getDirs(path);
        dirs.forEach((dir) => {
            const newPath = path + '/' + dir;
            if (EXCLUDE_DIRS.includes(dir)) {
                return;
            }
            if (FileUtils.isDir(newPath)) {
                this.script(param, newPath)
            } else {
                // На случай если нет прав на чтение или запись в директорию
                try {
                    const size = FileUtils.fileSize(newPath, 'mb')

                    // @ts-ignore
                    if (size < param.maxFileSize) {
                        const fileContent = FileUtils.fread(newPath);
                        let newFileContent = fileContent;
                        param.replaces.forEach((replace) => {
                            if (type === "controls") {
                                newFileContent = this._controlsReplace(replace as IReplace, newFileContent, newPath)
                            } else if (type === 'options') {
                                newFileContent = this._optionsReplace(replace as IReplaceOpt, newFileContent);
                            } else if (type === 'custom') {
                                newFileContent = this.replacer.customReplace(newFileContent, replace as ICustomReplace);
                            }
                        });
                        if (fileContent !== newFileContent) {
                            success(`Обновляю файл: ${newPath}`);
                            FileUtils.fwrite(newPath, newFileContent);
                        } else {
                            if (type === "controls") {
                                let searchedModule = '';
                                // Примитивная проверка на поиск вхождений. Возможно потом стоит либо забить, либо сделать лучше
                                (param.replaces as IReplace[]).forEach((replace) => {
                                    if (fileContent.includes(replace.module)) {
                                        searchedModule = replace.module;
                                    }
                                })
                                if (searchedModule) {
                                    // Пока заигнорил, так как выводятся ложные срабатывания, которые засоряют консоль
                                    // Возможно стоит придумать более умный определитель
                                    // warning(`В файле "${newPath}" найдены вхождения этого модуля "${searchedModule}", но скрипт не смог их обработать`);
                                    this.errors.push({
                                        fileName: newPath,
                                        comment: 'Найдены вхождения для модуля "' + searchedModule + '", но скрипт не смог ничего сделать. Возможно можно проигнорировать это предупреждение.',
                                        date: (new Date())
                                    });
                                }
                            }
                        }
                    } else {
                        warning(`Файл "${newPath}" весит(${size}MB). Пропускаю его`);
                        this.errors.push({
                            fileName: newPath,
                            comment: `Файл весит(${size}MB).`,
                            date: (new Date())
                        });
                    }
                } catch (e) {
                    this.errors.push({
                        date: (new Date()),
                        fileName: newPath,
                        comment: (e as Error).message
                    });
                    error((e as Error).message);
                }
            }
        });
    }

    private saveLog() {
        const errorDir = './errors'
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
        const fileName = Date.now();
        FileUtils.fwrite((`${errorDir}/${fileName}.log`), errorContent, 'w');
        warning(`При выполнении скрипта были обнаружены ошибки. Подробнее в: ${errorDir}/${fileName}.log`);
    }

    run(param: IParam<IReplace | IReplaceOpt | ICustomReplace>, type: TypeReplacer = 'controls') {
        log('script start');
        log('=================================================================');
        this.errors = [];
        this.replacer.clearErrors();

        const correctParam = Script.getCorrectParam(param);

        this.script(correctParam, param.path, type);
        this.errors = [...this.errors, ...this.replacer.getErrors()];
        if (this.errors.length) {
            this.saveLog();
        }
        log('=================================================================')
        log('script end');
    }

    static getCorrectParam(param: IParam<IReplace | IReplaceOpt | ICustomReplace>) {
        const correctParam: IParam<IReplace | IReplaceOpt | ICustomReplace> = {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize || 50
        };
        return correctParam;
    }
}