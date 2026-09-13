# MDY Solutions — redesign cinematic 3D

Propunere de site nou pentru [mdysolutions.ro](https://mdysolutions.ro): o pagină unică, cinematică, cu scenă WebGL persistentă, categorii simplificate la patru direcții și tot conținutul real al companiei (soluții, produse, industrii, proces, blog, contact).

Site live (GitHub Pages): https://flaviusvranau1.github.io/mdy-solutions-redesign/

Actualizare 13.09.2026: nucleu metalic cu reflexii de studio, siglă în relief,
inele cu volum și mișcare independentă de rata de cadre. Scena se oprește în
afara ecranului; cardurile și butoanele au inerție mai fină. Pe telefon, 3D-ul
are un spațiu propriu. Versiunea inițială este păstrată în tag-ul
`before-3d-upgrade-2026-09-13`. Detalii și undo: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

Previzualizare în Claude (Artifact): https://claude.ai/code/artifact/9f79a181-4f26-4d64-b243-715dbf2b059a

## Ce conține

| Fișier | Rol |
|---|---|
| `index.html` | Pagina completă (conținut, iconițe SVG inline, formular) |
| `styles.css` | Sistemul de design: tokeni de brand (teal `#19cbd3`, aqua `#8ff7f7`, navy), tipografie, carduri glass, layout responsive |
| `scene.js` | Scena 3D (Three.js): materiale fizice, iluminare de studio, siglă în relief, noduri cu impulsuri, inele orbitale, parallax și oprire automată în afara ecranului |
| `main.js` | Interacțiuni: scroll lin (Lenis), reveal-uri pe linii (GSAP SplitText), traseu orizontal pinned, tilt 3D pe carduri, cursor custom, butoane magnetice, panouri de detalii, formular |

## Stack

- [Three.js r128](https://threejs.org/) (build UMD, de pe cdnjs)
- [GSAP 3.13](https://gsap.com/) + ScrollTrigger + SplitText (cdnjs)
- [Lenis 1.1](https://lenis.darkroom.engineering/) (jsdelivr)
- Google Fonts: Archivo (display, lățime 118–125%), Manrope (text), JetBrains Mono (etichete)
- Fără build step, fără dependențe locale: patru fișiere statice.

## Rulare locală

```bash
npx --yes http-server . -p 8765 -c-1
```

Apoi deschide http://localhost:8765. Orice server static merge (Live Server din VS Code, `python -m http.server`), pagina are nevoie de HTTP doar pentru fonturi și scripturile de pe CDN.

## Publicare

Fișierele se pot urca direct pe Netlify, Vercel, GitHub Pages sau în `public_html` pe orice hosting. Nu există backend: formularul de contact deschide clientul de email al vizitatorului cu mesajul precompletat către `office@mdysolutions.ro`. Pentru trimitere directă din pagină se poate lega la Netlify Forms, Formspree sau un endpoint propriu.

## Structura paginii

1. Hero cu scena 3D și titlul companiei: „Software integrat. Procese clare. Rezultate măsurabile.”
2. Integrare reală (divizii specializate, soluții integrate, o singură direcție)
3. Soluții: Software & Aplicații · Infrastructură, Cloud & Rețea · Cyber Security · Managed IT & Suport, fiecare cu panou de detalii
4. Produse MDY: Courier Manager și Production Hub, cu mini-dashboard demonstrativ (date fictive, marcate ca atare)
5. Industrii (6)
6. Cum lucrăm: traseu orizontal în patru pași
7. De ce MDY
8. Din blog (articolele reale de pe mdysolutions.ro)
9. CTA și contact

## Note

- Conținutul provine din paginile publice ale site-ului actual; numerele din secțiunea de produse sunt cele demonstrative publicate de MDY.
- Logo-ul este o recreare SVG (hexagon + M + noduri) în spiritul celui original și se poate înlocui cu fișierul oficial.
- Animațiile respectă `prefers-reduced-motion`; fără WebGL, hero-ul cade pe un halou CSS.
