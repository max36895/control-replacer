import { EXCLUDE_DIRS } from "./Script";
import { FileUtils } from "./FileUtils";
import * as childProcess from 'child_process';

const REP_FILES = ['README.md', 'package.json', '.gitignore'];

export function resetGit(path: string): void {
    const dirs = FileUtils.getDirs(path);
    let isRep = false;
    dirs.forEach(dir => {
        if (REP_FILES.includes(dir)) {
            isRep = true;
        }
    })
    if (isRep) {
        childProcess.execSync(`cd ${path} && git reset --hard`);
        return;
    } else {
        dirs.forEach((dir) => {
            const newPath = path + '/' + dir;
            if (EXCLUDE_DIRS.includes(dir)) {
                return;
            }
            if (FileUtils.isDir(newPath)) {
                resetGit(newPath);
            }
        });
    }
}