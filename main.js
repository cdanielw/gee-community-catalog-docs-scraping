const simpleGit = require('simple-git')
const fs = require('fs').promises
const {catchError, concatMap, from, map, of, switchMap, tap, toArray} = require('rxjs')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const GIT_PROJECT_URL = 'https://github.com/samapriya/awesome-gee-community-datasets.git'
const GIT_PROJECT_DIR = 'output/awesome-gee-community-datasets'
const GIT_PROJECT_DOCS_DIR = `${GIT_PROJECT_DIR}/docs`
const DOCS_DOMAIN = 'https://gee-community-catalog.org/'
const UPDATED_DATASET_FILE = 'output/community_datasets.json'

updateGitProject$().pipe(
    switchMap(toAsset$),
    concatMap(addDocsLink$),
    toArray(),
    switchMap(dataSets => from(fs.writeFile(UPDATED_DATASET_FILE, JSON.stringify(dataSets, null, 2))))
).subscribe({
    error: error => console.error('Failed to update docs links', error)
})

function addDocsLink$(asset) {
    return from(exec(`grep -rl '${asset.id}' '${GIT_PROJECT_DOCS_DIR}'`))
        .pipe(
            catchError(() => [{stdout: ''}]),
            map(({stdout}) => stdoutToFiles(asset, stdout)),
            map(files => addDocsToAsset(asset, files))
        )
}

function addDocsToAsset(asset, files) {
    return files.length === 1
        ? {
            ...asset,
            docs: `${DOCS_DOMAIN}${files[0].slice(GIT_PROJECT_DOCS_DIR.length + 1, -3)}/`
        }
        : asset
}

function stdoutToFiles(asset, stdout) {
    const files = stdout.split('\n').filter(file => file)
    if (files.length === 0) {
        console.log('Missing:', asset.id)
    } else if (files.length > 1) {
        console.log('Used in more than two files:', asset.id, files)
    }
    return files
}

function toAsset$() {
    return parseJsonFile$('community_datasets.json').pipe(
        switchMap(dataSets => of(...dataSets))
    )
}

function parseJsonFile$(path) {
    return from(fs.readFile(`${GIT_PROJECT_DIR}/${path}`)).pipe(
        map(file => JSON.parse(file))
    )
}

function updateGitProject$() {
    return from(fs.access(GIT_PROJECT_DIR)).pipe(
        tap(() => simpleGit(GIT_PROJECT_DIR).pull()),
        catchError(() => simpleGit().clone(GIT_PROJECT_URL, GIT_PROJECT_DIR))
    )
}
