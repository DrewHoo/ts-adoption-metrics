import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';


function main() {
    debugger;
    const pathname = '/Users/drew.hoover/Projects/novo/'
    walk(pathname, /export interface\s([\w\d]*)[<\s]/).then(result =>
        console.log(result, result.length))
    walk(pathname, /([\w\d]*):\sany|([\w\d]*)=>\sany/).then(result =>
        console.log(result, result.length))
}
main()
export async function walk(dir: fs.PathLike, regex: RegExp): Promise<string[]> {
    const names: string[] = (await asyncReaddir(dir)).map(name => path.join(dir.toString(), name))
    const stats: Array<fs.Stats> = await asyncMap(names, asyncStat);

    const dict: { [name: string]: fs.Stats } = names.reduce((prev, next) => ({
        ...prev,
        [next]: stats.shift()
    }), {});

    const files = names.filter(n => dict[n].isFile()).filter(s => s.endsWith('.ts'));
    const dirs = names.filter(n => dict[n].isDirectory())
        .filter(s => !['node_modules', 'dist'].includes(path.basename(s)))
        .filter(s => !path.basename(s).startsWith('.'));

    const getMatches = async (file: fs.PathLike) => {
        let thing;
        try {
            thing = await getMatchesInFile(file, regex);
        } catch (error) {
            console.log(error);
        }
        return thing
    }
    const getWalk = async (_dir: fs.PathLike) => await walk(_dir, regex);

    return [
        ...(await asyncMap(files, getMatches)),
        ...(await asyncMap(dirs, getWalk)),
    ].reduce((prev, next) => prev.concat(next), []);
}

export async function getMatchesInFile(file: fs.PathLike, regex: RegExp): Promise<string[]> {
    const readable = fs.createReadStream(file);
    const rl = readline.createInterface({
        input: readable,
        crlfDelay: Infinity
    });
    return new Promise((resolve, reject) => {

        const matches: string[] = []
        rl.on('line', (line: string) => {
            if (regex.test(line)) {
                matches.push(`${regex.exec(line)[1]}`)
            }
        })
        rl.on('close', () => {
            resolve(matches)
        });
    });
}

function asyncMap<T, K>(array: T[], map: (arg: T) => Promise<K>): Promise<K[]> {
    return Promise.all(array.map(map));
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
                reject(err);
            } else {
                resolve(o);
            }
        }
        fs.stat(path, callback);
    })
}
