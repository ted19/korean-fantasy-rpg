# Project: Korean Fantasy RPG Web Game

## Architecture
- **Server**: Express.js (port 4000) - `server/`
- **Client**: React CRA (port 3000) - `client/`
- **Database**: MySQL (localhost:3306, root/root, database: game)
- **3D Engine**: Three.js + React Three Fiber (SRPG battle system)

## Tech Stack
- Backend: Express, mysql2, bcrypt, jsonwebtoken, cors
- Frontend: React 19, react-router-dom 7, axios, three.js
- No UI framework (all custom CSS)
- Python + SDXL-Turbo for AI image generation (RTX 4070 Ti)

## Key Files
- `server/db.js` - DB initialization, all table schemas, seed data
- `server/index.js` - Express server entry, route mounting
- `server/routes/` - API routes (auth, character, monster, dungeon, summon, shop, quest, equipment, skill, hunt)
- `client/src/App.js` - Main router, auth state
- `client/src/pages/Home.js` - Game hub layout (Sidebar + LocationNav + content)
- `client/src/pages/` - All game pages (Login, Register, CreateCharacter, VillageArea, HuntArea, DungeonArea, Shop, Quest, Equipment, Summon, SummonEquipment, Sidebar, BattleLog, MonsterBestiary, SkillPanel, LocationNav)
- `client/src/srpg/` - SRPG battle (SrpgBattle.js, IsometricMap.js, battleEngine.js, mapData.js)

## CSS Structure
- `App.css` (~1938 lines) - Main styles (auth, layout, sidebar, shop, quest, equipment, summon, skills)
- `DungeonArea.css` (~375 lines) - Dungeon cards, roadmap
- `MonsterBestiary.css` (~321 lines) - Monster encyclopedia
- `SrpgBattle.css` (~491 lines) - Battle HUD, actions
- `index.css` (13 lines) - Global font

## Game Systems
- 3 character classes: 풍수사, 무당, 승려
- 126 monsters with 6 AI types (aggressive, defensive, ranged, support, boss, coward)
- 20 monster skills (attack, heal, buff, debuff, aoe)
- 12 summons with equipment and skills
- SRPG isometric tile-based tactical battle
- Equipment (drag-and-drop), Shop, Quest, Skill systems

## Image Assets
- `client/public/monsters/` - 252 PNGs (126 monsters x icon 256px + full 512px)
- `client/public/summons/` - 24 PNGs (12 summons x icon + full)
- `client/public/characters/` - 6 PNGs (3 classes x icon + full)
- Generated locally with SDXL-Turbo (`generate_images.py`)
- Image URL pattern: `/monsters/{id}_icon.png`, `/monsters/{id}_full.png`

## Color Scheme
- Primary bg: #1a1a2e (dark navy)
- Accent: #e94560 (pink/red)
- Gold: #ffa502
- Blue: #1e90ff
- Green: #2ed573
- Text: #eee / #aaa / #888

## User Preferences
- 질문하지 말고 바로 진행할 것
- 결정 사항은 기억해서 다시 묻지 않기
- Korean language for in-game text
