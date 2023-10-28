export function log(str: string): void {
  console.log(str);
}

export function success(str: string): void {
  console.log("\x1b[32m", str, "\x1b[0m");
}

export function warning(str: string): void {
  console.log("\x1b[33m", str, "\x1b[0m");
}

export function error(str: string): void {
  console.log("\x1b[31m", str, "\x1b[0m");
}
