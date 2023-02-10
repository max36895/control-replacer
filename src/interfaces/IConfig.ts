export interface IControl {
    name: string;
    newName?: string;
    newModuleName?: string;
}

export interface IReplace {
    module: string;
    controls: IControl[];
    newModule?: string;
}

export interface IParam {
    path: string;
    replaces: IReplace[];
    maxFileSize?: number;
}

export interface IConfig {
    controlName: string,
    newControlName: string,
    moduleName: string;
    newModuleName: string;
    newModule?: string;
    thisContext: string;
}

export interface IError {
    date: Date;
    fileName: string;
    comment: string;
}