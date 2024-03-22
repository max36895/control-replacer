export interface IContext {
  thisContext: string;
}

export interface IPath {
  path: string;
}

export interface IControl {
  name: string;
  newName?: string;
  newModuleName?: string;
}

export interface ICustomReplace {
  reg?: string;
  flag?: string;
  scriptPath?: string;
  replace: string;
}

export interface ICustomScriptResult {
  status: boolean;
  result?: string;
  error?: string;
}

export interface ICustomScriptParam extends IPath {
  file: string;
  fileContent: string;
}

export type TCustomCb = (param: ICustomScriptParam) => ICustomScriptResult;

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

export type TReplace = IReplace | IReplaceOpt | ICSSReplace | ICustomReplace | unknown;

export interface IParam<T extends TReplace = TReplace> extends IPath {
  replaces: T[];
  maxFileSize?: number;
}

export interface ICorrectParam<R extends TReplace = TReplace> extends IParam<R> {
  maxFileSize: number;
}

export interface IConfig {
  controlName: string;
  newControlName: string;
  moduleName: string;
  newModuleName: string;
  newModule?: string;
}

export interface IError {
  date: Date;
  isError: boolean;
  fileName: string;
  comment: string;
}
