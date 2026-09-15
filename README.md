# MDY Solutions — redesign cinematic 3D

Propunere de site nou pentru [mdysolutions.ro](https://mdysolutions.ro): o pagină unică, cinematică, cu scenă WebGL persistentă, categorii simplificate la patru direcții și tot conținutul real al companiei (soluții, produse, industrii, proces, blog, contact).

Site live (GitHub Pages): https://flaviusvranau1.github.io/mdy-solutions-redesign/

Compară variantele:
- [Varianta originală](https://flaviusvranau1.github.io/mdy-solutions-redesign/original/) (prima propunere, înghețată)
- [Varianta actuală](https://flaviusvranau1.github.io/mdy-solutions-redesign/)

Actualizare 15.09.2026, după feedback-ul MDY: globul din hero e înlocuit cu ecosistemul MDY
(hexagonul lor) construit în 3D real, cardurile de soluții, produse și industrii au pozele MDY,
iar tipografia folosește fonturile lor (Barlow Condensed și Inter). Punctele luminoase de pe toată
pagina și mișcarea continuă rămân. Istoric și undo: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

## Ce conține

| Fișier | Rol |
|---|---|
| `index.html` | Pagina completă (conținut, iconițe SVG inline, formular) |
| `styles.css` | Sistemul de design: tokeni de brand (teal `#19cbd3`, aqua `#8ff7f7`, navy), fonturile MDY, carduri glass cu poze, layout responsive |
| `scene.js` | Scena 3D (Three.js): ecosistemul MDY ca panglică pliată, iconițe 3D, logo, câmp de particule |
| `main.js` | Interacțiuni: scroll lin (Lenis), reveal-uri (GSAP SplitText), traseu orizontal pinned, tilt 3D pe carduri cu parallax în poze, cursor custom, butoane magnetice, panouri de detalii, formular |
| `assets/img/` | Pozele și logo-ul din tema clientului, redimensionate pentru web (WebP 14–49 KB) |

## Eroul 3D

Imaginea clientului cu hexagonul (Soluții Software · Arhitectură & Integrare · Date & Tehnologie) e reconstruită în 3D real, nu pusă ca poză:

- panglica e o bandă Möbius triunghiulară cu trei plieri rulate la 60°, generată matematic (reflexii succesive față de liniile de pliere) și randată cu shader propriu: gradient pe fiecare panou, margini neon, impulsuri de date care circulă pe margini, reflex lucios;
- fiecare panou are textul desenat cu fonturile MDY și o iconiță 3D animată (monitor cu roată dințată, servere cu cloud și noduri, bază de date cu scut și grafic);
- în centru, logo-ul MDY decupat din imaginea originală, pe două straturi de adâncime;
- intro: panglica se „desenează” cu un front de lumină, apoi apar logo-ul, textele și iconițele; la mouse se înclină, panoul de sub cursor se ridică, click duce la Soluții; la scroll se rotește și panourile se desprind;
- fără WebGL sau cu „reduce motion”: imaginea originală / stare statică.

## Stack

- [Three.js r128](https://threejs.org/) (build UMD, de pe cdnjs)
- [GSAP 3.13](https://gsap.com/) + ScrollTrigger + SplitText (cdnjs)
- [Lenis 1.1](https://lenis.darkroom.engineering/) (jsdelivr)
- Google Fonts: Barlow Condensed (titluri, etichete, butoane) și Inter (text) — fonturile folosite de MDY
- Fără build step, fără dependențe locale: fișiere statice.

## Rulare locală

```bash
npx --yes http-server . -p 8765 -c-1
```

Apoi deschide http://localhost:8765. Pagina are nevoie de HTTP (nu `file://`), pentru texturile 3D, fonturi și scripturile de pe CDN.

## Publicare

Fișierele se pot urca direct pe Netlify, Vercel, GitHub Pages sau în `public_html` pe orice hosting. Nu există backend: formularul de contact deschide clientul de email al vizitatorului cu mesajul precompletat către `office@mdysolutions.ro`. Pentru trimitere directă din pagină se poate lega la Netlify Forms, Formspree sau un endpoint propriu.

## Structura paginii

1. Hero cu ecosistemul MDY în 3D și titlul „Software integrat. Procese clare. Rezultate măsurabile.”
2. Integrare reală (divizii specializate, soluții integrate, o singură direcție)
3. Soluții: Software & Aplicații · Infrastructură, Cloud & Rețea · Cyber Security · Managed IT & Suport, fiecare cu poză și panou de detalii
4. Produse MDY: Courier Manager și Production Hub, cu poză și mini-dashboard demonstrativ (date fictive, marcate ca atare)
5. Industrii (6), cu pozele MDY
6. Cum lucrăm: traseu orizontal în patru pași
7. De ce MDY
8. Din blog (articolele reale de pe mdysolutions.ro)
9. CTA și contact

## Note

- Conținutul provine din paginile publice ale site-ului actual; numerele din secțiunea de produse sunt cele demonstrative publicate de MDY.
- Pozele, logo-ul și imaginea ecosistemului vin din tema WordPress a clientului (arhiva „MDY Web”).
- Animațiile respectă `prefers-reduced-motion`.
