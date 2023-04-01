export interface IContext {
    thisContext: string;
}

export interface IControl {
    name: string;
    newName?: string;
    newModuleName?: string;
}

export interface ICustomReplace {
    reg: string;
    flag?: string;
    replace: string;
}

export interface ICSSReplace {
    varName: string;
    newVarName: string;
    isRemove?: boolean;
}

export interface IReplaceOpt {
    control: string;
    module: string;
    thisOpt: string;
    newOpt: string;
}

export interface IReplace {
    module: string;
    controls: IControl[];
    newModule?: string;
}

export interface IParam<R extends IReplace | IReplaceOpt | ICustomReplace | ICSSReplace = IReplace> {
    path: string;
    replaces: R[];
    maxFileSize?: number;
}

export interface IConfig {
    controlName: string,
    newControlName: string,
    moduleName: string;
    newModuleName: string;
    newModule?: string;
}

export interface IError {
    date: Date;
    fileName: string;
    comment: string;
}