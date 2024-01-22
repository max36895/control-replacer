import * as childProcess from "child_process";
import {success} from "./logger";
import {executeInRep} from "../utils/executeInRep";

const NOT_PUSHED_MSG = 'unknown revision or path not in the working tree.';

function isPushed(stdout: string): boolean {
  if (stdout) {
    const msgs = stdout.split('\n')
    return msgs[0].includes(NOT_PUSHED_MSG) || msgs[1]?.includes(NOT_PUSHED_MSG);
  }
  return false;
}

// Смотри на наличие изменений в гит, и если они есть, то сбрасывает коммит, чтобы скрипт для создания mr смог их снова обработать
export function fixCommit(dir: string): void {
  executeInRep(dir, (path) => {
    const fn = () => {
      childProcess.execSync(`cd "${path}" &&  git reset --soft HEAD~`);
      success(`Коммит по пути: ${path} успешно отменен`);
    }
    const gitStatus = childProcess.execSync(`cd "${path}" && git status`);
    if (gitStatus.toString().includes('use "git push"')) {
      fn();
    } else {
      // Способ выше работает в том случае, если есть удаленная ветка с таким же названием.
      // Поэтому если не удалось найти изменения, то получаем имя ветки,
      // а далее через git log смотрим наличие ошибки в консоли, что такой удаленной ветки нет.
      const gitBranch = childProcess.execSync(`cd "${path}" && git branch -v`).toString().match(/\* ([^ |\n]+)/)?.[1];
      if (gitBranch) {
        let isPush;
        try {
          isPush = isPushed(childProcess.execSync(
              `cd "${path}" && git log origin/${gitBranch}`,
              {stdio: 'pipe'}
          ).toString());
        } catch (e) {
          isPush = isPushed((e as Error).message);
        }
        if (isPush) {
          fn();
        }
      }
    }
  });
}
