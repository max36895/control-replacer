import * as childProcess from "child_process";
import { EXCLUDE_DIRS } from "./Script";
import { FileUtils } from "./FileUtils";

const REP_FILES = ["README.md", "package.json", ".gitignore"];

export function resetGit(path: string): void {
  const dirFiles = FileUtils.getDirs(path);
  let isRep = false;
  dirFiles.forEach((dirFile) => {
    if (REP_FILES.includes(dirFile)) {
      isRep = true;
    }
  });
  if (isRep) {
    childProcess.execSync(`cd ${path} && git reset --hard HEAD~`);
    return;
  } else {
    dirFiles.forEach((dirFile) => {
      const newPath = path + "/" + dirFile;
      if (EXCLUDE_DIRS.includes(dirFile)) {
        return;
      }
      if (FileUtils.isDir(newPath)) {
        resetGit(newPath);
      }
    });
  }
}
