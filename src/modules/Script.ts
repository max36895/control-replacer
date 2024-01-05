import { error, log, success, warning } from "./logger";
import { FileUtils } from "../utils/FileUtils";
import { Replacer } from "./Replacer";
import {
  IContext,
  ICSSReplace,
  ICustomReplace,
  TCustomCb,
  IError,
  IParam,
  IReplace,
  IReplaceOpt,
} from "../interfaces/IConfig";

export enum TypeReplacer {
  Controls = "controls",
  Options = "options",
  Custom = "custom",
  Css = "css",
}

export const EXCLUDE_DIRS = ["node_modules", ".git", ".idea", "build-ui", "wasaby-cli_artifacts"];

export class Script {
  private replacer: Replacer = new Replacer();
  private errors: IError[] = [];
  private customScripts: {
    [name: string]: TCustomCb | undefined;
  } = {};

  private _controlsReplace(replace: IReplace, newFileContent: string, newPath: string) {
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

  private _optionsReplace(replace: IReplaceOpt, newFileContent: string) {
    return this.replacer.replaceOptions(newFileContent, replace);
  }

  static getCorrectParam<TReplacesOption>(param: IParam<TReplacesOption>): IParam<TReplacesOption> {
    return {
      path: param.path,
      replaces: param.replaces,
      maxFileSize: param.maxFileSize ?? 50,
    };
  }

  private async script<TReplacesOption>(
    param: IParam<TReplacesOption>,
    path: string,
    type: TypeReplacer = TypeReplacer.Controls
  ) {
    const dirs = FileUtils.getDirs(path);
    for (const dir of dirs) {
      const newPath = path + "/" + dir;
      if (EXCLUDE_DIRS.includes(dir)) {
        continue;
      }
      if (FileUtils.isDir(newPath)) {
        await this.script(param, newPath, type);
      } else {
        // На случай если нет прав на чтение или запись в директорию
        try {
          const fileSize = FileUtils.fileSize(newPath, "mb");

          // @ts-ignore
          if (fileSize < param.maxFileSize) {
            const fileContent = FileUtils.read(newPath);
            let newFileContent = fileContent;
            for (const replace of param.replaces) {
              switch (type) {
                case TypeReplacer.Controls:
                  newFileContent = this._controlsReplace(replace as IReplace, newFileContent, newPath);
                  break;
                case TypeReplacer.Options:
                  newFileContent = this._optionsReplace(replace as IReplaceOpt, newFileContent);
                  break;
                case TypeReplacer.Custom:
                  if ((replace as ICustomReplace).scriptPath) {
                    const scriptPath = (replace as ICustomReplace).scriptPath as string;
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
                      } else {
                        this.errors.push({
                          fileName: scriptPath,
                          comment: `Не удалось найти файл "${scriptPath}", для запуска скрипта`,
                          date: new Date(),
                        });
                        this.customScripts[scriptPath] = undefined;
                      }
                    }

                    if (typeof this.customScripts[scriptPath] === "function") {
                      newFileContent = this.replacer.customScriptReplace(
                        {
                          path,
                          file: dir,
                          fileContent: newFileContent,
                        },
                        this.customScripts[scriptPath] as TCustomCb
                      );
                    }
                  } else {
                    newFileContent = this.replacer.customReplace(newFileContent, replace as ICustomReplace);
                  }
                  break;
                case TypeReplacer.Css:
                  newFileContent = this.replacer.cssReplace(newFileContent, replace as ICSSReplace & IContext);
                  break;
              }
            }
            if (fileContent !== newFileContent) {
              success(`Обновляю файл: ${newPath}`);
              FileUtils.write(newPath, newFileContent);
            } /* 
            else {
              // todo предупреждение вводит людей в ступор.
              // На данный момент скрипт отрабатывает корректно во всех случаях.
              // Писать более сложную проверку пока не стоит.
              // Если вылезут проблемы, то будут доработаны юниты
              
              if (type === TypeReplacer.Controls) {
                (param.replaces as IReplace[]).forEach((replace) => {
                  if (fileContent.includes(replace.module)) {
                    for (let i = 0; i < replace.controls.length; i++) {
                      const findName = replace.controls[i].name;
                      if (!findName || fileContent.includes(findName)) {
                        this.errors.push({
                          fileName: newPath,
                          comment:
                            'Найдены вхождения для модуля "' +
                            replace.module +
                            '", но скрипт не смог ничего сделать. Возможно можно проигнорировать это предупреждение.',
                          date: new Date(),
                        });
                        break;
                      }
                    }
                  }
                });
              }
              
            }
            */
          } else {
            warning(
              `Файл "${newPath}" весит ${fileSize}MB. Пропускаю его, так как стоит огрнаничение на ${param.maxFileSize}MB.`
            );
            this.errors.push({
              fileName: newPath,
              comment: `Файл весит ${fileSize}MB. Задано ограничение в ${param.maxFileSize}MB.`,
              date: new Date(),
            });
          }
        } catch (e) {
          this.errors.push({
            date: new Date(),
            fileName: newPath,
            comment: (e as Error).message,
          });
          error((e as Error).message);
        }
      }
    }
  }

  async run<TReplacesOption>(param: IParam<TReplacesOption>, type: TypeReplacer = TypeReplacer.Controls) {
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

  private saveLog() {
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
