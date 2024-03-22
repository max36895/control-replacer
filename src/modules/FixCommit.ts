import * as childProcess from 'child_process';
import { success } from './logger';
import { executeInRep } from '../utils/executeInRep';

const NOT_PUSHED_MSG = 'unknown revision or path not in the working tree.';

function isPushed(stdout: string): boolean {
  if (stdout) {
    const msg = stdout.split('\n');
    return msg[0].includes(NOT_PUSHED_MSG) || msg[1]?.includes(NOT_PUSHED_MSG);
  }
  return false;
}

function gitReset(path: string): void {
  childProcess.execSync(`cd "${path}" &&  git reset --soft HEAD~`);
  success(`Коммит по пути: "${path}" успешно отменен`);
}

// Смотри на наличие изменений в гит, и если они есть, то сбрасывает коммит, чтобы скрипт для создания mr смог их снова обработать
export function fixCommit(dir: string): void {
  executeInRep(dir, (path) => {
    const gitStatus = childProcess.execSync(`cd "${path}" && git status`);
    if (gitStatus.toString().includes('use "git push"')) {
      gitReset(path);
    } else {
      // Способ выше работает в том случае, если есть удаленная ветка с таким же названием.
      // Поэтому если не удалось найти изменения, то получаем имя ветки,
      // а далее через git log смотрим наличие ошибки в консоли, что такой удаленной ветки нет.
      const gitBranch = childProcess
        .execSync(`cd "${path}" && git branch -v`)
        .toString()
        .match(/\* ([^ |\n]+)/)?.[1];
      if (gitBranch) {
        let isPush;
        try {
          isPush = isPushed(
            childProcess.execSync(`cd "${path}" && git log origin/${gitBranch}`, { stdio: "pipe" }).toString()
          );
        } catch (e) {
          // На случай, если гит кинул ответ через ошибку
          isPush = isPushed((e as Error).message);
        }
        if (isPush) {
          gitReset(path);
        }
      }
    }
  });
}
