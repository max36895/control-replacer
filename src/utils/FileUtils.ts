const fs = require('fs');
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/**
 * Набор утилит для работы с файлами и папками
 */
export class FileUtils {
    static isFile(file: string): boolean {
        try {
            const stat = fs.lstatSync(file);
            return stat.isFile();
        } catch (e) {
            return false;
        }
    }

    static isDir(file: string): boolean {
        try {
            const stat = fs.lstatSync(file);
            return stat.isDirectory();
        } catch (e) {
            return false;
        }
    }

    static mkDir(path: string): void {
        fs.mkdirSync(path);
    }

    static read(fileName: string): string {
        return fs.readFileSync(fileName, 'utf-8');
    }

    static write(fileName: string, fileContent: string, mode: string = 'w'): void {
        if (mode === 'w') {
            fs.writeFileSync(fileName, fileContent);
        } else {
            fs.appendFileSync(fileName, fileContent);
        }
    }

    static fileSize(path: string, prefix: string = 'mb'): number {
        const stat = fs.statSync(path);
        let size = stat.size;
        switch (prefix) {
            case 'kb':
                size /= KB;
                break;
            case 'mb':
                size /= MB;
                break;
            case 'gb':
                size /= GB;
                break;
        }
        return size;
    }

    static getDirs(path: string): string[] {
        return fs.readdirSync(path);
    }
}
