# Antenatal Calculator

A Progressive Web App (PWA) for healthcare professionals in Nepal.

## Features
- EDD & POG calculation by LMP (Nepali B.S. date)
- EDD & POG calculation by 1st Trimester Dating Scan
- WHO Fetal Growth Calculator (HC, AC, FL, BPD, HL, EFW)
  - Percentiles based on Kiserud et al. PLOS Medicine 2017
  - Coefficients: github.com/jcarvalho45/whoFetalGrowth
- Hadlock III EFW auto-calculation
- Dark / Light mode
- Works fully offline (PWA)

## Files
- `index.html`       — Main app shell
- `style.css`        — All styles
- `app.js`           — All application logic + WHO coefficients
- `service-worker.js`— Offline caching
- `manifest.json`    — PWA manifest
- `icon-192.png`     — App icon (add your own)
- `icon-512.png`     — App icon (add your own)

## Install on Phone

**Android (Chrome):**
1. Open in Chrome → tap ⋮ menu → Add to Home screen → Install

**iPhone (Safari):**
1. Open in Safari → tap Share → Add to Home Screen

## Offline Use
After first load, the app works fully offline.
All WHO coefficient data is bundled in app.js — no internet needed for calculations.

## Developed by
Jimi Syangbo, MBBS 4th Year, MMC
