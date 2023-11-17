import * as childProcess from "child_process";
import { success } from "./logger";
import { executeInRep } from "../utils/executeInRep";

// Смотри на наличие изменений в гит, и если они есть, то сбрасывает коммит, чтобы скрипт для создания mr смог их снова обработать
export function fixCommit(dir: string): void {
  executeInRep(dir, (path) => {
    const gitStatus = childProcess.execSync(`cd ${path} && git status`);
    if (gitStatus.toString().includes('use "git push"')) {
      childProcess.execSync(`cd ${path} && git reset --soft HEAD~`);
      success(`Коммит по пути: ${path} успешно отменен`);
    }
  });
}
