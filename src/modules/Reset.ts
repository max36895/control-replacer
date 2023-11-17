import * as childProcess from "child_process";
import { executeInRep } from "../utils/executeInRep";

export function resetGit(dir: string): void {
  executeInRep(dir, (path) => {
    childProcess.execSync(`cd ${path} && git reset --hard HEAD~`);
  });
}
