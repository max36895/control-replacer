import { EXCLUDE_DIRS } from "../modules/Script";
import { FileUtils } from "./FileUtils";

const REP_FILES = ["README.md", "package.json", ".gitignore"];

/**
 *
 * @param path Выполняем нужное действие в репозиторие
 * @param cb
 * @returns
 */
export function executeInRep(path: string, cb: (path: string) => void): void {
  const dirFiles = FileUtils.getDirs(path);
  let isRep = false;
  dirFiles.forEach((dirFile) => {
    if (REP_FILES.includes(dirFile)) {
      isRep = true;
    }
  });
  if (isRep) {
    cb(path);
    return;
  } else {
    dirFiles.forEach((dirFile) => {
      const newPath = path + "/" + dirFile;
      if (EXCLUDE_DIRS.includes(dirFile)) {
        return;
      }
      if (FileUtils.isDir(newPath)) {
        executeInRep(newPath, cb);
      }
    });
  }
}
