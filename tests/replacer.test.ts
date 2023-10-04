import { IContext, ICSSReplace, IParam, IReplace, IReplaceOpt } from '../src/interfaces/IConfig';
import { Replacer } from '../src/modules/Replacer';
import { Script } from '../src/modules/Script';

const replaceControl = [
    {
        name: 'control to module',
        start: `import {Toggle} from 'Controls/toggle'`,
        end: `import { default as Toggle } from 'Controls/Toggle'`
    },
    {
        name: 'control to module and used in react',
        start: `import {Toggle} from 'Controls/toggle';
            return <Toggle></Toggle>`,
        end: `import { default as Toggle } from 'Controls/Toggle';
            return <Toggle></Toggle>`
    },
    {
        name: 'rename control',
        start: `import {BigSeparator} from 'Controls/toggle'`,
        end: `import { MoreButton } from 'Controls/toggle'`
    },
    {
        name: 'rename control and used in react',
        start: `import {BigSeparator} from 'Controls/toggle';
            return <BigSeparator></BigSeparator>`,
        end: `import { MoreButton } from 'Controls/toggle';
            return <MoreButton></MoreButton>`
    },
    {
        name: 'rename control and control to module',
        start: `import {Toggle,BigSeparator} from 'Controls/toggle'`,
        end: `import { MoreButton } from 'Controls/toggle';\nimport { default as Toggle } from 'Controls/Toggle';`
    },
    {
        name: 'rename control and control to module in react',
        start: `import {Toggle,BigSeparator} from 'Controls/toggle';
            return <BigSeparator></BigSeparator>`,
        end: `import { MoreButton } from 'Controls/toggle';
import { default as Toggle } from 'Controls/Toggle';
            return <MoreButton></MoreButton>`
    },
    {
        name: 'rename control name and module name',
        start: `import {Toggle,BigSeparator} from 'Controls/toggle';
import {Test} from 'Controls/Toggle';
            return <BigSeparator></BigSeparator>`,
        end: `import { MoreButton } from 'Controls/toggle';
import { Test, default as Toggle } from 'Controls/Toggle';
            return <MoreButton></MoreButton>`
    },
    {
        name: 'rename control in import as',
        start: `import {BigSeparator as Test} from 'Controls/toggle';
            return <Test></Test><BigSeparator>`,
        end: `import { MoreButton as Test } from 'Controls/toggle';
            return <Test></Test><BigSeparator>`
    },
    {
        name: 'rename control in import *',
        start: `import * as toggle from 'Controls/toggle';
            return <Test></Test><toggle.BigSeparator>`,
        end: `import * as toggle from 'Controls/toggle';
            return <Test></Test><toggle.MoreButton>`
    },
    {
        name: 'rename control and module',
        start: `import {Tumbler} from 'Controls/toggle';
            return <Tumbler></Tumbler>`,
        end: `import { View } from 'Controls/Tumbler';
            return <View></View>`
    },
    {
        name: 'rename control, module and rename module, control in module',
        start: `import {Toggle,Tumbler} from 'Controls/toggle'`,
        end: `import { View } from 'Controls/Tumbler';\nimport { default as Toggle } from 'Controls/Toggle';`
    },
    {
        name: ' full rename',
        start: `import {Toggle,Tumbler} from 'Controls/toggle';
            return <Toggle/><Tumbler></Tumbler><Toggle></Toggle><Tumbler/><Tumbler {...props}/>`,
        end: `import { View } from 'Controls/Tumbler';\nimport { default as Toggle } from 'Controls/Toggle';
            return <Toggle/><View></View><Toggle></Toggle><View/><View {...props}/>`
    },
    {
        name: 'rename control in text',
        start: 'Controls.toggle:Tumbler',
        end: 'Controls.Tumbler:View',
    },
    {
        name: 'control to module in text',
        start: 'Controls.toggle:Toggle',
        end: 'Controls.Toggle',
    },
    {
        name: 'control to module in text 2',
        start: 'Controls/toggle:Toggle',
        end: 'Controls/Toggle',
    },
    {
        name: 'rename in text',
        start: 'Controls.toggle:BigSeparator <ws:partial template="Controls/toggle:Toggle">',
        end: 'Controls.toggle:MoreButton <ws:partial template="Controls/Toggle">',
    },
    {
        name: 'full replace',
        start: `import {Toggle, BigSeparator, Tumbler} from 'Controls/toggle';
import {Button} from 'Controls/buttons';
import {Async} from 'Controls/Async';
        export default function Control(props: object){
            return (<>
                <Button caption={(<BigSeparator/>)}/>
                <Async templateName="Controls/toggle:Toggle"/>
                <Async templateName="Controls/toggle:Tumbler"/>
            </>)
        }`,
        end: `import { MoreButton } from 'Controls/toggle';
import { View } from 'Controls/Tumbler';
import { default as Toggle } from 'Controls/Toggle';
import { NewButton } from 'Controls/buttons';
import { Async } from 'Controls/Async';
        export default function Control(props: object){
            return (<>
                <NewButton caption={(<MoreButton/>)}/>
                <Async templateName="Controls/Toggle"/>
                <Async templateName="Controls/Tumbler:View"/>
            </>)
        }`,
    },
    {
        name: 'replace rep in wml',
        start: '<Controls.list:Button></Controls.list:Button>',
        end: '<Engine.list:Button></Engine.list:Button>'
    },
    {
        name: 'replace rep in react',
        start: `import {Button} from 'Controls/list';
        export default function Control(props: object){
            return (<>
                <Button caption='caption'/>
            </>)
        }`,
        end: `import { Button } from 'Engine/list';
        export default function Control(props: object){
            return (<>
                <Button caption='caption'/>
            </>)
        }`,
    },
    {
        name: 'replace lib in wml',
        start: '<Controls.my.scroll:Button></Controls.my.scroll:Button>',
        end: '<Controls-buttons.Button></Controls-buttons.Button>'
    },
    {
        name: 'replace lib in react',
        start: `import {Button} from 'Controls/my/scroll';
        export default function Control(props: object){
            return (<>
                <Button caption='caption'/>
            </>)
        }`,
        end: `import { default as Button } from 'Controls-buttons/Button';
        export default function Control(props: object){
            return (<>
                <Button caption='caption'/>
            </>)
        }`,
    },
];

const replaceOptions = [
    {
        name: 'rename option name for react',
        start: `import {Toggle} from 'Controls/toggle';
            return <Toggle myClass="test"></Toggle>`,
        end: `import {Toggle} from 'Controls/toggle';
            return <Toggle className="test"></Toggle>`
    },
    {
        name: 'rename option name for react and many opt',
        start: `import {Toggle} from 'Controls/toggle';
            return <Toggle value={false} style="color: red" myClass="test" onValueChanged={() => {...}}></Toggle>`,
        end: `import {Toggle} from 'Controls/toggle';
            return <Toggle value={false} style="color: red" className="test" onValueChanged={() => {...}}></Toggle>`
    },
    {
        name: 'rename option name for react. many opt and rename control',
        start: `import {Toggle as View} from 'Controls/toggle';
            return <View value={false} style="color: red" myClass="test" onValueChanged={() => {...}}></View>`,
        end: `import {Toggle as View} from 'Controls/toggle';
            return <View value={false} style="color: red" className="test" onValueChanged={() => {...}}></View>`
    },
    {
        name: 'rename option name for wml',
        start: `<Controls.toggle:Toggle myClass="test"/>`,
        end: `<Controls.toggle:Toggle className="test"/>`
    },
    {
        name: 'rename option name for wml and manu opt',
        start: `<Controls.toggle:Toggle value={{false}} style="color: red" myClass="test" onValueChanged={()=>{...}}/>`,
        end: `<Controls.toggle:Toggle value={{false}} style="color: red" className="test" onValueChanged={()=>{...}}/>`
    },
    {
        name: 'rename option name for wml and manu opt and controls',
        start: `<Controls.toggle:Toggle value={{false}} style="color: red" myClass="test" onValueChanged={()=>{...}}/>
<Controls.checkbox:View myClass={'test'}/>
<Controls.custom:Toggle myClass="Toggle"/>
<Controls/toggle:Toggle myClass={()=>{}} value/>`,
        end: `<Controls.toggle:Toggle value={{false}} style="color: red" className="test" onValueChanged={()=>{...}}/>
<Controls.checkbox:View myClass={'test'}/>
<Controls.custom:Toggle myClass="Toggle"/>
<Controls/toggle:Toggle className={()=>{}} value/>`
    },
];

const replaceCSS = [
    {
        name: 'rename css var',
        start: `--var1: 512;
        height: var(--var1);`,
        end: `--varNew: 512;
        height: var(--varNew);`
    },
    {
        name: 'rename css var in 1',
        start: `--var1: 512;
        width: var(--var11)
        height: var(--var1);`,
        end: `--varNew: 512;
        width: var(--var11)
        height: var(--varNew);`
    },
    {
        name: 'remove css var',
        start: `--remove: 512;
        height: var(--remove);`,
        end: `
        height: var(--varNew);`
    },
    {
        name: 'rename css class',
        start: `.myClassName {
            color: red
        }
        <div class="myClassName"></div>`,
        end: `.myClassNameNew {
            color: red
        }
        <div class="myClassNameNew"></div>`
    },
    {
        name: 'rename css class in 1',
        start: `.myClassName {
            color: red
        }
        .myClassName_2 {
            color: green;
        }
        <div class="myClassName myClassName_2"></div>`,
        end: `.myClassNameNew {
            color: red
        }
        .myClassName_2 {
            color: green;
        }
        <div class="myClassNameNew myClassName_2"></div>`
    },
    {
        name: 'remove css class',
        start: `.removeClassName {
            color: red
        }
        .noremoveClassName {
            color: green;
        }
        <div class="removeClassName noremoveClassName"></div>`,
        end: `
        .noremoveClassName {
            color: green;
        }
        <div class=" noremoveClassName"></div>`
    }
];

describe('Replacer', () => {
    describe('replacer control', () => {
        const replacer = new Replacer();
        const param: IParam<IReplace> = Script.getCorrectParam({
            "path": ".\\test",
            "replaces": [
                {
                    "module": "Controls/toggle",
                    "controls": [
                        { // Перемещаю контрол в новый модуль
                            "name": "Toggle",
                            "newName": "",
                            "newModuleName": "Controls/Toggle"
                        },
                        { // Переименовываю контрол, и перемещаю в новый модуль
                            "name": "Tumbler",
                            "newName": "View",
                            "newModuleName": "Controls/Tumbler"
                        },
                        { // переименовываю только контрол
                            "name": "BigSeparator",
                            "newName": "MoreButton"
                        }
                    ],
                    "newModule": ""
                }, {
                    "module": "Controls/buttons",
                    "controls": [
                        {
                            "name": "Button",
                            "newName": "NewButton",
                        }
                    ],
                },
                {
                    "module": "Controls/list",
                    "controls": [
                        {
                            "name": "Button",
                            "newModuleName": "Engine/list",
                        }
                    ],
                },
                {
                    module: "Controls/my/scroll",
                    controls: [
                        {
                            name: 'Button',
                            newName: '',
                            newModuleName: 'Controls-buttons/Button'
                        }
                    ]
                }
            ]
        }) as IParam<IReplace>;

        replaceControl.forEach((test) => {
            it(`replacer: ${test.name}`, () => {
                let content = test.start;
                param.replaces.forEach((replace) => {
                    const moduleName = replace.module;
                    replace.controls.forEach((control) => {
                        const controlName = control.name;
                        if (control.newName || control.newModuleName) {
                            let newControlName = control.newName;
                            if (typeof newControlName === 'undefined') {
                                newControlName = controlName;
                            }
                            let newModuleName = control.newModuleName;
                            if (typeof newModuleName === 'undefined') {
                                newModuleName = moduleName;
                            }
                            content = replacer.replaceControls(content, {
                                controlName, newControlName,
                                moduleName, newModuleName,
                                newModule: replace.newModule,
                                thisContext: 'test'
                            });
                        }
                    });
                });
                expect(content).toEqual(test.end);
            });
        });
    });

    describe('replacer options', () => {
        const replacer = new Replacer();
        const param: IParam<IReplaceOpt> = Script.getCorrectParam({
            path: ".\\test",
            replaces: [
                {
                    thisOpt: 'myClass',
                    newOpt: 'className',
                    module: 'Controls/toggle',
                    control: 'Toggle'
                }
            ],
        }) as IParam<IReplaceOpt>;

        replaceOptions.forEach((test) => {
            it(`replacer: ${test.name}`, () => {
                let content = test.start;
                param.replaces.forEach((replace) => {
                    content = replacer.replaceOptions(content, replace);
                });
                expect(content).toEqual(test.end);
            });
        });
    });

    describe('replacer css', () => {
        const replacer = new Replacer();
        const param: IParam<ICSSReplace & IContext> = Script.getCorrectParam({
            path: ".\\test",
            replaces: [
                {
                    isRemove: false,
                    varName: '--var1',
                    newVarName: '--varNew'
                },
                {
                    isRemove: true,
                    varName: '--remove',
                    newVarName: '--varNew'
                },
                {
                    isRemove: false,
                    varName: '.myClassName',
                    newVarName: '.myClassNameNew'
                },
                {
                    isRemove: true,
                    varName: '.removeClassName',
                    newVarName: ''
                },
            ],
        }) as IParam<ICSSReplace & IContext>;

        replaceCSS.forEach((test) => {
            it(`replacer: ${test.name}`, () => {
                let content = test.start;
                param.replaces.forEach((replace) => {
                    content = replacer.cssReplace(content, replace);
                });
                expect(content).toEqual(test.end);
            });
        });
    })

    /* Не нужно до тех пор, пока не научимся превращать модуль в контрол
    describe('module to control', () => {
        const replacer = new Replacer();
        const content = replacer.replace(`import {default as View} from \'Controls/toggle\'`, {
            controlName: '', newControlName: 'View',
            moduleName: 'Controls/toggle', newModuleName: 'Controls/toggle',
            thisContext: 'test'
        });
        expect(content).toEqual('import {View} from \'Controls/toggle\'');
    });*/
});