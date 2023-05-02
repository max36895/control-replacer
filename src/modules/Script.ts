import { FileUtils } from './FileUtils';
import { Replacer } from './Replacer';
import { IContext, ICSSReplace, ICustomReplace, IError, IParam, IReplace, IReplaceOpt } from "../interfaces/IConfig";
import { log, success, error, warning } from "./logger";

export type TypeReplacer = 'controls' | 'options' | 'custom' | 'css';

type IReplacerOpt = IReplace | IReplaceOpt | ICustomReplace | ICSSReplace;

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

    private script(param: IParam<IReplacerOpt>, path: string, type: TypeReplacer = 'controls') {
        const dirs = FileUtils.getDirs(path);
        dirs.forEach((dir) => {
            const newPath = path + '/' + dir;
            if (EXCLUDE_DIRS.includes(dir)) {
                return;
            }
            if (FileUtils.isDir(newPath)) {
                this.script(param, newPath, type);
            } else {
                // На случай если нет прав на чтение или запись в директорию
                try {
                    const size = FileUtils.fileSize(newPath, 'mb')

                    // @ts-ignore
                    if (size < param.maxFileSize) {
                        const fileContent = FileUtils.fread(newPath);
                        let newFileContent = fileContent;
                        param.replaces.forEach((replace) => {
                            switch (type) {
                                case 'controls':
                                    newFileContent = this._controlsReplace(replace as IReplace, newFileContent, newPath);
                                    break;
                                case 'options':
                                    newFileContent = this._optionsReplace(replace as IReplaceOpt, newFileContent);
                                    break;
                                case 'custom':
                                    newFileContent = this.replacer.customReplace(newFileContent, replace as ICustomReplace);
                                    break;
                                case 'css':
                                    newFileContent = this.replacer.cssReplace(newFileContent, replace as ICSSReplace & IContext);
                                    break;
                            }
                        });
                        if (fileContent !== newFileContent) {
                            success(`Обновляю файл: ${newPath}`);
                            FileUtils.fwrite(newPath, newFileContent);
                        } else {
                            if (type === "controls") {
                                // Довольно примитивная проверка на поиск вхождений.
                                // Тупо ищем что есть имя модуля и название для переименовывания.
                                // Возможно потом стоит либо забить, либо сделать лучше
                                (param.replaces as IReplace[]).forEach((replace) => {
                                    if (fileContent.includes(replace.module)) {
                                        for (let i = 0; i < replace.controls.length; i++) {
                                            const findName = replace.controls[i].name;
                                            if (!findName || fileContent.includes(findName)) {
                                                this.errors.push({
                                                    fileName: newPath,
                                                    comment: 'Найдены вхождения для модуля "' + replace.module + '", но скрипт не смог ничего сделать. Возможно можно проигнорировать это предупреждение.',
                                                    date: (new Date())
                                                });
                                                break;
                                            }
                                        }
                                    }
                                });
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

    run(param: IParam<IReplacerOpt>, type: TypeReplacer = 'controls') {
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

    static getCorrectParam(param: IParam<IReplacerOpt>) {
        const correctParam: IParam<IReplacerOpt> = {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize || 50
        };
        return correctParam;
    }
}