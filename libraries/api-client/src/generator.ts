import path from "node:path";
import fs from 'node:fs';
import { generateApi } from "swagger-typescript-api";
import dotenv from 'dotenv'
dotenv.config({path:'../../.env'});
//@ts-ignore

if(!process.env.API_URL) {
    throw new Error('API_URL is not set')
}

const clientUrl = process.env.API_URL

const endpoint = [
    {name: 'client', url:`${clientUrl}/docs/json`, className:"api"},
]

async function generate(){
    try{
        // remove all old file base on endpoint
        for(let i = 0; i < endpoint.length; i++) {
            const filePath = path.resolve(process.cwd(), "./src/generate", endpoint[i].name + ".ts")
            if(fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
            const filePathJson = path.resolve(process.cwd(), "./src/generate", endpoint[i].name + ".json")
            if(fs.existsSync(filePathJson)) {
                fs.unlinkSync(filePathJson)
            }
        }

        
        await Promise.all(
            endpoint.map( 
                point => {
                    let finalRoute:Record<string, any> = {}
                    generateApi({
                        name: point.name + '.ts',
                        output: path.resolve(process.cwd(), "./src/generate"),
                        url: point.url,
                        httpClientType: "axios",
                        generateClient:true,
                        unwrapResponseData:true,
                        apiClassName: point.className,
                        singleHttpClient:false,
                        modular:false,
                        moduleNameIndex: 1,
                        moduleNameFirstTag:false,
                        prettier: {
                            // By default prettier config is load from your project
                            printWidth: 120,
                            tabWidth: 4,
                            trailingComma: "all",
                            parser: "typescript",
                        },
                        hooks:{
                            onCreateRoute:(routeData) => {
                                // if routeData.route start with /api, remove it
                                // console.log("onCreateRoute", routeData.request.path)
                                // @ts-ignore
                                
                                return routeData
                            },
                            onCreateRouteName:(routeNameInfo, rawRouteInfo) => {
                                return routeNameInfo
                            },
                            onFormatRouteName: (routeInfo, templateRouteName) => {
                                // console.log(routeInfo);
                                let paths = routeInfo.route.replace('/api/','').split('/');
                                if(paths[paths.length -1] === '') {
                                    paths[paths.length -1] = 'deprecate'
                                }
                                const ignoreList = ['api', 'docpal'];
                                // remove first item in path
                                const allPath = paths.reduce((all, curr, index) => {
                                    
                                    if(curr !== routeInfo.moduleName){
                                        all.push(curr)
                                    }
                                    return all
                                },[])
                                let newName = routeInfo.method + (allPath &&allPath.length ? toPascalCase(allPath.join('-')) : "")
                                let oldName = newName;
                                if(finalRoute[newName] && finalRoute[newName].length) {
                                    newName += finalRoute[newName].length
                                }
                                finalRoute[newName] = {
                                    name: newName,
                                    method: routeInfo.method,
                                    route: routeInfo.route,
                                    moduleName: routeInfo.moduleName,
                                }

                                
                                return newName
                            }
                        }
                        
                    }
                    ).then(() => {
                        // fs.writeFile( path.join(__dirname,`/generate/${point.name}.json`), JSON.stringify(finalRoute),{}, () => {
                        //     // console.log('complete')
                        // })
                    })
                }
            )
        )
        
    }catch(error) {
        console.log(error)
    }
}

function toPascalCase(string) {
    if(!string) return "";
    return `${string}`
      .toLowerCase()
      .replace(new RegExp(/[-_]+/, 'g'), ' ')
      .replace(new RegExp(/[^\w\s]/, 'g'), '')
      .replace(
        new RegExp(/\s+(.)(\w*)/, 'g'),
        ($1, $2, $3) => `${$2.toUpperCase() + $3}`
      )
      .replace(new RegExp(/\w/), s => s.toUpperCase());
  }

generate()
