const { series, parallel, watch, src, dest } = require('gulp');
const pump = require('pump');
const fs = require('fs');
const glob = require('glob');
const order = require('ordered-read-streams');
const argv = require('yargs').argv;
const exec = require('child_process').exec;

// gulp plugins
const livereload = require('gulp-livereload');
const postcss = require('gulp-postcss');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const beeper = require('beeper');
const zip = require('gulp-zip');

// postcss plugins
const easyimport = require('postcss-easy-import');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

// Daftar paket lama untuk perbedaan versi
const oldPackages = [
    'packages/alto', 'packages/bulletin', 'packages/dawn', 'packages/digest', 'packages/dope', 
    'packages/ease', 'packages/edge', 'packages/edition', 'packages/headline', 'packages/journal', 
    'packages/london', 'packages/ruby', 'packages/solo', 'packages/wave'
];

// Tugas untuk menjalankan livereload
function serve(done) {
    livereload.listen();
    done();
}

// Menangani error dengan memberi tanda bunyi
function handleError(done) {
    return function (err) {
        if (err) beeper();
        return done(err);
    };
}

// Memproses Handlebars (hbs)
function doHBS(path, done) {
    pump([
        src([`${path}/*.hbs`, `${path}/partials/**/*.hbs`]),
        livereload()
    ], handleError(done));
}

// Memproses CSS
function doCSS(path, done) {
    pump([
        src(`${path}/assets/css/screen.css`, { sourcemaps: true }),
        postcss([
            easyimport,
            autoprefixer(),
            cssnano()
        ]),
        dest(`${path}/assets/built/`, { sourcemaps: '.' }),
        livereload()
    ], handleError(done));
}

// Menyiapkan file JS
function getJsFiles(version, path) {
    const jsFiles = [
        src(`packages/_shared/assets/js/${version}/lib/**/*.js`),
        src(`packages/_shared/assets/js/${version}/main.js`),
    ];

    if (fs.existsSync(`${path}/assets/js/lib`)) {
        jsFiles.push(src(`${path}/assets/js/lib/**/*.js`));
    }

    jsFiles.push(src(`${path}/assets/js/main.js`));

    return jsFiles;
}

// Memproses JavaScript
function doJS(path, done) {
    const version = oldPackages.includes(path.replace(/^.\//, '')) ? 'v1' : 'v2';
    pump([
        order(getJsFiles(version, path), { sourcemaps: true }),
        concat('main.min.js'),
        uglify(),
        dest(`${path}/assets/built/`, { sourcemaps: '.' }),
        livereload()
    ], handleError(done));
}

// Task utama
function main(done) {
    const tasks = glob.sync('packages/*', { ignore: 'packages/_shared' }).map(path => {
        const packageName = require(`./${path}/package.json`).name;

        function package(taskDone) {
            const hbs = (done) => doHBS(path, done);
            hbs.displayName = `hbs_${packageName}`;

            const css = (done) => doCSS(path, done);
            css.displayName = `css_${packageName}`;

            const js = (done) => doJS(path, done);
            js.displayName = `js_${packageName}`;

            const hbsWatcher = () => watch([`${path}/*.hbs`, `${path}/partials/**/*.hbs`], hbs);
            hbsWatcher.displayName = `hbsWatcher_${packageName}`;

            const cssWatcher = () => watch(`${path}/assets/css/**/*.css`, css);
            cssWatcher.displayName = `cssWatcher_${packageName}`;

            const jsWatcher = () => watch(`${path}/assets/js/**/*.js`, js);
            jsWatcher.displayName = `jsWatcher_${packageName}`;

            const watcher = parallel(hbsWatcher, cssWatcher, jsWatcher);
            const build = series(css, js);

            series(build, serve, watcher)();
            taskDone();
        }

        package.displayName = packageName;
        return package;
    });

    // Shared CSS dan JS untuk v1 dan v2
    function sharedCSS_v1(done) {
        oldPackages.map(path => {
            pump([
                src(`${path}/assets/css/screen.css`, { sourcemaps: true }),
                postcss([easyimport, autoprefixer(), cssnano()]),
                dest(`${path}/assets/built/`, { sourcemaps: '.' }),
                livereload()
            ], handleError(done));
        });
    }

    const sharedCSSWatcher_v1 = () => watch('packages/_shared/assets/css/v1/**/*.css', sharedCSS_v1);

    function sharedCSS_v2(done) {
        glob.sync('packages/*', { ignore: ['packages/_shared', ...oldPackages] }).map(path => {
            pump([
                src(`${path}/assets/css/screen.css`, { sourcemaps: true }),
                postcss([easyimport, autoprefixer(), cssnano()]),
                dest(`${path}/assets/built/`, { sourcemaps: '.' }),
                livereload()
            ], handleError(done));
        });
    }

    const sharedCSSWatcher_v2 = () => watch('packages/_shared/assets/css/v2/**/*.css', sharedCSS_v2);

    // Shared JS untuk v1 dan v2
    function sharedJS_v1(done) {
        oldPackages.map(path => {
            pump([
                order(getJsFiles('v1', path), { sourcemaps: true }),
                concat('main.min.js'),
                uglify(),
                dest(`${path}/assets/built/`, { sourcemaps: '.' }),
                livereload()
            ], handleError(done));
        });
    }

    const sharedJSWatcher_v1 = () => watch('packages/_shared/assets/js/v1/**/*.js', sharedJS_v1);

    function sharedJS_v2(done) {
        glob.sync('packages/*', { ignore: ['packages/_shared', ...oldPackages] }).map(path => {
            pump([
                order(getJsFiles('v2', path), { sourcemaps: true }),
                concat('main.min.js'),
                uglify(),
                dest(`${path}/assets/built/`, { sourcemaps: '.' }),
                livereload()
            ], handleError(done));
        });
    }

    const sharedJSWatcher_v2 = () => watch('packages/_shared/assets/js/v2/**/*.js', sharedJS_v2);

    function copyPartials(done) {
        glob.sync('packages/*', { ignore: ['packages/_shared', ...oldPackages] }).map(path => {
            pump([
                src('packages/_shared/partials/*'),
                dest(`${path}/partials/components/`),
                livereload()
            ], handleError(done));
        });
    }

    const sharedPartialWatcher = () => watch('packages/_shared/partials/*.hbs', copyPartials);

    const sharedWatcher = parallel(sharedCSSWatcher_v1, sharedCSSWatcher_v2, sharedJSWatcher_v1, sharedJSWatcher_v2, sharedPartialWatcher);

    return series(parallel(...tasks), copyPartials, sharedWatcher, tasksDone => {
        tasksDone();
        done();
    })();
}

// Membuat symlink untuk tema ke direktori Ghost
function symlink(done) {
    if (!argv.theme || !argv.site) {
        handleError(done('Required parameters [--theme, --site] missing!'));
    }

    exec(`ln -sfn ${__dirname}/packages/${argv.theme} ${argv.site}/content/themes`);
    done();
}

// Menguji tema dengan gscan
function test(done) {
    const testGScan = gscanDone => {
        glob.sync('packages/*', { ignore: 'packages/_shared' }).forEach(path => {
            exec(`gscan ${path} --colors`, (error, stdout, _stderr) => {
                console.log(stdout);
                if (error) process.exit(1);
            });
        });
        gscanDone();
    }

    return series(testGScan, tasksDone => {
        tasksDone();
        done();
    })();
}

// Pengujian CI untuk tema
function testCI(done) {
    if (!argv.theme) {
        handleError(done('Required parameter [--theme] missing!'));
    }

    const testGScan = gscanDone => {
        exec(`gscan --fatal --verbose packages/${argv.theme} --colors`, (error, stdout, _stderr) => {
            console.log(stdout);
            if (error) process.exit(1);
        });
        gscanDone();
    }

    return series(testGScan, tasksDone => {
        tasksDone();
        done();
    })();
}

// Menyiapkan CSS untuk tema yang ditentukan
function css(done) {
    doCSS(`./packages/${argv.theme}`, done);
}

// Menyiapkan JS untuk tema yang ditentukan
function js(done) {
    doJS(`./packages/${argv.theme}`, done);
}

// Build CSS dan JS
const build = series(css, js);

// Mengemas tema menjadi file ZIP
function zipper(done) {
    if (!argv.theme) {
        handleError(done('Required parameter [--theme] missing!'));
    }

    const filename = require(`./packages/${argv.theme}/package.json`).name + '.zip';

    pump([
        src([
            '**',
            '!node_modules', '!node_modules/**',
            '!dist', '!dist/**',
            '!yarn-error.log'
        ], { cwd: `./packages/${argv.theme}` }),
        zip(filename),
        dest(`packages/${argv.theme}/dist/`)
    ], handleError(done));
}

exports.symlink = symlink;
exports.test = test;
exports.testCI = testCI;
exports.zip = series(build, zipper);
exports.default = main;
