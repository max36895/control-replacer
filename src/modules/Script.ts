import {FileUtils} from './FileUtils';
import {Replacer} from './Replacer';
import {IError, IParam} from "../interfaces/IConfig";

export const EXCLUDE_DIRS = ['node_modules', '.git', '.idea', 'build-ui', 'wasaby-cli_artifacts'];

export class Script {
    private replacer: Replacer = new Replacer;
    private errors: IError[] = [];

    private script(param: IParam, path: string) {
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

                                    newFileContent = this.replacer.replace(newFileContent, {
                                        controlName, newControlName,
                                        moduleName, newModuleName,
                                        newModule: replace.newModule,
                                        thisContext: newPath
                                    });
                                }
                            });
                        });
                        if (fileContent !== newFileContent) {
                            console.log(`Обновляю файл ${newPath}`);
                            FileUtils.fwrite(newPath, newFileContent);
                        } else {
                            let searchedModule = '';
                            // Примитивная проверка на поиск вхождений. Возможно потом стоит либо забить, либо сделать лучше
                            param.replaces.forEach((replace) => {
                                if (fileContent.includes(replace.module)) {
                                    searchedModule = replace.module;
                                }
                            })
                            if (searchedModule) {
                                // Возможно стоит заигнорить просто и ничего не выводить
                                console.log(`В файле "${newPath}" найдены вхождения этого модуля "${searchedModule}", но скрипт не смог их обработать`);
                                this.errors.push({
                                    fileName: newPath,
                                    comment: 'Найдены вхождения для модуля "' + searchedModule + '", но скрипт не смог ничего сделать с ними. Возможно можно проигнорировать это предупреждение',
                                    date: (new Date())
                                });
                            } else {
                                //console.log(`- ${newPath} нечего править`);
                            }
                        }
                    } else {
                        console.error(`Файл "${newPath}" много весит(${size}MB). Пропускаю его!`);
                        this.errors.push({
                            fileName: newPath,
                            comment: `Файл много весит(${size}MB).`,
                            date: (new Date())
                        });
                    }
                } catch (e) {
                    this.errors.push({
                        date: (new Date()),
                        fileName: newPath,
                        comment: (e as Error).message
                    });
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

        })
        FileUtils.fwrite((errorDir + '/' + 'logs.log'), errorContent, 'w');
        console.error(`При выполнении скрипта были обнаружены ошибки. Подробнее смотри в: ${errorDir}/logs.log`);
    }

    run(param: IParam) {
        console.log('script start');
        console.log('=================================================================');
        this.errors = [];
        this.replacer.clearErrors();

        const correctParam = Script.getCorrectParam(param);

        this.script(correctParam, param.path);
        this.errors = [...this.errors, ...this.replacer.getErrors()];
        if (this.errors.length) {
            this.saveLog();
        }
        console.log('=================================================================')
        console.log('script end');
    }

    static getCorrectParam(param: IParam) {
        const correctParam: IParam = {
            path: param.path,
            replaces: param.replaces,
            maxFileSize: param.maxFileSize || 50
        };
        return correctParam;
    }
}