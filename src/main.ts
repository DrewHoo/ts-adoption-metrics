import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

type Dict<K extends string, V> = { [key in K]: V }

type WalkArgs = Dict<string, { regex: RegExp; matches: string[] }>

async function main() {
    const pathname = '/Users/DrewHoo/Atomic/archive/FAAC/ios/'
    const interfaceUsagesPromise = findUsages(
        pathname,
        'interfaces',
        /export interface\s([\w\d]*)[<\s,]/,
        name =>
            new RegExp(
                `([\\w\\d\\s]*):\\s${name}|([\\w\\d\\s]*)\\s=>\\s${name}`
            )
    )

    const typeUsagesPromise = findUsages(
        pathname,
        'types',
        /export type\s([\w\d]*)[<\s,]/,
        name =>
            new RegExp(
                `([\\w\\d\\s]*):\\s${name}|([\\w\\d\\s]*)\\s=>\\s${name}`
            )
    )
    console.log(await interfaceUsagesPromise)
    console.log(await typeUsagesPromise)
}
main()

export async function findUsages(
    pathname: fs.PathLike,
    syntaxName: string,
    syntaxRegex: RegExp,
    usageRegex: (name: string) => RegExp
): Promise<string[]> {
    const matchDict = await walk(pathname, {
        [syntaxName]: { regex: syntaxRegex, matches: [] },
    })
    const newMatchDict: WalkArgs = matchDict[syntaxName].matches.reduce(
        (prev, next) => ({
            ...prev,
            [next]: {
                regex: usageRegex(next),
                matches: [],
            },
        }),
        {}
    )
    const usages = await walk(pathname, newMatchDict)
    return Object.keys(usages).map(
        name => `${name}: ${usages[name].matches.length} ${usages[name].matches}`
    )
}

export async function walk(
    dir: fs.PathLike,
    matchDict: WalkArgs
): Promise<WalkArgs> {
    const names: string[] = (await asyncReaddir(dir)).map(name =>
        path.join(dir.toString(), name)
    )
    const stats: Array<fs.Stats> = await asyncMap(names, asyncStat)

    const dict: { [name: string]: fs.Stats } = names.reduce(
        (prev, next) => ({
            ...prev,
            [next]: stats.shift(),
        }),
        {}
    )

    const files = names
        .filter(n => dict[n].isFile())
        .filter(s => s.endsWith('.ts') || s.endsWith('.tsx'))
    const dirs = names
        .filter(n => dict[n].isDirectory())
        .filter(s => !['node_modules', 'dist'].includes(path.basename(s)))
        .filter(s => !path.basename(s).startsWith('.'))

    const getMatches = async (file: fs.PathLike) =>
        await getMatchesInFile(file, matchDict)
    const getWalk = async (_dir: fs.PathLike) => await walk(_dir, matchDict)
    await asyncMap(files, getMatches)
    await asyncMap(dirs, getWalk)

    return matchDict
}

export async function getMatchesInFile(
    file: fs.PathLike,
    matchDict: WalkArgs
): Promise<WalkArgs> {
    const rl = readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
    })
    return new Promise((resolve, reject) => {
        rl.on('line', (line: string) => {
            Object.keys(matchDict).forEach(name => {
                if (matchDict[name].regex.test(line)) {
                    matchDict[name].matches.push(
                        `${matchDict[name].regex.exec(line)[1]}`
                    )
                }
            })
        })
        rl.on('close', () => {
            resolve()
        })
    })
}

function asyncMap<T, K>(array: T[], map: (arg: T) => Promise<K>): Promise<K[]> {
    return Promise.all(array.map(map))
}

function asyncReaddir(dir: fs.PathLike): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const callback = (err: NodeJS.ErrnoException, list: string[]) => {
            if (err) {
                reject(err)
            } else {
                resolve(list)
            }
        }
        fs.readdir(dir, callback)
    })
}

function asyncStat(path: fs.PathLike): Promise<fs.Stats> {
    return new Promise((resolve, reject) => {
        const callback = (err: NodeJS.ErrnoException, o: fs.Stats) => {
            if (err) {
                reject(err)
            } else {
                resolve(o)
            }
        }
        fs.stat(path, callback)
    })
}
