
const path = require('path');
const fs = require('fs').promises;
const queryString = require('query-string');

const math = require('mathjs');

//Excel Connection
const Excel = require('exceljs');


//DATABASE INFORMATION (TABLE NAMES)
const dbConfig = require('../config/database.js');
const database = dbConfig.database;
const creoDB = database;

//Creoson Connection
const reqPromise = require('request-promise');
let creoHttp = 'http://localhost:9056/creoson';
let sessionId = '';
let connectOptions = {
    method: 'POST',
    uri: creoHttp,
    body: {
        "command": "connection",
        "function": "connect"
    },
    json: true // Automatically stringifies the body to JSON
};

reqPromise(connectOptions)
    .then(reqConnectBody => {
        // get the sessionId
        sessionId = reqConnectBody.sessionId;
        reqPromise({
            method: 'POST',
            uri: creoHttp,
            body: {
                "sessionId": reqConnectBody.sessionId,
                "command": "creo",
                "function": "set_creo_version",
                "data": {
                    "version": "3"
                }
            },
            json: true
        });
    })
    .catch(err => {
        console.log('there was an error:' + err)
    });

function creo(sessionId, functionData) {
    if (functionData.data.length != 0) {
        return reqPromise({
            method: 'POST',
            uri: creoHttp,
            body: {
                "sessionId": sessionId,
                "command": functionData.command,
                "function": functionData.function,
                "data": functionData.data
            },
            json: true
        });
    } else {
        return reqPromise({
            method: 'POST',
            uri: creoHttp,
            body: {
                "sessionId": sessionId,
                "command": functionData.command,
                "function": functionData.function
            },
            json: true
        });
    }
}

creo(sessionId, {
    command: "creo",
    function: "set_creo_version",
    data: {
        "version": "3"
    }
});

//*********************************MECHANICAL ENG. PORTAL*************************************//

const DB = require('../config/db.js');
const querySql = DB.querySql;
const Promise = require('bluebird');

exports = {};
module.exports = exports;

//Initial Part Comparison GET request
exports.partComparison = function(req, res) {
    let workingDir;
    let outputDir;
    res.locals = {title: 'Part Comparison'};
    res.render('partComparison/partComparison', {
        message: null,
        asmList: [],
        workingDir: workingDir,
        outputDir: outputDir,
        partsList: []
    });
};

//Set Working Directory POST request
exports.setWD = function(req, res) {
    let message = null;
    let workingDir = req.body.CREO_workingDir;
    let compareDir = workingDir + '/_compareDir';
    let topLevelAsmList = [];

    async function cdAndCreateOutputDir() {
        let dir = await creo(sessionId, {
            command: "creo",
            function: "pwd",
            data: {}
        });

        if (dir.data != undefined) {
            if (dir.data.dirname != workingDir) {
                await creo(sessionId, {
                    command: "creo",
                    function: "cd",
                    data: {
                        "dirname": workingDir
                    }
                });

                const innerDirs = await creo(sessionId, {
                    command: "creo",
                    function: "list_dirs",
                    data: {
                        "dirname": "_compareDir"
                    }
                });

                if (innerDirs.data.dirlist.length == 0) {
                    await creo(sessionId, {
                        command: "creo",
                        function: "mkdir",
                        data: {
                            "dirname": "_compareDir"
                        }
                    });
                    await creo(sessionId, {
                        command: "interface",
                        function: "mapkey",
                        data: {
                            script: "~ Command `ProCmdModelNew` ;~ Select `new` `Type` 1 `Assembly`;" +
                                "~ Activate `new` `OK`;~ Select `main_dlg_cur` `appl_casc`;" +
                                "~ Close `main_dlg_cur` `appl_casc`;~ Command `ProCmdModelSaveAs` ;" +
                                "~ Select `file_saveas` `ph_list.Filelist` 1 `_compareDir`;" +
                                "~ Activate `file_saveas` `ph_list.Filelist` 1 `_compareDir`;" +
                                "~ Update `file_saveas` `Inputname` `asm`;~ Activate `file_saveas` `OK`;"
                        }
                    });
                } else {
                    message = "_compareDir already exists within the working directory. Please remove before continuing.";
                }
            } else {
                const innerDirs = await creo(sessionId, {
                    command: "creo",
                    function: "list_dirs",
                    data: {
                        "dirname": "_compareDir"
                    }
                });

                if (innerDirs.data.dirlist.length == 0) {
                    await creo(sessionId, {
                        command: "creo",
                        function: "mkdir",
                        data: {
                            "dirname": "_compareDir"
                        }
                    });
                    await creo(sessionId, {
                        command: "interface",
                        function: "mapkey",
                        data: {
                            script: "~ Command `ProCmdModelNew` ;~ Select `new` `Type` 1 `Assembly`;" +
                                "~ Activate `new` `OK`;~ Select `main_dlg_cur` `appl_casc`;" +
                                "~ Close `main_dlg_cur` `appl_casc`;~ Command `ProCmdModelSaveAs` ;" +
                                "~ Select `file_saveas` `ph_list.Filelist` 1 `_compareDir`;" +
                                "~ Activate `file_saveas` `ph_list.Filelist` 1 `_compareDir`;" +
                                "~ Update `file_saveas` `Inputname` `asm`;~ Activate `file_saveas` `OK`;"
                        }
                    });
                } else {
                    message = "_compareDir already exists within the working directory. Please remove before continuing."
                }
            }
        }
        return null
    }

    cdAndCreateOutputDir()
        .then(async function() {
            const listAsms = await creo(sessionId, {
                command: "creo",
                function: "list_files",
                data: {
                    "filename":"*asm"
                }
            });

            let asmList = listAsms.data.filelist;
            for (let i = 0; i < asmList.length; i++) {
                if (asmList[i].slice(7,11) == '0000') {
                    await creo(sessionId, {
                        command: "file",
                        function: "open",
                        data: {
                            "file": asmList[i]
                        }
                    });
                    const famTabExists = await creo(sessionId, {
                        command: "familytable",
                        function: "list",
                        data: {
                            "file": asmList[i]
                        }
                    });
                    if (famTabExists.data.instances.length != 0) {
                        topLevelAsmList.push(asmList[i]);
                        for (let j = 0; j < famTabExists.data.instances.length; j++) {
                            topLevelAsmList.push(famTabExists.data.instances[j]+'<'+asmList[i].slice(0,15) +'>'+'.asm')
                        }
                    } else {
                        topLevelAsmList.push(asmList[i])
                    }
                }
            }
            return null;
        })
        .then(() => {
            if (message == null) {
                res.locals = {title: 'Part Comparison'};
                res.render('partComparison/partComparison', {
                    message: null,
                    workingDir: workingDir,
                    outputDir: compareDir,
                    asmList: topLevelAsmList,
                    partsList: []
                });
            } else {
                res.locals = {title: 'Part Comparison'};
                res.render('partComparison/partComparison', {
                    message: message,
                    workingDir: workingDir,
                    outputDir: undefined,
                    asmList: [],
                    partsList: []
                });
            }
        })
        .catch(err => {
            console.log(err);
        });
};

//Compare Parts Function POST request
exports.compareParts = function(req, res) {
    req.setTimeout(0); //no timeout
    let message = null;
    let workingDir = req.body.CREO_workingDir;
    let compareDir = workingDir + '\\_compareDir';
    //let stdDir = 'C:\\Users\\james.africh\\Desktop\\standardPartsTest';
    let stdDir = 'G:\\STANDARD DESIGN LIBRARY\\SAI-STANDARD\\000000_STANDARD\\000000 - CREO';
    let asmCount = req.body.asmCount;
    let asmNames = req.body.asmName;
    let includeArray = req.body.includeInExportCheck;
    let asms = [];
    let lineups = [];
    let stdParts = [];
    let possibleMatches = [];
    let partMatchArr = [];
    let partSimilarityArr = [];

    async function getCounter() {
        let currentCount =  await querySql("SELECT partComparisonCount FROM " + database + "." + dbConfig.script_counter_table+" WHERE idCounter = ?",1);
        return currentCount[0].partComparisonCount;
    }

    async function cd1() {
        let dir = await creo(sessionId, {
            command: "creo",
            function: "pwd",
            data: {}
        });

        if (dir.data.dirname != stdDir) {
            await creo(sessionId, {
                command: "creo",
                function: "cd",
                data: {
                    "dirname": stdDir
                }
            });
        }

        const stdPartsList = await creo(sessionId, {
            command: "creo",
            function: "list_files",
            data: {
                filename: "*prt"
            }
        });

        for (let stdPart of stdPartsList.data.filelist) {
            stdParts.push(stdPart);
        }

        return null
    }

    async function cd2() {
        let dir = await creo(sessionId, {
            command: "creo",
            function: "pwd",
            data: {}
        });

        if (dir.data.dirname != workingDir) {
            await creo(sessionId, {
                command: "creo",
                function: "cd",
                data: {
                    "dirname": workingDir
                }
            })
        }
        return null
    }

    function asmToPart(arr, parts) {
        for (let item of arr) {
            if (!item.children) {
                if (parts.filter(e => e.part === item.file).length > 0) {
                    parts.filter(e => e.part === item.file)[0].qty += 1;
                } else {
                    parts.push({
                        part: item.file,
                        qty: 1
                    })
                }
            } else {
                asmToPart(item.children, parts)
            }
        }
        return parts
    }

    async function checkInterference(customPart, possibleMatch, xRot, yRot, zRot, count) {
        let pi = Math.PI;

        let xRad = xRot * (pi/180);
        let yRad = yRot * (pi/180);
        let zRad = zRot * (pi/180);

        let rm11 = Math.round(Math.cos(zRad) * Math.cos(yRad));
        let rm12 = Math.round((Math.cos(zRad) * Math.sin(yRad) * Math.sin(xRad)) - (Math.sin(zRad) * Math.cos(xRad)));
        let rm13 = Math.round((Math.cos(zRad) * Math.sin(yRad) * Math.cos(xRad)) + (Math.sin(zRad) * Math.sin(xRad)));
        let rm21 = Math.round(Math.sin(zRad) * Math.cos(yRad));
        let rm22 = Math.round((Math.sin(zRad) * Math.sin(yRad) * Math.sin(xRad)) + (Math.cos(zRad) * Math.cos(xRad)));
        let rm23 = Math.round((Math.sin(zRad) * Math.sin(yRad) * Math.cos(xRad)) - (Math.cos(zRad) * Math.sin(xRad)));
        let rm31 = Math.round(- Math.sin(yRad));
        let rm32 = Math.round(Math.cos(yRad) * Math.sin(xRad));
        let rm33 = Math.round(Math.cos(yRad) * Math.cos(xRad));

        let rotationMatrix = math.matrix([[rm11, rm12, rm13], [rm21, rm22, rm23], [rm31, rm32, rm33]]);

        if (math.deepEqual(math.multiply(rotationMatrix, customPart.dCustom), possibleMatch.dStd) == true) {

            await creo(sessionId, {
                command: "creo",
                function: "cd",
                data: {
                    dirname: compareDir
                }
            });

            await creo(sessionId, {
                command: "interface",
                function: "mapkey",
                data: {
                    script: "~ Command `ProCmdModelNew` ;~ Select `new` `Type` 1 `Assembly`;" +
                        "~ Activate `new` `OK`;~ Select `main_dlg_cur` `appl_casc`;" +
                        "~ Close `main_dlg_cur` `appl_casc`;~ Command `ProCmdModelSaveAs` ;" +
                        "~ Select `file_saveas` `ph_list.Filelist` 1 `_compareDir`;" +
                        "~ Activate `file_saveas` `ph_list.Filelist` 1 `_compareDir`;" +
                        "~ Update `file_saveas` `Inputname` `asm" + count + "`;~ Activate `file_saveas` `OK`;"
                }
            });

            await creo(sessionId, {
                command: "file",
                function: "open",
                data: {
                    file: "asm"+count+".asm",
                    display: true,
                    activate: true
                }
            });


            await creo(sessionId, {
                command: "file",
                function: "assemble",
                data: {
                    file: possibleMatch.stdInstance+".prt",
                    generic: possibleMatch.stdGeneric.slice(0,15),
                    into_asm: "asm"+count+".asm",
                    constraints: [{
                        "asmref": "ASM_DEF_CSYS",
                        "compref": "PRT_CSYS_DEF",
                        "type": "CSYS"
                    }],
                    transform: {
                        "origin": {
                            "x": possibleMatch.offsetStd.get([0,0]),
                            "y": possibleMatch.offsetStd.get([1,0]),
                            "z": possibleMatch.offsetStd.get([2,0])
                        }
                    }
                }
            });

            // had to take out rotation portion since creoson does not allow both linear translation and rotation
            await creo(sessionId, {
                command: "file",
                function: "assemble",
                data: {
                    file: customPart.customPart.slice(0,15)+".prt",
                    generic: customPart.customPart.slice(16,31),
                    into_asm: "asm"+count+".asm",
                    constraints: [{
                        "asmref": "ASM_DEF_CSYS",
                        "compref": "PRT_CSYS_DEF",
                        "type": "CSYS"
                    }],
                    transform: {
                        "origin": {
                            "x": customPart.offsetCustom.get([0,0]),
                            "y": customPart.offsetCustom.get([1,0]),
                            "z": customPart.offsetCustom.get([2,0])
                        }
                    }
                }
            });

            await creo(sessionId, {
                command: "file",
                function: "save",
                data: {
                    filename: "asm"+count+".asm"
                }
            });

            await creo(sessionId, {
                command: "interface",
                function: "mapkey",
                data: {
                    script: "%in;~ Activate `nma_model_global_interference` `info_btn`;" +
                        "~ Select `texttool` `MenuBar` 1 `FileMenu`;~ Close `texttool` `MenuBar`;" +
                        "~ Activate `texttool` `SaveAsPushButton`;" +
                        "~ Update `file_saveas` `Inputname` `glbintf" + count + ".dat`;" +
                        "~ Activate `file_saveas` `OK`;~ FocusIn `texttool` `textPH.TextArea`;" +
                        "~ Activate `texttool` `CloseButton`;" +
                        "~ Activate `nma_model_global_interference` `ok_btn`;"
                }
            });

            await creo(sessionId, {
                command: "file",
                function: "close_window",
                data: {
                    filename: "asm"+count+".asm"
                }
            });

            const creoIntfData = await fs.readFile(compareDir + '\\glbintf' + count + '.dat.1', 'utf8');
            let volumeIndex = creoIntfData.toString().indexOf('INCH^3');
            let volumeIntf = Number(creoIntfData.toString().slice(volumeIndex - 8, volumeIndex));
            if (volumeIntf.toString().split(".")[1] != undefined) {
                let decimalPlaces = volumeIntf.toString().split(".")[1].length;
                let acceptableRange = 0;
                switch (decimalPlaces) {
                    case 1:
                        acceptableRange = 0;
                        break;
                    case 2:
                        acceptableRange = 0.01;
                        break;
                    case 3:
                        acceptableRange = 0.001;
                        break;
                    case 4:
                        acceptableRange = 0.0001;
                        break;
                    case 5:
                        acceptableRange = 0.00001;
                        break;
                    default:
                        acceptableRange = 0;
                        break;
                }

                if (Math.abs(volumeIntf - Number(customPart.volume.toFixed(decimalPlaces))) <= acceptableRange) {
                    return {
                        matchType: "IDENTICAL",
                        customPart: customPart.customPart,
                        stdInstance: possibleMatch.stdInstance,
                        stdGeneric: possibleMatch.stdGeneric,
                        offsetCustom: customPart.offsetCustom,
                        offsetStd: possibleMatch.offsetStd,
                        xRot: xRot,
                        yRot: yRot,
                        zRot: zRot
                    }
                } else if (Math.abs(volumeIntf - ((0.99)*Number(customPart.volume.toFixed(decimalPlaces)))) <= acceptableRange || Math.abs(volumeIntf - ((1.01)*Number(customPart.volume.toFixed(decimalPlaces)))) <= acceptableRange) {
                    return {
                        matchType: "SIMILAR",
                        customPart: customPart.customPart,
                        stdInstance: possibleMatch.stdInstance,
                        stdGeneric: possibleMatch.stdGeneric,
                        offsetCustom: customPart.offsetCustom,
                        offsetStd: possibleMatch.offsetStd,
                        xRot: xRot,
                        yRot: yRot,
                        zRot: zRot
                    }
                }
            }
        }
        return null
    }

    cd1()
        .then(async function() {
            await cd2();
            return null
        })
        .then(async function() {
            let counter = await getCounter();
            await querySql("UPDATE " + database + "." + dbConfig.script_counter_table + " SET partComparisonCount = ? WHERE idCounter = ?",[counter+1, 1]);
            return null;
        })
        .then(() => {
            //create the drawings JSON array from the .drw files in the working directory
            if (asmCount == 1) {
                if (includeArray == 1) {
                    asms.push(asmNames);
                }
            } else {
                for (let i = 0; i < asmCount; i++) {
                    if (includeArray[i] == 1) {
                        asms.push(asmNames[i]);
                    }
                }
            }
        })
        .then(async function () {
            let secPartData = [];
            for (let asm of asms) {
                let sections = [];
                const sectionData = await creo(sessionId, {
                    command: "bom",
                    function: "get_paths",
                    data: {
                        "file": asm,
                        "top_level": true,
                        "exclude_inactive": true
                    }
                });
                for (let data of sectionData.data.children.children) {
                    let parts = [];
                    let section = data.file;
                    if (section.slice(section.length - 4, section.length) != '.PRT') {
                        sections.push(section.slice(12,15));

                        await creo(sessionId, {
                            command: "file",
                            function: "open",
                            data: {
                                "file": section,
                                "display": true,
                                "activate": true
                            }
                        });
                        const comps = await creo(sessionId, {
                            command: "bom",
                            function: "get_paths",
                            data: {
                                "file": section,
                                "exclude_inactive": true
                            }
                        });

                        const secParts = asmToPart(comps.data.children.children, parts);

                        secPartData.push({
                            section: section,
                            parts: secParts
                        });
                    }
                }
                lineups.push({
                    lineup: asm.slice(0,15),
                    sections: sections
                })
            }
            return secPartData
        })
        .then(async function(secPartData) {
            let globallyCommonParts = [];
            let filteredParts = [];
            for (let i = 0; i < secPartData.length; i++) {
                for (let j = 0; j < secPartData[i].parts.length; j++) {
                    if (globallyCommonParts.includes(secPartData[i].parts[j].part) == false) {
                        await globallyCommonParts.push(secPartData[i].parts[j].part);
                    }
                }
            }

            for (let part of globallyCommonParts) {
                if (part.slice(0,6) != '777777' && part.slice(0,6) != '999999' && part.slice(0,6) != '777999' && part.slice(7,11) != '6000') {
                    filteredParts.push(part);
                }
            }

            filteredParts.sort(function(a,b) {
                let intA = parseInt(a.slice(7,11)+a.slice(12,15));
                let intB = parseInt(b.slice(7,11)+b.slice(12,15));
                return intA - intB
            });

            return filteredParts;
        })
        .then(async function(filteredParts) {
            for (let customPart of filteredParts) {
                const massPropsCustomPart = await creo(sessionId, {
                    command: "file",
                    function: "massprops",
                    data: {
                        file: customPart
                    }
                });
                const boundBoxCustomPart = await creo(sessionId, {
                    command: "geometry",
                    function: "bound_box",
                    data: {
                        file: customPart
                    }
                });

                let dxCustom = Number((boundBoxCustomPart.data.xmax - boundBoxCustomPart.data.xmin).toFixed(4));
                let dyCustom = Number((boundBoxCustomPart.data.ymax - boundBoxCustomPart.data.ymin).toFixed(4));
                let dzCustom = Number((boundBoxCustomPart.data.zmax - boundBoxCustomPart.data.zmin).toFixed(4));
                let dCustom = math.matrix([[dxCustom], [dyCustom], [dzCustom]]);
                let maxCustom = math.matrix([[Number(boundBoxCustomPart.data.xmax.toFixed(4))], [Number(boundBoxCustomPart.data.ymax.toFixed(4))], [Number(boundBoxCustomPart.data.zmax.toFixed(4))]]);
                let minCustom = math.matrix([[Number(boundBoxCustomPart.data.xmin.toFixed(4))], [Number(boundBoxCustomPart.data.ymin.toFixed(4))], [Number(boundBoxCustomPart.data.zmin.toFixed(4))]]);
                let midDistCustom = math.multiply(0.5, dCustom);
                let offsetCustom = math.subtract(midDistCustom, maxCustom).map(a => +a.toFixed(4));

                for (let stdPart of stdParts) {
                    if (stdPart.slice(7, 11) == customPart.slice(7, 11)) {
                        await creo(sessionId, {
                            command: "file",
                            function: "open",
                            data: {
                                file: stdPart,
                                dirname: stdDir,
                                display: true,
                                activate: true
                            }
                        });

                        const stdPartFamTable = await creo(sessionId, {
                            command: "familytable",
                            function: "list",
                            data: {
                                file: stdPart
                            }
                        });

                        if (stdPartFamTable.data.instances.length != 0) {
                            for (let stdPartInstance of stdPartFamTable.data.instances) {
                                await creo(sessionId, {
                                    command: "file",
                                    function: "open",
                                    data: {
                                        file: stdPartInstance + '.prt',
                                        generic: stdPart.slice(0, stdPart.length - 4),
                                        dirname: stdDir,
                                        display: true,
                                        activate: true
                                    }
                                });

                                const massPropsStdInstance = await creo(sessionId, {
                                    command: "file",
                                    function: "massprops",
                                    data: {
                                        file: stdPartInstance + '.prt'
                                    }
                                });

                                const boundBoxStdInstance = await creo(sessionId, {
                                    command: "geometry",
                                    function: "bound_box",
                                    data: {
                                        file: stdPartInstance + '.prt'
                                    }
                                });


                                //IF DENSITY SURFACE AREA, MASS, AND VOLUME ARE THE SAME
                                if (Number(massPropsStdInstance.data.density.toFixed(5)) == Number(massPropsCustomPart.data.density.toFixed(5)) && Number(massPropsStdInstance.data.surface_area.toFixed(5)) == Number(massPropsCustomPart.data.surface_area.toFixed(5)) && Number(massPropsStdInstance.data.mass.toFixed(5)) == Number(massPropsCustomPart.data.mass.toFixed(5)) && Number(massPropsStdInstance.data.volume.toFixed(5)) == Number(massPropsCustomPart.data.volume.toFixed(5))) {
                                    let dxStd = Number((boundBoxStdInstance.data.xmax - boundBoxStdInstance.data.xmin).toFixed(4));
                                    let dyStd = Number((boundBoxStdInstance.data.ymax - boundBoxStdInstance.data.ymin).toFixed(4));
                                    let dzStd = Number((boundBoxStdInstance.data.zmax - boundBoxStdInstance.data.zmin).toFixed(4));
                                    let dStd = math.matrix([[dxStd], [dyStd], [dzStd]]);
                                    let maxStd = math.matrix([[Number(boundBoxStdInstance.data.xmax.toFixed(4))], [Number(boundBoxStdInstance.data.ymax.toFixed(4))], [Number(boundBoxStdInstance.data.zmax.toFixed(4))]]);
                                    let minStd = math.matrix([[Number(boundBoxStdInstance.data.xmin.toFixed(4))], [Number(boundBoxStdInstance.data.ymin.toFixed(4))], [Number(boundBoxStdInstance.data.zmin.toFixed(4))]]);
                                    let midDistStd = math.multiply(0.5, dStd);
                                    let offsetStd = math.subtract(midDistStd, maxStd).map(a => +a.toFixed(4));

                                    let customCOG = massPropsCustomPart.data.ctr_grav_inertia_tensor;
                                    let stdCOG = massPropsStdInstance.data.ctr_grav_inertia_tensor;

                                    let COGs = [customCOG, stdCOG];

                                    for (let COG of COGs) {
                                        for (let keyZ in COG.z_axis) {
                                            if (COG.z_axis.hasOwnProperty(keyZ)) {
                                                COG.z_axis[keyZ] = Number(COG.z_axis[keyZ].toFixed(4));
                                            }
                                        }
                                        for (let keyY in COG.y_axis) {
                                            if (COG.y_axis.hasOwnProperty(keyY)) {
                                                COG.y_axis[keyY] = Number(COG.y_axis[keyY].toFixed(4));
                                            }
                                        }
                                        for (let keyX in COG.x_axis) {
                                            if (COG.x_axis.hasOwnProperty(keyX)) {
                                                COG.x_axis[keyX] = Number(COG.x_axis[keyX].toFixed(4));
                                            }
                                        }
                                    }

                                    if (possibleMatches.filter(e => e.customPart == customPart).length == 0) {
                                        possibleMatches.push({
                                            customPart: customPart,
                                            surface_area: Number(massPropsStdInstance.data.surface_area.toFixed(5)),
                                            density: Number(massPropsStdInstance.data.density.toFixed(5)),
                                            mass: Number(massPropsStdInstance.data.mass.toFixed(5)),
                                            volume: Number(massPropsStdInstance.data.volume.toFixed(5)),
                                            customCOG: customCOG,
                                            dCustom: dCustom,
                                            maxCustom: maxCustom,
                                            minCustom: minCustom,
                                            offsetCustom: offsetCustom,
                                            possibleMatches: [{
                                                stdInstance: stdPartInstance,
                                                stdGeneric: stdPart,
                                                stdCOG: stdCOG,
                                                dStd: dStd,
                                                maxStd: maxStd,
                                                minStd: minStd,
                                                offsetStd: offsetStd
                                            }]
                                        })
                                    } else {
                                        possibleMatches.filter(e => e.customPart == customPart)[0].possibleMatches.push({
                                            stdInstance: stdPartInstance,
                                            stdGeneric: stdPart,
                                            stdCOG: stdCOG,
                                            dStd: dStd,
                                            maxStd: maxStd,
                                            minStd: minStd,
                                            offsetStd: offsetStd
                                        });

                                    }
                                }
                            }
                        }
                    }
                }
            }
            return null
        })
        .then(async function() {
            let count = 0;
            for (let customPart of possibleMatches) {
                for (let possibleMatch of customPart.possibleMatches) {
                    if (math.deepEqual(customPart.dCustom, possibleMatch.dStd) == true) {
                        const matchData = await checkInterference(customPart, possibleMatch, 0, 0, 0, count);

                        console.log(matchData);

                        if (typeof matchData === 'object' && matchData !== null) {
                            partMatchArr.push(matchData);
                        }
                        count++
                    }
                    else {
                        let dCustomClone = [customPart.dCustom.get([0,0]), customPart.dCustom.get([1,0]), customPart.dCustom.get([2,0])];
                        let dStdClone = [possibleMatch.dStd.get([0,0]), possibleMatch.dStd.get([1,0]), possibleMatch.dStd.get([2,0])];
                        if (dCustomClone.sort((a,b) => a - b) == dStdClone.sort((a,b) => a - b)) {
                            let rotationOpts = [0, 90, 180, 270];
                            for (let xRot of rotationOpts) {
                                for (let yRot of rotationOpts) {
                                    for (let zRot of rotationOpts) {
                                        const matchData = await checkInterference(customPart, possibleMatch, xRot, yRot, zRot, count);
                                        if (typeof matchData === 'object' && matchData !== null) {
                                            partMatchArr.push(matchData);
                                        }
                                        count++
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        .then(async function() {
            let workbook = new Excel.Workbook();
            let sheet = workbook.addWorksheet('sheet1');
            sheet.columns = [
                {header: 'Custom Instance', key: 'customInstance', width: 20, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Custom Generic', key: 'customGeneric', width: 20, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Standard Instance', key: 'stdInstance', width: 20, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Standard Generic', key: 'stdGeneric', width: 20, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Offset Custom', key: 'offsetCustom', width: 40, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Offset Standard', key: 'offsetStd', width: 40, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'X Axis Rotation', key: 'xRot', width: 20, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Y Axis Rotation', key: 'yRot', width: 20, style: {font: {name: 'Calibri', size: 11}}},
                {header: 'Z Axis Rotation', key: 'zRot', width: 20, style: {font: {name: 'Calibri', size: 11}}}
            ];
            for (let part of partMatchArr) {
                sheet.addRow({
                    customInstance: part.customPart.slice(0,15),
                    customGeneric: part.customPart.slice(16,31),
                    stdInstance: part.stdInstance,
                    stdGeneric: part.stdGeneric.slice(0,15),
                    offsetCustom: part.offsetCustom._data,
                    offsetStd: part.offsetStd._data,
                    xRot: part.xRot,
                    yRot: part.yRot,
                    zRot: part.zRot
                });
            }
            workbook.xlsx.writeFile(compareDir + '/partComparison.xlsx').then(function() {
                return null
            });
        })
        .then(() => {
            res.locals = {title: 'Part Comparison'};
            res.render('partComparison/partComparison', {
                message: message,
                workingDir: [],
                outputDir: undefined,
                asmList: [],
                partsList: []
            })
        })
        .catch(err => {
            console.log(err);
        });



};