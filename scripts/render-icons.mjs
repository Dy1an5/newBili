import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');

const background = '#F7F5F0';
const ring = {
    cx: 516,
    cy: 480.5,
    rx: 423.9,
    ry: 205.3,
    rotation: -24.13,
    strokeWidth: 34.3,
};
const planet = { cx: 509.9, cy: 490.6, r: 131.8 };
const moons = [
    { cx: 373.8, cy: 326.7, r: 34 },
    { cx: 723, cy: 591.3, r: 34 },
];
const artCenter = { x: 512, y: 480.4 };
// Adaptive icons guarantee only the central 66dp of 108dp is visible under every mask.
const adaptiveScale = 0.72;

const artTransform = [
    `translate(512 512)`,
    `scale(${adaptiveScale})`,
    `translate(${-artCenter.x} ${-artCenter.y})`,
].join(' ');

function ringElement(stroke, extra = '') {
    return `<ellipse cx="${ring.cx}" cy="${ring.cy}" rx="${ring.rx}" ry="${ring.ry}" transform="rotate(${ring.rotation} ${ring.cx} ${ring.cy})" fill="none" stroke="${stroke}" stroke-width="${ring.strokeWidth}"${extra}/>`;
}

function moonElements(radius = moons[0].r) {
    return moons
        .map((moon) => `<circle cx="${moon.cx}" cy="${moon.cy}" r="${radius}" fill="url(#moon)"/>`)
        .join('\n        ');
}

function colorArt() {
    return `<g>
        <defs>
            <linearGradient id="ring" gradientUnits="userSpaceOnUse" x1="340" y1="120" x2="700" y2="800">
                <stop offset="0" stop-color="#D3895F"/>
                <stop offset="0.55" stop-color="#C56942"/>
                <stop offset="1" stop-color="#BE6039"/>
            </linearGradient>
            <radialGradient id="planet" cx="0.36" cy="0.32" r="0.82">
                <stop offset="0" stop-color="#DC8B5E"/>
                <stop offset="0.55" stop-color="#C4623A"/>
                <stop offset="1" stop-color="#A44E2A"/>
            </radialGradient>
            <radialGradient id="moon" cx="0.36" cy="0.3" r="0.85">
                <stop offset="0" stop-color="#F6D0B0"/>
                <stop offset="0.55" stop-color="#EAB288"/>
                <stop offset="1" stop-color="#E1A070"/>
            </radialGradient>
            <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#FFFFFF"/>
                <stop offset="0.2" stop-color="#FFFFFF"/>
                <stop offset="1" stop-color="#000000"/>
            </radialGradient>
            <radialGradient id="hide" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stop-color="#000000"/>
                <stop offset="0.35" stop-color="#000000"/>
                <stop offset="1" stop-color="#FFFFFF"/>
            </radialGradient>
            <mask id="glowMask">
                <rect width="1024" height="1024" fill="#000000"/>
                <circle cx="352" cy="342" r="190" fill="url(#glow)"/>
                <ellipse cx="672" cy="630" rx="270" ry="125" transform="rotate(145 672 630)" fill="url(#glow)"/>
            </mask>
            <mask id="moonFade">
                <rect width="1024" height="1024" fill="#FFFFFF"/>
                <circle cx="374" cy="327" r="94" fill="url(#hide)"/>
                <circle cx="723" cy="591" r="94" fill="url(#hide)"/>
            </mask>
        </defs>
        <g mask="url(#moonFade)">
            ${ringElement('url(#ring)')}
            ${ringElement('#DFA47C', ' opacity="0.6" mask="url(#glowMask)"')}
        </g>
        <circle cx="${planet.cx}" cy="${planet.cy}" r="${planet.r}" fill="url(#planet)"/>
        ${moonElements()}
    </g>`;
}

function monochromeArt() {
    return `<g fill="#FFFFFF">
        <defs>
            <mask id="moonGaps">
                <rect width="1024" height="1024" fill="#FFFFFF"/>
                <circle cx="${moons[0].cx}" cy="${moons[0].cy}" r="58" fill="#000000"/>
                <circle cx="${moons[1].cx}" cy="${moons[1].cy}" r="58" fill="#000000"/>
            </mask>
        </defs>
        ${ringElement('#FFFFFF', ' mask="url(#moonGaps)"')}
        <circle cx="${planet.cx}" cy="${planet.cy}" r="${planet.r}"/>
        ${moons.map((moon) => `<circle cx="${moon.cx}" cy="${moon.cy}" r="${moon.r}"/>`).join('\n        ')}
    </g>`;
}

function document(body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    ${body}
</svg>
`;
}

const files = [
    {
        name: 'icon',
        svg: document(`<rect width="1024" height="1024" fill="${background}"/>
    ${colorArt()}`),
    },
    {
        name: 'adaptive-icon',
        svg: document(`<g transform="${artTransform}">
        ${colorArt()}
    </g>`),
    },
    {
        name: 'monochrome-icon',
        svg: document(`<g transform="${artTransform}">
        ${monochromeArt()}
    </g>`),
    },
];

for (const file of files) {
    const svgPath = path.join(assets, `${file.name}.svg`);
    const pngPath = path.join(assets, `${file.name}.png`);
    writeFileSync(svgPath, file.svg);
    execFileSync('rsvg-convert', ['-w', '1024', '-h', '1024', svgPath, '-o', pngPath]);
    console.log(`${path.relative(root, pngPath)}`);
}
