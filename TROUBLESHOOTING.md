# Troubleshooting — Expo Go fejlesztői környezet

## 1. Node.js verzió inkompatibilitás

**Tünet:** `npx expo start` után a bundler megakad, semmi nem történik, vagy `chalk.default.yellow is not a function` hiba.

**Ok:** Node.js v24 inkompatibilis az Expo SDK 54-gyel (a chalk library nem működik vele).

**Megoldás:**
```bash
# Node 20 telepítése (ha még nincs)
nvm install 20

# Node 20 aktiválása (MINDEN terminál indításkor!)
source ~/.nvm/nvm.sh && nvm use 20

# Ellenőrzés
node -v  # v20.x.x kell legyen
```

**Fontos:** Minden új terminálban újra kell futtatni a `source ~/.nvm/nvm.sh && nvm use 20` parancsot!

---

## 2. `expo: command not found`

**Tünet:** `npx expo start` → `sh: expo: command not found`

**Ok:** A `node_modules` korrupt, vagy a `.bin` szimbolikus linkek hiányoznak (pl. párhuzamos npm install-ok miatt).

**Megoldás:**
```bash
rm -rf node_modules package-lock.json
npm install
npx expo start
```

---

## 3. Korrupt `node_modules` (duplikált mappák)

**Tünet:** `node_modules`-ban furcsa nevek jelennek meg: `expo 2`, `@expo 3`, `@firebase 4` stb.

**Ok:** Több `npm install` futott párhuzamosan (pl. Claude Code háttérfeladatok + manuális install).

**Megoldás:**
```bash
# 1. Lőj le MINDEN npm/node processzt
pkill -f "npm install"
pkill -f "expo start"

# 2. Töröld és telepítsd újra (EGY terminálban, egymás után!)
rm -rf node_modules package-lock.json
npm install
```

**Megelőzés:** Soha ne futtass egyszerre több `npm install`-t!

---

## 4. Expo Go nem tud csatlakozni (hálózati hiba)

**Tünet:** QR kód megjelenik, de a telefon nem tud csatlakozni a dev serverhez.

**Lehetséges okok:**
- **AP isolation** a routeren (a telefon és a Mac nem látják egymást)
- Tűzfal blokkolja a portot

**Megoldás:**
- Próbáld tunnel módban: `npx expo start --tunnel`
- Vagy kapcsold ki az AP isolation-t a router beállításaiban
- Vagy használj USB-t / ugyanazt a hálózatot hotspot-on keresztül

---

## Expo Go indítás — gyors checklist

Minden alkalommal amikor fejleszteni akarsz:

```bash
source ~/.nvm/nvm.sh && nvm use 20
cd /Users/danipozsik/Desktop/claudecode/mobilapp
npx expo start
```

Ha bármi hiba → először ellenőrizd: `node -v` (v20.x.x kell legyen!)
