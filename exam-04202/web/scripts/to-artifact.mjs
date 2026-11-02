// Turns dist-single/index.html into page content for hosts that add their own <html>/<head>/<body>.
import { readFileSync, writeFileSync } from 'node:fs'

const html = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8')
const title = html.match(/<title>[\s\S]*?<\/title>/)[0]
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n')
const scripts = [...html.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n')
const out = `${title}
<meta name="claude:viewport-fit-sides" content="cover">
${styles}
<div id="root"></div>
${scripts}
`
writeFileSync(new URL('../dist-single/page.html', import.meta.url), out)
console.log('page.html', Math.round(out.length / 1024), 'KB')
