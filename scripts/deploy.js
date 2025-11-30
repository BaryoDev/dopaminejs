import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../package.json');

const run = (command) => {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
};

const main = () => {
    const args = process.argv.slice(2);
    const bumpType = args[0] || 'patch'; // patch, minor, major

    // 1. Run Tests
    console.log('🧪 Running tests...');
    run('npm test run');

    // 2. Bump Version
    console.log(`📈 Bumping version (${bumpType})...`);
    run(`npm version ${bumpType} --no-git-tag-version`);

    // Get new version
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const newVersion = packageJson.version;
    console.log(`New version: ${newVersion}`);

    // 3. Build
    console.log('🏗️ Building...');
    run('npm run build');

    // 4. Commit and Tag
    console.log('🔖 Committing and tagging...');
    run('git add .');
    run(`git commit -m "Release v${newVersion}"`);
    run(`git tag v${newVersion}`);

    // 5. Push
    console.log('🚀 Pushing to remote...');
    run('git push && git push --tags');

    // 6. Publish
    console.log('📦 Publishing to npm...');
    run('npm publish');


    console.log(`✅ Successfully released v${newVersion}!`);
};

main();
