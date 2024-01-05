export interface IContext {
  thisContext: string;
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

export interface ICustomScriptParam {
  path: string;
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

export type IParamOptions<T> = T extends IReplace
  ? IReplace
  : T extends IReplaceOpt
  ? IReplaceOpt
  : T extends ICSSReplace
  ? ICSSReplace
  : T extends ICustomReplace
  ? ICustomReplace
  : unknown;

export interface IParam<R> {
  path: string;
  replaces: IParamOptions<R>[];
  maxFileSize?: number;
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
  fileName: string;
  comment: string;
}
