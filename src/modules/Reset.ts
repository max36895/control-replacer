import * as childProcess from 'child_process';
import { executeInRep } from '../utils/executeInRep';

/**
 * Откат правок в репозитории. Используется если скрипт по полной накосячил, либо запушен с некорректным конфигом
 * @param dir
 */
export function resetGit(dir: string): void {
  executeInRep(dir, (path) => {
    childProcess.execSync(`cd ${path} && git reset --hard HEAD~`);
  });
}
