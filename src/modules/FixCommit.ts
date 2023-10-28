import * as childProcess from "child_process";
import { EXCLUDE_DIRS } from "./Script";
import { FileUtils } from "./FileUtils";
import { success } from "./logger";

const REP_FILES = ["README.md", "package.json", ".gitignore"];

// Смотри на наличие изменений в гит, и если они есть, то сбрасывает коммит, чтобы скрипт для создания mr смог их снова обработать
export function fixCommit(path: string): void {
  const dirFiles = FileUtils.getDirs(path);
  let isRep = false;
  dirFiles.forEach((dirFile) => {
    if (REP_FILES.includes(dirFile)) {
      isRep = true;
    }
  });
  if (isRep) {
    const gitStatus = childProcess.execSync(`cd ${path} && git status`);
    if (gitStatus.toString().includes('use "git push"')) {
      childProcess.execSync(`cd ${path} && git reset --soft HEAD~`);
      success(`Коммит по пути: ${path} успешно отменен`);
    }
    return;
  } else {
    dirFiles.forEach((dirFile) => {
      const newPath = path + "/" + dirFile;
      if (EXCLUDE_DIRS.includes(dirFile)) {
        return;
      }
      if (FileUtils.isDir(newPath)) {
        fixCommit(newPath);
      }
    });
  }
}
