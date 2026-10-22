# Alexander Rybashov — Landing

Статичный лендинг: один `index.html` + `assets/`. Без сборки.

## Локально
```bash
python -m http.server 5173
```
Открыть http://localhost:5173

## Деплой на GitHub Pages
1. Создать репозиторий (например `arybashov/arybashov.github.io` — тогда сайт будет на корне домена).
2. `git remote add origin https://github.com/arybashov/<repo>.git && git push -u origin main`
3. Settings → Pages → Deploy from branch → main / root.

## Источники контента
- Webflow: https://alexander-rybashov.webflow.io/
- GitHub Pages: https://arybashov.github.io/portfolio/ (репо arybashov/portfolio, локально Documents/_Portfolio)
- Резюме: репо arybashov/resume-site (локально Documents/RESUME_SITE)

## Правка текстов
Русский текст — прямо в HTML (атрибуты `data-i`), английский — в объекте `EN` в скрипте внизу.
