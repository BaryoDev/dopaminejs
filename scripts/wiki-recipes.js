#!/usr/bin/env node
/**
 * Writes the wiki recipe pages from the demo and two tests.
 *
 * Usage: node scripts/wiki-recipes.js <dir of a dopaminejs.wiki clone>
 *
 * The recipes quote demo/index.html, tests/ReactProvider.test.js and
 * tests/VueHostComponent.test.js, so run this after the demo moves (see
 * "Releasing" in CLAUDE.md), then commit and push the wiki. It writes the seven
 * Recipe-*.md files and nothing else. Every snippet is read before any file is
 * written, so a snippet that no longer matches fails with nothing half written.
 * tests/WikiRecipes.test.js runs it.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node scripts/wiki-recipes.js <dir of a dopaminejs.wiki clone>';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

if (!target || !existsSync(target) || !statSync(target).isDirectory()) {
    console.error(USAGE);
    process.exit(1);
}

const tests = join(root, 'packages/dopaminejs/tests');
const demo = readFileSync(join(root, 'demo/index.html'), 'utf8');
const react = readFileSync(join(tests, 'ReactProvider.test.js'), 'utf8');
const vue = readFileSync(join(tests, 'VueHostComponent.test.js'), 'utf8');

function grab(src, pattern) {
    const match = src.match(pattern);
    if (!match) {
        console.error(`wiki-recipes: no match for ${pattern}`);
        process.exit(1);
    }
    return match[0];
}

const HEAD = grab(demo, /<link rel="stylesheet" href="https:\/\/cdn[^>]*>/s)
    + '\n' + grab(demo, /<script src="https:\/\/cdn.*?<\/script>/s);
const SCRIPT = grab(demo, /<script>\n.*?\n<\/script>/s);
const VIDEO = grab(demo, /<video.*?<\/video>/s);
const ARTICLE = grab(demo, /<article.*?<\/article>/s);
const OL = grab(demo, /<ol>.*?<\/ol>/s);
const FORM = grab(demo, /<form.*?<\/form>/s);
const PREVENT = grab(demo, /document.getElementById\('signup'\).*?\n/s);
const ACH = grab(demo, /const progress = .*?\n\}\);/s);
const BOOT = grab(demo, /const host = .*?\nDopamine.auto\(\{ host \}\);/s);
const LESSON = grab(react, /    function LessonDone\(\).*?\n    function Lesson\(\).*?\n    \}\n/s)
    .trimEnd().split('\n').map((l) => (l.startsWith('    ') ? l.slice(4) : l)).join('\n');
const VUEC = grab(vue, /const XPButton = defineComponent.*?\n\}\);/s);
const VUEI = "import { defineComponent, h, onUnmounted } from 'vue';\nimport { createDopamine } from 'dopaminejs';";
if (!vue.includes(VUEI)) {
    console.error('wiki-recipes: the Vue test no longer has the import lines the recipe quotes');
    process.exit(1);
}

const DEMO = 'https://baryodev.github.io/dopaminejs/';
const SETUP = `Put this in the page. It loads dopaminejs 3.8.0 from jsDelivr, and the \`integrity\` values make the browser refuse a changed file:

\`\`\`html
${HEAD}
\`\`\`

Trimmed from demo/index.html.
`;


const pages = {
    'Recipe-Video-Completion.md': `# Recipe: video completion

Give XP and a celebration when a video plays to the end. Live: [course section of the demo](${DEMO}#course).

${SETUP}
Put the reward on the video. \`ended\` fires when it finishes:

\`\`\`html
${VIDEO}
\`\`\`

From demo/index.html.

This page uses its own achievement, so it builds the host itself. If you only want XP and a celebration, use \`data-dopamine-xp\` and \`data-dopamine-celebrate\` on the video and add \`data-dopamine-auto\` to the script tag instead. See the README section "Rewards from HTML attributes".

The achievement \`lesson_done\` has to exist on the host. This is the script that defines it and starts \`auto\`:

\`\`\`html
${SCRIPT}
\`\`\`

From demo/index.html.

Each element rewards once per page load. Add \`data-dopamine-repeat\` to reward every time.
`,
    'Recipe-Course-Certificate.md': `# Recipe: course certificate

Show a certificate with Download, Print and Close after a lesson. Live: [course section of the demo](${DEMO}#course).

${SETUP}
The \`data-dopamine-certificate-*\` attributes hold the fields. With \`data-dopamine-celebrate="certificate"\` the celebration plays first and the certificate opens after it:

\`\`\`html
${VIDEO}
\`\`\`

From demo/index.html.

The fields are \`title\`, \`recipient\`, \`date\`, \`issuer\` and \`logo\`. They are text.

The achievement the video names is defined here, before \`auto\` starts:

\`\`\`js
${ACH}
\`\`\`

From demo/index.html.
`,
    'Recipe-Reading-Streak.md': `# Recipe: reading streak

Give XP when a reader reaches the end of a post, and show the streak toast. Live: [blog section of the demo](${DEMO}#blog).

${SETUP}
\`read\` adds an invisible one pixel element as the last child of the article and fires when it scrolls into view:

\`\`\`html
${ARTICLE}
\`\`\`

From demo/index.html.

The \`streak\` preset is the toast. The streak itself is counted by the core: one day with XP extends it, and a missed day resets it. Streaks use the reader's local calendar date. Start the host and \`auto\` with:

\`\`\`js
${BOOT}
\`\`\`

From demo/index.html.
`,
    'Recipe-Onboarding-Checklist.md': `# Recipe: onboarding checklist

XP for each step, and a badge for the last one. Live: [docs section of the demo](${DEMO}#docs).

${SETUP}
Each button rewards once. The last one also unlocks the achievement and shows the \`milestone\` toast:

\`\`\`html
${OL}
\`\`\`

From demo/index.html.

The \`tutorial_badge\` achievement is defined in the page script:

\`\`\`js
${ACH}
\`\`\`

From demo/index.html.
`,
    'Recipe-Form-Completion.md': `# Recipe: form completion

XP when a form is submitted. Live: [form section of the demo](${DEMO}#form).

${SETUP}
\`\`\`html
${FORM}
\`\`\`

From demo/index.html.

\`auto\` hears the submit and awards the XP, but it never cancels the submit. Your page decides what happens next. The demo stops the page from navigating with this line of its script:

\`\`\`js
${PREVENT.trimEnd()}
\`\`\`

From demo/index.html.

If the form navigates away on submit, the page may unload before the XP is saved. Keep the user on the page, as the demo does, or award the XP on the next page.
`,
    'Recipe-React.md': `# Recipe: React

XP from a React component. Uses \`dopaminejs-react\` 2.2.0. Live: [the demo](${DEMO}) shows the same rewards from HTML attributes.

\`\`\`bash
npm install dopaminejs dopaminejs-react
\`\`\`

Wrap the tree in \`RewardsProvider\` and call \`useRewards()\` below it. The test builds elements with \`React.createElement\`, and JSX is the same thing. The test runs it against stand-ins for React, not a real renderer.

\`\`\`js
import React from 'react';
import { RewardsProvider, useRewards } from 'dopaminejs-react';

${LESSON}
\`\`\`

From tests/ReactProvider.test.js.

\`addXP(amount, reason)\` passes the reason to the \`xp_gained\` event. Call it from an event handler, not during render. See [React](React) for everything the hook returns.
`,
    'Recipe-Vue.md': `# Recipe: Vue

XP from a Vue component, using the \`dopaminejs\` core. Live: [the demo](${DEMO}) shows the same rewards from HTML attributes.

\`\`\`bash
npm install dopaminejs
\`\`\`

Create the host in \`setup\` and dispose it when the component unmounts. Disposing removes its overlay:

\`\`\`js
${VUEI}

${VUEC}
\`\`\`

From tests/VueHostComponent.test.js.

\`options\` goes to \`createDopamine()\`. Leave it out for the defaults. Create one host for the whole page, not one per component, if several components award XP: build it in the root component and pass it down with \`provide\` and \`inject\`.

With server rendering, create the host on mount, not in setup.
`
};

for (const [name, text] of Object.entries(pages)) writeFileSync(join(target, name), text);
