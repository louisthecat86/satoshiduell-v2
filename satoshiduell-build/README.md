# 🎮 SatoshiDuell - Refactored Build

## ✅ Build-Ready React Projekt

Dieses ist das **vollständige, lauffähige** Refactoring von SatoshiDuell mit allen Modulen und Dependencies.

## 📁 Projekt-Struktur

```
satoshiduell-build/
├── src/
│   ├── components/
│   │   ├── ui/              # Button, Card, Background
│   │   ├── game/            # QuizQuestion
│   │   └── payment/         # InvoiceDisplay, WithdrawDisplay
│   ├── hooks/               # useAuth, useGame, usePayment, useDuels
│   ├── services/            # supabase, lnbits, nostr
│   ├── utils/               # formatters, validators, crypto, sound, etc.
│   ├── constants/           # config
│   ├── views/               # GameView (+ weitere TODO)
│   ├── App.jsx              # Haupt-App (Demo-Version)
│   ├── main.jsx             # React Entry Point
│   ├── index.css            # Tailwind CSS
│   └── translations.js      # i18n
├── public/                  # Static Assets
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env.example
```

## 🚀 Installation & Start

### 1. Dependencies installieren
```bash
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env
# Dann .env mit deinen Credentials bearbeiten
```

### 3. Development Server
```bash
npm run dev
```

### 4. Production Build
```bash
npm run build
```

## 🔧 Konfiguration

### Supabase Setup
1. Erstelle ein Supabase Projekt
2. Kopiere URL und Anon Key
3. Trage sie in `.env` ein:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_KEY=eyJxxx...
   ```

### LNbits Setup
1. Erstelle eine LNbits Wallet
2. Generiere einen Invoice Key
3. Trage ihn in `.env` ein:
   ```
   VITE_LNBITS_URL=https://legend.lnbits.com
   VITE_INVOICE_KEY=xxx
   ```

## 📦 Dependencies

### Core
- React 18.2
- Vite 5.0
- Tailwind CSS 3.4

### Bitcoin/Lightning
- @supabase/supabase-js
- nostr-tools

### UI
- lucide-react (Icons)
- qrcode.react
- canvas-confetti

## 🎯 Features

### 🔊 Sounds

Die App verwendet vier Sound-Dateien: `click.mp3`, `correct.mp3`, `wrong.mp3` und `tick.mp3`. Lege diese Dateien unverändert in den `public/` Ordner (z. B. `public/click.mp3`), damit sie unter `/click.mp3` erreichbar sind. Du kannst deine eigenen Dateien aus dem alten Projekt verwenden. Die Sounds lassen sich in den Einstellungen ein- bzw. ausschalten (Schalter "Sound").



### ✅ Implementiert
- Modulare Architektur
- Custom Hooks (Auth, Game, Payment, Duels)
- Service Layer (Supabase, LNbits, Nostr)
- Utility Functions (Formatters, Validators, Crypto, etc.)
- UI Components (Button, Card, Background, etc.)
- Demo App

### 📝 TODO (aus Original App.jsx extrahieren)
- Alle View-Komponenten
- Context für globalen State
- Vollständige App.jsx mit Routing
- Admin Panel
- Tournament System

## 🧪 Testing

Die modulare Struktur ermöglicht einfaches Unit Testing:

```bash
# Tests schreiben für:
- utils/formatters.test.js
- utils/validators.test.js
- hooks/useAuth.test.js
# etc.
```

## 📖 Verwendung

### Hooks verwenden
```jsx
import { useAuth } from './hooks';

function MyComponent() {
  const { login, user } = useAuth();
  
  const handleLogin = async () => {
    await login(username, pin);
  };
}
```

### Services verwenden
```jsx
import { getActiveQuestions } from './services/supabase';

const questions = await getActiveQuestions();
```

### Utils verwenden
```jsx
import { formatSats, validatePin } from './utils';

const formatted = formatSats(1000000); // "1.000.000"
const isValid = validatePin("1234").valid; // true
```

## 🎨 Demo Features

Die aktuelle Demo zeigt:
- ✅ Formatters in Aktion
- ✅ Validators in Aktion
- ✅ Sound System
- ✅ Modulare Struktur
- ✅ Tailwind Styling

## 🔄 Migration vom Original

Um die vollständige App zu haben:
1. Views aus Original App.jsx extrahieren
2. Context für Auth/Settings hinzufügen
3. Router implementieren
4. Admin Components integrieren

Siehe `REFACTORING_GUIDE.md` und `MIGRATION_CHECKLIST.md` für Details.

## 📝 Nächste Schritte

1. **Views erstellen**: Alle Screens aus App.jsx extrahieren
2. **Testing**: Unit Tests schreiben
3. **TypeScript**: Optional für Type Safety
4. **Performance**: Lazy Loading, Code Splitting

## 🤝 Contributing

1. Fork das Projekt
2. Feature Branch erstellen
3. Changes committen
4. Pull Request öffnen

## 📄 Lizenz

MIT License

---

**Built with 🧡 and ⚡**
