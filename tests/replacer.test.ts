import {Replacer} from "../src/modules/Replacer";
import {Script} from "../src/modules/Script";

const tests = [
    {
        name: 'control to module',
        start: `import {Toggle} from 'Controls/toggle'`,
        end: `import {default as Toggle} from 'Controls/Toggle'`
    },
    {
        name: 'control to module and used in react',
        start: `import {Toggle} from 'Controls/toggle';
            return <Toggle></Toggle>`,
        end: `import {default as Toggle} from 'Controls/Toggle';
            return <Toggle></Toggle>`
    },
    {
        name: 'rename control',
        start: `import {BigSeparator} from 'Controls/toggle'`,
        end: `import {MoreButton} from 'Controls/toggle'`
    },
    {
        name: 'rename control and used in react',
        start: `import {BigSeparator} from 'Controls/toggle';
            return <BigSeparator></BigSeparator>`,
        end: `import {MoreButton} from 'Controls/toggle';
            return <MoreButton></MoreButton>`
    },
    {
        name: 'rename control and control to module',
        start: `import {Toggle,BigSeparator} from 'Controls/toggle'`,
        end: `import {MoreButton} from 'Controls/toggle';\nimport {default as Toggle} from 'Controls/Toggle';`
    },
    {
        name: 'rename control and control to module in react',
        start: `import {Toggle,BigSeparator} from 'Controls/toggle';
            return <BigSeparator></BigSeparator>`,
        end: `import {MoreButton} from 'Controls/toggle';
import {default as Toggle} from 'Controls/Toggle';
            return <MoreButton></MoreButton>`
    },
    {
        name: 'rename control name and module name',
        start: `import {Toggle,BigSeparator} from 'Controls/toggle';
import {Test} from 'Controls/Toggle';
            return <BigSeparator></BigSeparator>`,
        end: `import {MoreButton} from 'Controls/toggle';
import {Test, default as Toggle} from 'Controls/Toggle';
            return <MoreButton></MoreButton>`
    },
    {
        name: 'rename control in import as',
        start: `import {BigSeparator as Test} from 'Controls/toggle';
            return <Test></Test><BigSeparator>`,
        end: `import {MoreButton as Test} from 'Controls/toggle';
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
        end: `import {View} from 'Controls/Tumbler';
            return <View></View>`
    },
    {
        name: 'rename control, module and rename module, control in module',
        start: `import {Toggle,Tumbler} from 'Controls/toggle'`,
        end: `import {View} from 'Controls/Tumbler';\nimport {default as Toggle} from 'Controls/Toggle';`
    },
    {
        name: ' full rename',
        start: `import {Toggle,Tumbler} from 'Controls/toggle';
            return <Toggle/><Tumbler></Tumbler><Toggle></Toggle><Tumbler/><Tumbler {...props}/>`,
        end: `import {View} from 'Controls/Tumbler';\nimport {default as Toggle} from 'Controls/Toggle';
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
        end: `import { MoreButton} from 'Controls/toggle';
import {View} from 'Controls/Tumbler';
import {default as Toggle} from 'Controls/Toggle';
import {NewButton} from 'Controls/buttons';
import {Async} from 'Controls/Async';
        export default function Control(props: object){
            return (<>
                <NewButton caption={(<MoreButton/>)}/>
                <Async templateName="Controls/Toggle"/>
                <Async templateName="Controls/Tumbler:View"/>
            </>)
        }`,
    }
];

describe('Replacer', () => {
    describe('replacer test', () => {
        const replacer = new Replacer();
        const param = Script.getCorrectParam({
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
                }
            ]
        });

        tests.forEach((test) => {
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
                            content = replacer.replace(content, {
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