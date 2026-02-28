import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image
import os
import time

# 디렉토리 준비
MONSTER_DIR = "F:/project/game/client/public/monsters"
SUMMON_DIR = "F:/project/game/client/public/summons"
CHAR_DIR = "F:/project/game/client/public/characters"

os.makedirs(MONSTER_DIR, exist_ok=True)
os.makedirs(SUMMON_DIR, exist_ok=True)
os.makedirs(CHAR_DIR, exist_ok=True)

# SDXL-Turbo 로드 (높은 품질 설정)
print("Loading SDXL-Turbo model...")
pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/sdxl-turbo",
    torch_dtype=torch.float16,
    variant="fp16"
)
pipe = pipe.to("cuda")
pipe.enable_attention_slicing()
print("Model loaded!")

# D&D 컨셉아트 스타일
STYLE_PREFIX = "in the style of Dungeons and Dragons concept art, official D&D monster manual illustration"
STYLE_SUFFIX = "highly detailed, dramatic lighting, painterly style, rich colors, dark fantasy, parchment tones"
NEG_PROMPT = "pixel art, cartoon, anime, chibi, low quality, blurry, text, watermark, signature, deformed"

def generate_image(prompt, output_path, size=512):
    """고품질 이미지 생성"""
    try:
        result = pipe(
            prompt=prompt,
            negative_prompt=NEG_PROMPT,
            num_inference_steps=8,
            guidance_scale=2.0,
            width=size,
            height=size,
        )
        result.images[0].save(output_path)
        fsize = os.path.getsize(output_path) / 1024
        print(f"  OK: {output_path} ({fsize:.0f}KB)")
    except Exception as e:
        print(f"  ERROR: {output_path} - {e}")

# ============================================================
# 몬스터 데이터 (126종)
# ============================================================
monsters = [
    {"id":10,"name":"들쥐","tier":1},
    {"id":11,"name":"야생 늑대","tier":2},
    {"id":12,"name":"독거미","tier":1},
    {"id":13,"name":"동굴 박쥐","tier":2},
    {"id":14,"name":"골렘","tier":4},
    {"id":15,"name":"지하 도마뱀","tier":3},
    {"id":16,"name":"원혼","tier":4},
    {"id":17,"name":"저주받은 승려","tier":5},
    {"id":18,"name":"어둠의 수호자","tier":6},
    {"id":19,"name":"산토끼","tier":1},
    {"id":20,"name":"멧돼지","tier":2},
    {"id":21,"name":"독사","tier":2},
    {"id":22,"name":"흑곰","tier":4},
    {"id":23,"name":"설표","tier":5},
    {"id":24,"name":"회색 곰","tier":5},
    {"id":25,"name":"구렁이","tier":3},
    {"id":26,"name":"백호","tier":8},
    {"id":27,"name":"삼두견","tier":7},
    {"id":28,"name":"천년 여우","tier":6},
    {"id":29,"name":"거대 지네","tier":2},
    {"id":30,"name":"독나방","tier":1},
    {"id":31,"name":"킬러비","tier":2},
    {"id":32,"name":"전갈","tier":3},
    {"id":33,"name":"여왕 개미","tier":4},
    {"id":34,"name":"장수풍뎅이","tier":3},
    {"id":35,"name":"독 거미 여왕","tier":5},
    {"id":36,"name":"사마귀 전사","tier":3},
    {"id":37,"name":"스켈레톤","tier":2},
    {"id":38,"name":"좀비","tier":2},
    {"id":39,"name":"구울","tier":3},
    {"id":40,"name":"레이스","tier":4},
    {"id":41,"name":"뱀파이어","tier":6},
    {"id":42,"name":"데스나이트","tier":7},
    {"id":43,"name":"리치왕","tier":9},
    {"id":44,"name":"해골 궁수","tier":2},
    {"id":45,"name":"미라","tier":4},
    {"id":46,"name":"떠도는 영혼","tier":1},
    {"id":47,"name":"처녀귀신","tier":3},
    {"id":48,"name":"야차","tier":4},
    {"id":49,"name":"물귀신","tier":3},
    {"id":50,"name":"이무기","tier":8},
    {"id":51,"name":"검은 그림자","tier":5},
    {"id":52,"name":"봉사귀","tier":2},
    {"id":53,"name":"달귀","tier":5},
    {"id":54,"name":"물의 정령","tier":2},
    {"id":55,"name":"불의 정령","tier":3},
    {"id":56,"name":"바람의 정령","tier":2},
    {"id":57,"name":"대지의 정령","tier":3},
    {"id":58,"name":"번개 정령","tier":4},
    {"id":59,"name":"얼음 정령","tier":4},
    {"id":60,"name":"빛의 정령","tier":6},
    {"id":61,"name":"어둠의 정령","tier":6},
    {"id":62,"name":"정령왕","tier":8},
    {"id":63,"name":"임프","tier":1},
    {"id":64,"name":"서큐버스","tier":4},
    {"id":65,"name":"인큐버스","tier":4},
    {"id":66,"name":"지옥견","tier":5},
    {"id":67,"name":"발록","tier":8},
    {"id":68,"name":"마왕의 부하","tier":6},
    {"id":69,"name":"타락 천사","tier":7},
    {"id":70,"name":"마왕","tier":10},
    {"id":71,"name":"가고일","tier":3},
    {"id":72,"name":"드래곤 해츨링","tier":3},
    {"id":73,"name":"와이번","tier":5},
    {"id":74,"name":"화룡","tier":8},
    {"id":75,"name":"빙룡","tier":8},
    {"id":76,"name":"암흑룡","tier":9},
    {"id":77,"name":"용왕","tier":10},
    {"id":78,"name":"드레이크","tier":4},
    {"id":79,"name":"히드라","tier":9},
    {"id":80,"name":"마법 갑옷","tier":3},
    {"id":81,"name":"가디언","tier":5},
    {"id":82,"name":"호문쿨루스","tier":2},
    {"id":83,"name":"마나 골렘","tier":5},
    {"id":84,"name":"유니콘","tier":5},
    {"id":85,"name":"그리핀","tier":6},
    {"id":86,"name":"피닉스","tier":7},
    {"id":87,"name":"미믹","tier":3},
    {"id":88,"name":"독버섯","tier":1},
    {"id":89,"name":"덩굴괴물","tier":2},
    {"id":90,"name":"트렌트","tier":4},
    {"id":91,"name":"식인화","tier":3},
    {"id":92,"name":"포자 군체","tier":1},
    {"id":93,"name":"만드레이크","tier":3},
    {"id":94,"name":"세계수의 파편","tier":7},
    {"id":95,"name":"균류 군주","tier":6},
    {"id":96,"name":"산적","tier":1},
    {"id":97,"name":"암살자","tier":3},
    {"id":98,"name":"흑마법사","tier":4},
    {"id":99,"name":"타락 기사","tier":5},
    {"id":100,"name":"광전사","tier":4},
    {"id":101,"name":"네크로맨서","tier":5},
    {"id":102,"name":"대마법사","tier":7},
    {"id":103,"name":"도적 두목","tier":3},
    {"id":104,"name":"꼬마 도깨비","tier":1},
    {"id":105,"name":"불 도깨비","tier":2},
    {"id":106,"name":"돌 도깨비","tier":3},
    {"id":107,"name":"도깨비 장군","tier":5},
    {"id":108,"name":"깨비대왕","tier":7},
    {"id":109,"name":"연못 도깨비","tier":2},
    {"id":110,"name":"도깨비 방망이","tier":4},
    {"id":111,"name":"숲 도깨비","tier":1},
    {"id":112,"name":"구미호","tier":6},
    {"id":113,"name":"해태","tier":7},
    {"id":114,"name":"불가사리","tier":6},
    {"id":115,"name":"키메라","tier":7},
    {"id":116,"name":"미노타우르스","tier":5},
    {"id":117,"name":"메두사","tier":5},
    {"id":118,"name":"거인","tier":6},
    {"id":119,"name":"늑대인간","tier":4},
    {"id":120,"name":"초록 슬라임","tier":1},
    {"id":121,"name":"파랑 슬라임","tier":1},
    {"id":122,"name":"빨강 슬라임","tier":2},
    {"id":123,"name":"독 슬라임","tier":2},
    {"id":124,"name":"금속 슬라임","tier":4},
    {"id":125,"name":"킹 슬라임","tier":5},
    {"id":126,"name":"젤리피쉬","tier":1},
    {"id":127,"name":"점액 군주","tier":6},
    {"id":128,"name":"대왕 게","tier":3},
    {"id":129,"name":"상어","tier":5},
    {"id":130,"name":"대왕 문어","tier":4},
    {"id":131,"name":"인어 전사","tier":3},
    {"id":132,"name":"심해어","tier":2},
    {"id":133,"name":"크라켄","tier":9},
    {"id":134,"name":"해마 기사","tier":2},
    {"id":135,"name":"바다 용","tier":8},
]

# 소환수 데이터 (12종)
summons = [
    {"id":1,"name":"떠도는 원혼","type":"undead"},
    {"id":2,"name":"묘지 귀신","type":"undead"},
    {"id":3,"name":"구미호 영혼","type":"spirit"},
    {"id":4,"name":"들쥐 소환수","type":"beast"},
    {"id":5,"name":"야생 늑대","type":"beast"},
    {"id":6,"name":"골렘 파편","type":"golem"},
    {"id":7,"name":"독거미 여왕","type":"insect"},
    {"id":8,"name":"물의 정령","type":"elemental"},
    {"id":9,"name":"불의 정령","type":"elemental"},
    {"id":10,"name":"바람의 정령","type":"elemental"},
    {"id":11,"name":"해골 전사","type":"undead"},
    {"id":12,"name":"리치","type":"undead"},
]

# 캐릭터 클래스 (3종)
characters = [
    {"id":"pungsu","name":"풍수사","desc":"바람과 물의 기운을 다루는 풍수지리 술사"},
    {"id":"mudang","name":"무당","desc":"신령과 소통하는 무속인, 굿과 주술을 사용"},
    {"id":"monk","name":"승려","desc":"불교의 수행승, 강인한 체력과 법력을 겸비"},
]

# ============================================================
# D&D 컨셉아트 프롬프트 (디테일 강화)
# ============================================================

def get_tier_quality(tier):
    if tier >= 8:
        return "legendary creature, epic boss monster, godlike presence, extremely detailed rendering, masterwork illustration"
    elif tier >= 5:
        return "powerful elite creature, impressive magical aura, detailed anatomy, professional quality"
    elif tier >= 3:
        return "dangerous creature, detailed features, battle-ready, skilled rendering"
    else:
        return "common creature, small but threatening, naturalistic detail"

MONSTER_PROMPTS = {
    "들쥐": "A dire rat crouching in tall dead grass, mangy brown-gray fur matted with filth, beady red eyes gleaming with cunning, yellowed incisors bared, long scaly tail curled behind, claws digging into mud",
    "야생 늑대": "A dire wolf stalking through a dark pine forest, thick gray fur bristling along its spine, amber eyes locked on prey, powerful jaw with exposed fangs dripping saliva, muscular haunches tensed to spring, moonlight filtering through canopy",
    "독거미": "A giant spider lurking in a web-filled cavern, bulbous black abdomen with crimson hourglass marking, eight hairy segmented legs spread wide, multiple glistening eyes reflecting torchlight, venomous fangs dripping green ichor, silk strands trailing from spinnerets",
    "동굴 박쥐": "A giant bat hanging from a stalactite-covered cave ceiling, enormous leathery wingspan unfurled, oversized pointed ears twitching, tiny red eyes piercing the darkness, razor-sharp claws gripping stone, echolocation waves visible as faint ripples in the air",
    "골렘": "A massive stone golem standing in an ancient ruined hall, body hewn from granite blocks with glowing arcane runes carved across chest and arms, moss growing in crevices, fists like boulders, empty eye sockets blazing with eldritch blue fire, cracks leaking magical energy",
    "지하 도마뱀": "A giant subterranean lizard emerging from a crack in cave rock, dark green-brown scales glistening with moisture, long forked tongue tasting the air, powerful tail used for balance, rows of small sharp teeth, bioluminescent patches along its flanks illuminating the darkness",
    "원혼": "A tormented Korean ghost floating above a misty graveyard, translucent pale blue ethereal form with visible ribcage and spine, traditional Korean mourning garb flowing weightlessly, hollow eye sockets weeping spectral tears, long wispy hair defying gravity, surrounded by orbiting will-o-wisps",
    "저주받은 승려": "A cursed undead Buddhist monk standing in a ruined mountain temple, decomposing flesh visible beneath torn saffron robes, prayer beads fused into decaying wrist, glowing cursed sutras orbiting his body, one eye socket empty and the other burning with green hellfire, dark corruption veins spreading across skin",
    "어둠의 수호자": "A towering shadow guardian clad in ornate obsidian plate armor engraved with warding sigils, wielding a massive two-handed glaive wreathed in purple shadow flames, a horned helmet with glowing violet eyes peering through the visor slit, dark cape billowing with spectral energy, guarding an ancient sealed doorway",
    "산토끼": "A mountain hare crouched on a rocky alpine ledge, thick white-tipped brown fur for camouflage, oversized alert ears turning like radar dishes, powerful hind legs coiled to leap, twitching nose, bright amber eyes scanning for predators, dawn light catching its whiskers",
    "멧돼지": "A dire boar charging through dense undergrowth, coarse dark bristled hide scarred from many battles, massive yellowed tusks curving upward from a foam-flecked snout, small furious bloodshot eyes, powerful shoulders with a thick ridge of fur, hooves tearing up the forest floor as it charges",
    "독사": "A giant venomous serpent coiled on sun-warmed rocks, iridescent emerald scales with diamond-pattern markings, hood flared wide revealing bright warning colors, forked tongue flickering rapidly, fangs folded back ready to strike, venom glands visibly swollen, hypnotic slitted golden eyes",
    "흑곰": "A massive black bear rearing up on hind legs in a mountain forest clearing, thick glossy black fur, powerful forelimbs with long curved claws extended, jaws open wide showing teeth and pink tongue, small intelligent brown eyes, impressive height dwarfing surrounding pine saplings, scars across muzzle from territorial fights",
    "설표": "A snow leopard prowling across a windswept Himalayan ridge, thick pale gray fur with dark rosette markings, incredibly long bushy tail for balance, piercing pale green eyes, powerful compact body built for leaping across rocky chasms, snowflakes catching in its whiskers, paw prints trailing behind in fresh powder",
    "회색 곰": "A colossal grizzly bear standing at full height beside a rushing mountain river, massive brown-silver fur rippling with muscle, enormous paws with five-inch claws, broad scarred face with wise dark eyes, hump of muscle at the shoulders, salmon leaping in the rapids behind, pine-covered mountainside backdrop",
    "구렁이": "A giant constrictor python coiled around a fallen temple pillar in a tropical ruin, thick muscular body with olive-brown diamond-patterned scales, powerful coils squeezing with visible tension, head raised with jaw slightly open revealing backward-curving teeth, cold calculating amber eyes, body thick as a man's torso",
    "백호": "A legendary celestial white tiger standing atop a sacred mountain peak at dawn, pristine white fur with silver-blue stripe markings that glow with divine energy, piercing sapphire eyes radiating wisdom and power, massive muscular frame twice the size of a normal tiger, surrounded by swirling clouds and holy light, ancient Korean temple visible in the distance",
    "삼두견": "A three-headed hellhound standing at the gates of the underworld, each massive head different: one wreathed in fire with burning eyes, one dripping with acid and bearing a snarl, one surrounded by shadow with ghostly eyes, muscular black body with smoldering cracks in skin revealing inner hellfire, spiked chain collar, brimstone ground cracking beneath its weight",
    "천년 여우": "An ancient mystical thousand-year fox spirit in a moonlit bamboo grove, elegant vulpine form with nine flowing tails each tipped with foxfire, luminous golden fur shimmering with ancient magic, knowing eyes that have witnessed centuries, subtle human-like intelligence in its expression, surrounded by floating spirit orbs and falling autumn leaves",
    "거대 지네": "A giant centipede writhing through narrow cave tunnels, dark chitinous segmented body as long as a horse, hundreds of sharp-tipped legs clicking against stone, oversized venomous mandibles dripping paralytic toxin, antennae sweeping the darkness, each body segment armored with ridged plates, bioluminescent spots along its sides",
    "독나방": "A giant poisonous moth hovering in a moonlit forest clearing, enormous tattered wings covered in hypnotic eye-spot patterns in purple and crimson, thick fuzzy thorax dusted with toxic spores, feathery antennae spread wide sensing prey, compound eyes reflecting moonlight in prismatic colors, trail of poisonous dust falling from wingbeats",
    "킬러비": "A giant killer bee hovering aggressively in a sun-dappled meadow, glossy black and amber-striped exoskeleton, transparent iridescent wings beating in a blur, massive barbed stinger glistening with venom, compound eyes like faceted rubies, powerful mandibles for cutting, pollen-dusted legs, swarm of normal bees visible in the background",
    "전갈": "A giant desert scorpion partially buried in wind-swept sand dunes, dark brown chitinous armor glinting in harsh sunlight, massive pincers raised in threat display with serrated inner edges, segmented tail arched high overhead with crystalline stinger dripping amber venom, eight jointed legs braced wide, ancient ruins half-buried in sand behind",
    "여왕 개미": "A bloated giant ant queen in a vast underground egg chamber, enormous pale abdomen pulsing with new life, powerful mandibles on an armored head with crown-like ridges, attended by smaller worker ants bringing food, walls of the chamber packed with translucent eggs, bioluminescent fungi providing eerie green light, complex tunnel system visible in cross-section",
    "장수풍뎅이": "A giant rhinoceros beetle lumbering through a Korean mountain forest, gleaming dark brown chitinous shell reflecting dappled sunlight, massive forked horn used for combat, powerful legs with hooked claws gripping a thick tree branch, iridescent wing cases slightly parted, small compound eyes, bark and wood debris scattered around",
    "독 거미 여왕": "A colossal spider queen enthroned on a massive web strung between ancient pillars, bloated dark purple abdomen marked with skull-like patterns, eight armored legs each as thick as tree trunks, crown of smaller eyes above two massive primary eyes glowing toxic green, egg sacs hanging from web strands, bones of previous victims tangled in silk below",
    "사마귀 전사": "A giant praying mantis warrior standing upright in a bamboo thicket, dark green exoskeleton with natural camouflage patterns, massive raptorial forelegs with serrated inner edges raised in strike position, triangular head rotating to track prey with enormous compound eyes, folded wings ready for sudden flight, mantis religiosa stance of deadly patience",
    "스켈레톤": "An animated skeleton warrior standing guard in a torch-lit dungeon corridor, bones yellowed with age held together by faint necromantic energy visible as green mist at the joints, wielding a corroded iron shortsword and a dented round shield bearing a faded heraldic device, tattered remnants of clothing hanging from frame, jaw clenched in a permanent death grin, empty eye sockets flickering with dim green light",
    "좀비": "A shambling zombie emerging from a fog-shrouded graveyard, decomposing gray-green flesh peeling from exposed muscle and bone, torn and mud-stained burial clothes, one arm reaching forward with blackened fingernails, jaw hanging loose with a few remaining teeth, milky white dead eyes, trail of grave dirt behind it, broken headstone in the background",
    "구울": "A ghoul crouched over remains in a dark catacomb, elongated gaunt frame with gray leathery skin stretched tight over bones, oversized jaw filled with sharp teeth designed for cracking bone, long clawed fingers, hunched posture with protruding spine, feral cunning in its sunken glowing eyes, tattered loincloth the only clothing, surrounded by scattered bones",
    "레이스": "A wraith materializing through a castle wall at midnight, barely corporeal form of swirling darkness wearing the tattered remnants of noble robes, skeletal hands with elongated fingers reaching outward, a face of shadow with two burning white eyes in hollow sockets, cold mist emanating from its form, the living wilting as it draws near, chains of spectral energy trailing behind",
    "뱀파이어": "A vampire lord standing in a moonlit Gothic castle balcony, aristocratic features with unnaturally pale skin and pronounced sharp cheekbones, crimson eyes with slit pupils, elongated canine fangs visible in a predatory smile, high-collared black and crimson cloak over ornate dark armor, one pale hand extended with claw-like nails, bats circling the tower behind, full moon casting long shadows",
    "데스나이트": "A death knight astride a spectral black warhorse on a blighted battlefield, massive suit of corrupted black plate armor etched with fell runes glowing crimson, wielding a two-handed greatsword wreathed in necrotic black flames, visor raised to reveal a skull face with burning red pinpoints for eyes, tattered dark cloak, dead soldiers rising as undead in his wake",
    "리치왕": "A lich king seated upon a throne of fused bones and skulls in a vast underground crypt, skeletal form draped in ancient tattered royal robes of midnight blue and gold, a crown of interlocking finger bones set with a pulsing phylactery gem on the brow, one skeletal hand gripping a staff of twisted black iron, green necromantic fire blazing in eye sockets, undead courtiers kneeling before him",
    "해골 궁수": "A skeleton archer perched on a crumbling castle rampart, bones reinforced with strips of rusted chainmail, drawing back a darkwood longbow with a black-fletched arrow nocked, empty eye sockets focused with eerie precision, quiver of barbed arrows on its back, jaw set in determination, moonlit sky with storm clouds behind, other skeleton sentries visible along the wall",
    "미라": "An ancient mummy lord emerging from a gilded sarcophagus in a treasure-filled Egyptian-style tomb, linen wrappings partially unwound revealing desiccated dark skin and golden scarab amulets beneath, glowing amber eyes between bandage strips, elongated withered fingers adorned with ancient rings, hieroglyphic curses glowing on the wrappings, canopic jars and treasure visible around the tomb",
    "떠도는 영혼": "A wandering lost soul drifting through a twilight forest, translucent pale blue spectral form of a once-living person, expression frozen between sadness and confusion, ghostly robes drifting as if underwater, faintly glowing with inner light, surrounded by smaller floating spirit motes, leaving a fading trail of ectoplasmic mist, trees visible through its transparent body",
    "처녀귀신": "A Korean maiden ghost hovering above a lotus pond at midnight, extremely long jet-black hair flowing in all directions defying gravity, traditional white hanbok stained with old blood at the hem, face of haunting beauty with dark hollowed eyes weeping black tears, pale translucent skin, bare feet dangling above dark water reflecting the full moon, cherry blossom petals falling around her",
    "야차": "A yaksha demon crouching on a temple rooftop under stormy skies, powerfully muscular dark-skinned humanoid with bestial features, wild mane of black hair, bulging fierce eyes with orange irises, protruding fangs and tusks from a snarling mouth, wearing a tiger-skin loincloth and bone necklace, long clawed hands gripping the roof tiles, lightning illuminating Korean temple architecture behind",
    "물귀신": "A water ghost rising from a dark mountain lake at night, waterlogged translucent form with bloated blue-gray features, long dark hair spreading like seaweed on the water surface, empty dark eyes, mouth open in a gurgling moan, one hand reaching above the surface with wrinkled pruned fingers, water dripping endlessly from its form, lily pads and reeds around, mist rolling across the still lake",
    "이무기": "A colossal imugi serpent dragon partially emerged from a raging mountain river, immense scaled body as thick as an ancient oak with iridescent dark blue-green scales, partially formed dragon horns budding from a massive wedge-shaped head, wise ancient eyes burning with the desire to ascend to true dragonhood, pearl of power clutched protectively, waterfalls and Korean mountain landscape in the background",
    "검은 그림자": "A shadow entity materializing in a dark alleyway, formless mass of living darkness that absorbs all surrounding light, multiple pairs of crimson eyes opening and closing within its amorphous body, tendrils of shadow reaching outward and consuming the light from nearby lanterns, cobblestones beneath it turning black with corruption, the faint outline of a humanoid shape at its core",
    "봉사귀": "A blind ghost groping through a pitch-dark abandoned Korean house, pale eyeless face with smooth skin where eyes should be, dark sunken depressions where the sockets once were, mouth slightly open in a silent perpetual moan, gray translucent form with long reaching arms and elongated fingers touching everything, traditional Korean hanok architecture decaying around it, dust motes floating in faint moonlight",
    "달귀": "A moon ghost appearing in a forest clearing bathed in full moonlight, ethereal silver-white spectral form that seems woven from moonbeams themselves, crescent-shaped luminous eyes, long flowing hair and robes merging with shafts of moonlight, hovering just above the forest floor, wildflowers beneath her glowing faintly in response to her presence, ring of ancient standing stones in the background",
    "물의 정령": "A water elemental rising from a sacred spring, humanoid form composed entirely of swirling crystal-clear water, features suggested in the flow of currents, a face visible in the churning surface with eyes of deep ocean blue, aquatic plants and small fish caught within its liquid body, spray and mist emanating from its shoulders, standing in a mossy grotto with ferns and waterfalls",
    "불의 정령": "A fire elemental blazing in a volcanic cavern, towering humanoid form of living flame and magma, body shifting between brilliant orange and deep crimson, face formed of white-hot fire with eyes like twin suns, each step leaving molten footprints on stone, arms ending in swirling fire vortices, smoke and embers trailing from its crown, lava flows and volcanic rock visible in the background",
    "바람의 정령": "A wind elemental swirling above a mountain peak, translucent humanoid form visible only by the dust and leaves and snow caught in its perpetual rotation, suggestion of a serene face in the eye of the storm, arms of spiraling air currents extending outward, clouds parting around its form, birds and debris orbiting it at high speed, mountain summit with prayer flags snapping in the gale below",
    "대지의 정령": "An earth elemental standing in an ancient forest grove, massive humanoid form of layered stone and rich dark soil, crystalline minerals jutting from shoulders and knees, face carved from granite with eyes of glowing amber, moss and small plants growing across its body, tree roots winding through its legs, mushrooms sprouting from crevices, ground trembling with each ponderous step",
    "번개 정령": "A lightning elemental crackling above a storm-lashed plain, humanoid form composed of arcing electricity and ball lightning, body constantly shifting between brilliant white and electric blue-purple, face a blazing mask of pure energy with eyes like lightning bolts, fingers extending into branching electrical arcs reaching toward the ground, thunderclouds swirling overhead, scorched earth and glass fulgurites below",
    "얼음 정령": "An ice elemental standing in a frozen mountain pass during a blizzard, humanoid form sculpted from glacial ice and packed snow, transparent torso revealing a glowing cold-blue core, face of carved ice with crystalline eyes, icicle formations hanging from arms and shoulders, frost spreading outward from its feet across the ground, snowflakes orbiting its body, frozen landscape and ice caves behind",
    "빛의 정령": "A radiant light elemental floating in a sacred temple sanctuary, humanoid form of pure warm golden-white luminance, too bright to look at directly, gentle serene features barely visible within the radiance, six wing-like extensions of light spreading behind, prismatic rainbows refracting through its form, shadows fleeing from its presence, stained glass windows of the temple glowing in response",
    "어둠의 정령": "A shadow elemental hovering in a lightless void, humanoid form of absolute darkness deeper than the surrounding gloom, a shape defined by the absence of everything, eyes of swirling purple void energy, tendrils of darkness reaching outward consuming nearby light sources, stars and distant lights being pulled into its form, space itself seeming to bend around its body, cold purple energy at its core",
    "정령왕": "The Elemental King towering over a convergence of natural forces, colossal humanoid form simultaneously composed of all elements, right arm of flame and magma, left arm of glacier ice, torso of living stone with crystal growths, head wreathed in storm clouds with lightning crown, legs rooted in earth with water flowing around, standing where four elemental terrains meet, divine cosmic energy emanating from every surface",
    "임프": "A small imp perched on a dusty tome in a wizard's study, dark crimson skin with a leathery texture, oversized pointed ears, tiny curved horns, long barbed tail wrapped around the book, bat-like wings folded against its back, wide mischievous grin showing needle-sharp teeth, glowing yellow eyes full of cunning malice, one clawed hand gesturing as if making a deal, scattered scrolls and potion bottles around",
    "서큐버스": "A succubus standing in a shadowy boudoir, strikingly beautiful with an inhuman perfection, pale lavender skin, large dark bat-like wings folded elegantly behind, small curved horns emerging from raven-black hair, long pointed tail swaying hypnotically, clawed fingers delicately holding a glowing stolen soul gem, golden eyes with vertical pupils, wearing dark elegant clothing, roses wilting in her proximity",
    "인큐버스": "An incubus leaning against a Gothic archway in a nightmare realm, darkly handsome with sharp angular features, ash-gray skin with subtle scale patterns, large black feathered wings spread wide, small elegant horns curving back from temples, long tail with a spade tip, dressed in dark noble attire, one hand conjuring nightmare mist, piercing crimson eyes that see into dreams, distorted dreamscape visible through the archway",
    "지옥견": "A hellhound prowling the scorched plains of a fiery underworld, massive mastiff-like body with charcoal-black hide, cracks in its skin glowing with inner hellfire, mane of actual flames running along its spine, burning pawprints left on cracked obsidian ground, three rows of iron-strong teeth in a massive jaw, eyes like hot coals, sulfurous smoke rising from its body, hellish landscape of fire and brimstone behind",
    "발록": "A balrog demon lord standing in a vast underground chasm filled with lava, titanic muscular form of living shadow and fire, massive curved ram-like horns wreathed in dark flame, enormous bat-like wings of smoke and ember spreading wide enough to block the cavern, one hand gripping a whip of living fire, the other a sword of dark flame, eyes of molten gold in a terrifying bestial face, magma rivers flowing around its hooved feet",
    "마왕의 부하": "A demon lieutenant commanding troops on a hellish battlefield, hulking humanoid form in spiked dark iron armor forged in hellfire, curved horns protruding through a fearsome helmet, wielding a massive jagged halberd crackling with infernal energy, dark red skin visible at armor gaps, tusked lower jaw set in a war cry, battalion of lesser demons ranked behind, burning siege engines and dark banners in the background",
    "타락 천사": "A fallen angel standing alone in a desolate wasteland of ash, once-magnificent white-feathered wings now broken and blackened at the tips, beautiful sorrowful androgynous face streaked with tears of dark ichor, cracked golden halo flickering above, celestial plate armor tarnished and corroding, a holy sword now dim and notched in one hand, divine light fading from within, crater-scarred battlefield stretching to the horizon",
    "마왕": "The Demon King enthroned in his infernal palace at the heart of the abyss, colossal horned figure of terrible majesty, dark obsidian skin cracked with veins of hellfire, six massive horns forming a crown of bone, burning eyes of absolute malevolence containing ancient intelligence, wearing armor forged from the souls of conquered worlds, seated on a throne of skulls and black iron above a lake of fire, lesser demons prostrating themselves on the burning steps below, the very fabric of reality distorting around his overwhelming presence",
    "가고일": "A gargoyle crouched on a Gothic cathedral buttress overlooking a rain-swept medieval city at night, dark gray stone skin with a rough texture, muscular hunched body with folded bat-like stone wings, horned head with a bestial snarling face, long claws gripping the stone edge, a long whip-like tail curled around the architectural feature, rain running off its body, the moment before it awakens, eyes just beginning to glow amber",
    "드래곤 해츨링": "A dragon hatchling emerging from a cracked iridescent egg in a treasure-filled cave, small but already fierce, jewel-toned green scales still soft and gleaming, oversized golden eyes full of curiosity and hunger, tiny wings unfurling for the first time dripping with amniotic fluid, a few sharp teeth visible in a small jaw that hiccups a puff of smoke, eggshell fragments and coins scattered around, warm torchlight reflecting off gold piles",
    "와이번": "A wyvern diving from storm clouds toward its prey on a windswept moor, powerful two-legged body with leathery dark green-brown wings stretched wide in a hunting dive, long serpentine neck with a narrow head full of needle-like teeth, barbed venomous tail stinger trailing behind, no forelimbs just massive wing-arms with clawed tips, fierce predatory eyes locked on target below, rain and lightning in the dramatic sky",
    "화룡": "An ancient red dragon coiled atop a mountain of gold and treasure in a vast cavern, enormous scaled body of deep crimson and burnt orange, massive wings folded like a cloak of leather and bone, long sinuous neck raising a terrifying horned head, jaw opening to reveal the glow of fire building in its throat, intelligent golden eyes burning with avarice and ancient knowledge, smoke curling from nostrils, the hoard glittering beneath in the firelight",
    "빙룡": "An ancient ice dragon erupting from a glacier in an arctic wasteland, colossal body of pale blue-white scales rimed with frost, wings of translucent ice membrane stretched between crystalline bone spars, long elegant neck with a crown of icicle horns, exhaling a devastating cone of freezing breath that crystallizes the air, eyes like frozen sapphires, blizzard swirling around its form, frozen landscape of icebergs and auroras behind",
    "암흑룡": "An ancient shadow dragon emerging from a rift between dimensions, massive body of scales so dark they seem to absorb light, wings like tears in reality revealing the void between worlds, eyes of swirling purple-black energy, shadow breath dissolving everything it touches into nothingness, horns like twisted obsidian spires, the ground beneath turning to shadow, stars visible through the dimensional tears in its wings, cosmic horror atmosphere",
    "용왕": "The Dragon King in full divine splendor hovering above an endless ocean, supreme dragon of unmatched majesty, golden scales blazing like the sun with each scale inscribed with ancient draconic runes, five-clawed feet symbolizing ultimate authority, pearl of divine wisdom orbiting its head, whiskers flowing like rivers of light, eyes containing the wisdom of ages, storm and calm sea meeting beneath, celestial clouds forming a natural throne, divine radiance illuminating the entire seascape",
    "드레이크": "A wingless drake patrolling a rocky mountain canyon, heavily built quadrupedal dragon cousin with thick overlapping scales of slate gray and brown, powerful jaw with crushing teeth built for crunching through armor, muscular legs with thick claws leaving deep tracks, ridge of bony plates along its spine, scarred veteran of many territorial battles, intelligent reptilian eyes surveying its domain, rocky canyon walls and scrub vegetation around",
    "히드라": "A colossal hydra rising from a foul swamp, five serpentine necks each ending in a different fearsome head with unique features, scales of mottled dark green and black, massive body partially submerged in murky water, some neck stumps actively regenerating with new heads splitting and growing, acidic drool dissolving vegetation below each head, the swamp dying around it, dead trees and bones visible in the mire, oppressive fog",
    "마법 갑옷": "A suit of animated magical armor standing guard in a long-abandoned wizard's laboratory, complete plate armor of midnight blue steel floating with no body inside, held together by visible threads of arcane energy, a longsword hovering beside it ready to strike, runic inscriptions glowing along the armor seams, cape of magical energy flowing behind, visor showing only darkness within, magical implements and dusty bookshelves in the background",
    "가디언": "A magical guardian construct standing sentinel before a massive sealed door in ancient ruins, towering form of enchanted stone and bronze, covered in protective rune carvings that glow with warding magic, four arms each holding a different weapon, crystalline eyes scanning for intruders, ancient and weathered but still perfectly functional, vines and moss growing on its immobile form, torch-lit ruin corridor stretching behind",
    "호문쿨루스": "A homunculus sitting on an alchemist's workbench surrounded by bubbling apparatus, small artificial humanoid roughly one foot tall, pale translucent skin showing visible inner workings, oversized curious eyes with golden irises, slightly wrong proportions giving it an uncanny valley appearance, thin limbs with delicate fingers, connected to an alchemical apparatus by a faint umbilical of energy, glass flasks and alchemical ingredients scattered around",
    "마나 골렘": "A mana golem standing in a ley line convergence point, humanoid form composed entirely of crystallized and flowing magical energy, translucent body revealing a brilliant pulsing arcane core at its center, surface rippling with mathematical arcane formulae, joints connected by pure streams of mana, eyes of concentrated magical light, the air around it shimmering with power, magical ley lines visible in the ground converging at its feet, reality subtly warping nearby",
    "유니콘": "A unicorn standing in a moonlit sacred forest glade, majestic white horse with a flowing silver mane and tail that seem to catch starlight, a single spiraling horn of iridescent pearl emanating soft golden light, intelligent deep violet eyes full of ancient wisdom and kindness, coat glowing with inner purity, flowers blooming in its hoofprints, fireflies dancing around it, a crystal-clear stream nearby reflecting moonlight",
    "그리핀": "A griffin landing on a rocky mountain aerie with a dramatic wingspan, powerful eagle front half with sharp golden-brown feathers and curved razor beak, fierce amber raptor eyes, massive lion hindquarters with tawny fur and long tufted tail, razor-sharp front talons gripping the cliff edge, wind ruffling its feathers and fur, nest with oversized eggs visible behind, panoramic mountain landscape and sunset sky below",
    "피닉스": "A phoenix in the moment of rebirth, rising from a pyre of golden-white flames atop an ancient stone altar, magnificent bird form materializing from the fire with wings of pure flame spreading wide, long tail feathers trailing embers and golden sparks, eyes of blazing white light, the old body's ashes swirling upward to form the new radiant form, surrounding temple columns bathed in warm golden light, the cycle of death and rebirth captured in one breathtaking moment",
    "미믹": "A mimic mid-reveal in a treasure-filled dungeon room, what appeared to be an ornate treasure chest now showing its true nature, the lid splitting open to reveal rows of sharp ivory teeth and a long pink adhesive tongue, pseudopod arms emerging from the sides with grasping tendrils, the wood grain of the chest rippling like skin, one adventurer's boot stuck to its adhesive surface, genuine treasure scattered nearby for comparison, torchlit dungeon stone walls",
    "독버섯": "A poisonous mushroom creature in a dark damp forest hollow, squat body composed of fungal matter with a large purple-spotted cap, glowing toxic spore cloud constantly rising from its cap, root-like legs anchored to the rotting forest floor, small beady eyes on the stem, puckered mouth releasing visible spore puffs, smaller toxic mushrooms growing in a fairy ring around it, dead insects and small animals nearby, eerie bioluminescent glow",
    "덩굴괴물": "A vine monster lurking in an overgrown jungle ruin, a mass of animated thorny dark green vines forming a roughly humanoid shape, a central bulb serving as both heart and eye glowing sickly yellow-green, whip-like vine tendrils reaching outward to grab prey, thorns as long as daggers, partially digested remains tangled within its vine body, flowers with intoxicating pollen as lures, crumbling stone temple walls being reclaimed by vegetation behind",
    "트렌트": "An ancient treant standing in the heart of an old-growth forest, massive living oak tree with a wise bearded face formed in the bark of its trunk, deep-set eyes of amber sap, arms of enormous gnarled branches that can sweep aside boulders, legs of thick root systems slowly walking, birds nesting in its canopy crown, moss and lichen as a green beard, smaller trees and forest animals gathered protectively at its feet, dappled golden sunlight",
    "식인화": "A man-eating plant monster in a tropical greenhouse ruin, massive central maw like a Venus flytrap lined with tooth-like thorns, multiple vine-tentacles reaching outward to grab prey, bioluminescent lure dangling above the maw to attract victims, digestive acid pools visible within the throat, thick trunk-stem with thorn armor, sweet-smelling nectar dripping to mask the smell of decay, bones visible in the soil around its roots",
    "포자 군체": "A floating spore colony drifting through a cavern system, a nebulous cloud of countless tiny bioluminescent spores forming a loose collective consciousness, the mass shifting to form vague facial features and reaching pseudopod shapes, individual spores glowing in shifting colors of blue green and purple, a faint humming vibration in the air, cave walls coated with fungal growth where it has passed, underground river and crystal formations as backdrop",
    "만드레이크": "A mandrake creature being uprooted from magical soil, humanoid root body emerging from the ground with a screaming face contorted in rage, root-like limbs flailing, leafy hair standing on end, skin of bark and root fiber, smaller rootlets trailing from its lower body still connected to the earth, the sound of its scream visible as a shockwave distortion in the air, moonlit witch's garden with magical herbs and cauldron nearby",
    "세계수의 파편": "A fragment of the World Tree given independent life, a walking portion of divine tree trunk and branches of immense size, bark inscribed with the runic history of creation itself glowing with golden light, eyes of pure ancient wisdom formed in knotholes, leaves of every season simultaneously present, roots that reach into other dimensions visible as ethereal tendrils, smaller trees and plants spontaneously growing in its footsteps, sacred forest clearing",
    "균류 군주": "A fungus lord seated on a throne of giant toadstools in a vast underground swamp cavern, massive humanoid form composed entirely of intertwined fungi and mycelium, cap-like crown releasing clouds of controlling spores, multiple arms of branching fungal matter, bioluminescent patches creating an eerie crown of light, network of mycelium spreading across the cavern floor connecting to all nearby fungi, zombie-like fungal thralls standing in attendance, dripping stalactite ceiling",
    "산적": "A Korean mountain bandit stepping out from behind a boulder on a forest trail, weathered rough face with a prominent scar across one cheek, wearing patched and layered peasant clothing with stolen armor pieces, wielding a well-used curved sword, a straw jingasa hat casting shadow over calculating eyes, muscular build from hard mountain living, bandolier of stolen pouches and a short bow on the back, autumn mountain forest trail setting with ambush positions visible",
    "암살자": "An assassin materializing from shadow in a moonlit alley, lean figure wrapped in dark fitted clothing with subtle armor plates, a dark mask leaving only cold calculating eyes visible, dual short blades gleaming with applied poison coating, multiple hidden weapon sheaths and pouches, soft-soled boots making no sound, body positioned in mid-strike with perfect deadly poise, rooftops and shadows of a medieval city at night, a single moonbeam revealing the figure",
    "흑마법사": "A dark sorcerer performing a forbidden ritual in a candlelit chamber, gaunt figure in flowing black and deep purple robes covered in arcane sigils, pale skin with dark veins of corrupted magic spreading from hands, eyes glowing with eldritch power, one hand conjuring a sphere of void energy while the other traces runes in the air that leave glowing afterimages, skull-topped staff floating beside, circle of dark ritual candles and arcane symbols on the floor, forbidden tomes open nearby",
    "타락 기사": "A fallen knight standing in the ruins of a chapel he once swore to protect, once-gleaming plate armor now blackened and corrupted with dark veins of evil energy, heraldic symbols defaced and inverted, wielding a formerly holy sword now pulsing with dark corruption, face visible beneath a raised visor showing conflict and madness, dark aura emanating from his form, stained glass windows shattered behind, altar desecrated, rain pouring through the broken roof",
    "광전사": "A berserker warrior mid-battle-fury on a blood-soaked battlefield, massive muscular frame bare-chested with ritual battle scars and warpaint, eyes wide with supernatural rage, veins bulging, wielding two massive battle axes with reckless abandon, mouth open in a terrifying war scream, surrounded by the aftermath of his rampage, broken weapons and shields scattered around, battle standard flying in the wind behind, stormy sky overhead",
    "네크로맨서": "A necromancer standing in a moonlit graveyard raising the dead, thin robed figure in tattered black vestments with bone clasps, gaunt pale face with sunken eyes blazing with green necromantic fire, raising a staff made of fused vertebrae topped with a glowing skull, one hand directing green energy into the ground below, skeletal hands and undead forms emerging from graves in response to the summons, tombstones and dead trees surrounding, crows perching on nearby crosses",
    "대마법사": "An archmage channeling immense magical power in a vast arcane library, venerable figure in ornate multilayered robes embroidered with constellations that actually move, long silver beard and hair crackling with static energy, both hands raised channeling visible streams of raw magical energy in multiple colors, eyes blazing with arcane knowledge, floating spell components orbiting, towering bookshelves filled with grimoires stretching to infinity behind, multiple magical artifacts glowing on nearby pedestals",
    "도적 두목": "A bandit chief standing confidently on a rocky outcrop above a forest road, imposing scarred veteran with a rakish grin, wearing mix of fine stolen nobleman's clothes and practical leather armor, a well-maintained curved saber at the hip, multiple daggers visible, trophy rings on each finger, commanding presence with arms crossed, a gang of bandits visible in the treeline below blocking the road, stolen merchant wagon being looted, mountain forest at dusk",
    "꼬마 도깨비": "A small dokkaebi goblin peeking out from behind a traditional Korean house pillar at night, small greenish-blue skin with a bumpy texture, oversized round head with stubby horn, wide curious eyes glowing faintly amber, gap-toothed mischievous grin, clutching a tiny wooden club behind its back, wearing a crudely stitched vest, one foot bare leaving a muddy print, fireflies dancing around, traditional Korean village at moonlit night",
    "불 도깨비": "A fire dokkaebi dancing wildly around a bonfire in a forest clearing, body wreathed in dancing flames, orange-red skin cracked like cooling lava revealing bright fire beneath, wild flame-like hair standing upright, fierce grin with sharp glowing teeth, wielding a burning club leaving fire trails in the air, sparks and embers swirling around its energetic dance, nearby trees singed, traditional Korean mountain forest at night backdrop",
    "돌 도깨비": "A stone dokkaebi standing immovable on a mountain path blocking the way, body of rough gray granite with patches of moss, squat and incredibly dense build, face carved into the stone with deep-set glowing amber eyes, stubby stone horn on forehead, arms like stone pillars crossed over chest, small cracks with faint orange glow suggesting inner fire, rocks and pebbles hovering slightly around it, Korean mountain trail with fog setting",
    "도깨비 장군": "A dokkaebi general in full Korean-style demonic battle armor, tall imposing goblin form with dark blue-green skin, magnificent horned helmet with red tassels, ornate dark iron armor with Korean mythological engravings, wielding a massive iron spiked club in one hand, commanding gesture with the other, fierce scarred face with glowing red eyes and prominent tusks, army of lesser dokkaebi visible in formation behind, war drums and battle banners in a mountainous battlefield",
    "깨비대왕": "The great dokkaebi king holding court in a torchlit mountain cave palace, enormous goblin king on a throne of twisted iron and stolen treasures, dark green skin with golden tribal markings, three magnificent horns forming a natural crown, wearing a robe of tiger skin over dark armor, wielding the legendary golden club crackling with supernatural energy, fierce wise eyes glowing bright gold, dokkaebi courtiers and guards attending, cave walls decorated with stolen Korean art and gold",
    "연못 도깨비": "A pond dokkaebi rising waist-deep from a lily-pad covered mountain pond at dusk, slimy blue-green skin with aquatic features like subtle gill slits and webbed fingers, seaweed and pond plants draped over its head like messy hair, wide frog-like grin with small sharp teeth, bulging curious eyes reflecting the sunset, playfully holding a stolen fishing pole, dragonflies hovering nearby, peaceful Korean countryside pond setting with willow trees and distant mountains",
    "도깨비 방망이": "A dokkaebi warrior posing with an oversized enchanted club, muscular green-skinned goblin standing on a moonlit forest path, the massive wooden bang-mangi club covered in glowing mystical Korean inscriptions, fierce battle stance with legs braced wide, wearing simple leather armor with Korean knot ornaments, wild dark hair with a single horn, determined glowing eyes, magical energy swirling around the club head, fireflies and mystical fog in the Korean forest",
    "숲 도깨비": "A forest dokkaebi blending with the woodland in a dense Korean mountain forest, bark-like brown-green skin with actual leaves and small branches growing from its body, camouflaged against a tree trunk with only its glowing green eyes and impish grin visible, one hand behind a tree ready to jump out, wearing a vest of woven leaves, acorns and pinecones tucked into a belt, mushrooms growing on its shoulders, dense atmospheric forest with filtered green light",
    "구미호": "A gumiho nine-tailed fox in a moonlit autumn mountain clearing, caught between forms: elegant woman's upper body in flowing white and red hanbok emerging from the gorgeous body of a massive silver-furred fox, nine magnificent tails fanned out behind each tipped with ghostly blue foxfire, beautiful but predatory golden eyes with fox-slit pupils, delicate clawed fingers, ethereal and seductive, fallen autumn maple leaves swirling around, full harvest moon behind, ancient Korean forest setting",
    "해태": "A haetae guardian beast standing before the gates of a Korean royal palace, magnificent lion-like body covered in jade-green armored scales, single curved horn of pure white on its forehead that glows when detecting evil, wise stern face with a thick flowing mane of dark blue-black, muscular frame with clawed feet standing on a carved stone pedestal, eyes of molten gold that can see truth, small bell collar ringing with divine resonance, ornate Korean palace gate architecture behind, dramatic clouds overhead",
    "불가사리": "A bulgasari stomping through a medieval Korean battlefield consuming metal, massive bull-like beast with dark iron-colored hide that clanks like armor, body growing visibly larger as it devours swords and arrows stuck in its hide, trunk-like snout inhaling metal fragments, small fierce eyes, tusks of living metal, impervious to all weapons which it simply eats, broken siege equipment and discarded weapons being drawn magnetically toward it, terrified soldiers fleeing, Korean fortress walls in background",
    "키메라": "A chimera rampaging through a Greek-inspired ruin, three-headed horror with a snarling lion head as the primary, a bleating goat head rising from the spine on a serpentine neck, and a hissing snake forming the tail, mismatched body stitched together by dark magic with lion forequarters, goat midsection, and dragon-like scaled hindquarters, bat-like wings spread, the lion head breathing gouts of fire, shattered marble columns and temple remains, thunderstorm sky",
    "미노타우르스": "A minotaur guardian standing in the center of a vast underground labyrinth, towering muscular humanoid body with the head of a massive black bull, curved horns as wide as a doorway with battle notches, wielding an enormous double-headed greataxe stained dark, heavy iron ring through the nose, scarred hide showing years of battle, the maze stretching behind in all directions lit by guttering torches, bones of those who failed to solve the maze scattered at its hooved feet",
    "메두사": "A medusa in her lair within an ancient Greek-inspired temple, terrifyingly beautiful feminine face with serpentine features, hair of dozens of living venomous snakes each hissing independently, lower body of a massive serpent coiled on steps, elegant but deadly clawed hands, eyes glowing with petrifying magic caught mid-gaze, her lair filled with hyper-realistic stone statues of adventurers frozen in expressions of terror, crumbling columns and broken mirrors strategically placed, dim torchlight casting dramatic shadows",
    "거인": "A frost giant surveying a frozen mountain valley from a towering cliff, colossal blue-skinned humanoid standing thirty feet tall, wearing armor of thick beast hides and hammered ice-metal, wielding a greataxe carved from a single glacier, long braided icy-white beard blowing in the arctic wind, weathered face with ancient blue eyes showing intelligence and cruelty, frost and snow swirling around, tiny human settlement visible far below in the valley, northern lights in the sky",
    "늑대인간": "A werewolf mid-transformation under a blood-red full moon on a village rooftop, body caught between human and wolf, fur erupting through tearing clothing, one hand still human while the other is a massive clawed paw, elongating snout filled with growing fangs, one human eye and one bestial yellow eye, spine arching and muscles expanding, the agony and ecstasy of transformation visible, medieval village with frightened candlelight in windows below, torn clothing falling away",
    "초록 슬라임": "A green slime oozing through a dungeon corridor, translucent emerald-green gelatinous mass with visible bubbles and a faint inner glow, partially digested bones and a corroded sword visible suspended within its amorphous body, pseudopods reaching along walls and floor exploring for food, leaving a trail of dissolved stone, the corridor ahead showing acid damage from previous passage, dungeon torchlight refracting through its glistening surface",
    "파랑 슬라임": "A blue water slime pooling in a flooded dungeon chamber, translucent sapphire-blue gel body rippling like disturbed water, cooler in temperature than its surroundings creating visible condensation in the air, small aquatic creatures and water plants somehow alive within its body, peaceful serene appearance belying its danger, reflecting torchlight in beautiful prismatic patterns across the wet dungeon walls, shallow water on the stone floor around it",
    "빨강 슬라임": "A red fire slime bubbling near a volcanic vent in a cavern, body of translucent red-orange gel that constantly bubbles and steams, internal temperature high enough to glow like embers, charred remains of unfortunate creatures visible within, leaving scorched black trails on stone as it moves, heat distortion shimmering above its surface, small flames occasionally dancing on its surface, volcanic rock and lava glow in the background",
    "독 슬라임": "A purple poison slime lurking in a sewer junction, deep violet translucent body with toxic bubbles constantly rising and popping, releasing visible clouds of noxious purple gas, corroded metal pipes and dissolved brick visible beneath it, acid trail eating through stone behind, within its body small creatures frozen mid-dissolution, a sickly bioluminescent glow, sewer tunnel architecture with dripping water and mold, warning signs of its territory in the corroded surroundings",
    "금속 슬라임": "A metallic slime darting through a treasure vault, body of liquid quicksilver reflecting everything around it like a living mirror, incredibly fast with pseudopods propelling it in rapid bursts, rare and coveted, absorbed coins and gems visible within its reflective mass, leaving a trail of polished floor behind, treasure chests and gold piles in the vault reflecting distortedly in its surface, magical alarm wards glowing on the walls, impossibly sleek and elusive",
    "킹 슬라임": "A king slime dominating a vast cavern, enormous slime mass the size of a house, semi-transparent royal blue body with a golden crown absorbed at its apex, hundreds of absorbed smaller slimes visible within creating a colony organism, pseudopod arms thick as tree trunks, a vaguely formed face with wise ancient eyes, smaller slimes orbiting it like courtiers, the cavern floor dissolved into a smooth basin by its acidic presence, stalactites and crystal formations surrounding",
    "젤리피쉬": "A giant jellyfish floating through a deep underwater cavern, translucent bell-shaped body pulsing with bioluminescent blues and purples, extremely long trailing tentacles lined with venomous nematocysts, delicate frilly oral arms beneath the bell, the water around it glowing with bioluminescent particles it releases, small fish lured by its light becoming ensnared, underwater cave formations and coral visible in the ethereal blue light, dreamlike underwater atmosphere",
    "점액 군주": "A slime lord spreading through an abandoned alchemist's laboratory, enormous amorphous mass of dark acidic ooze filling half the room, multiple absorbed creatures visible in various stages of dissolution within its translucent dark body, several pseudopod stalks rising with primitive eye-like formations, capable of problem-solving intelligence, alchemical equipment being dissolved and absorbed, the stone floor deeply corroded, noxious fumes rising, broken shelves and shattered potions around",
    "대왕 게": "A giant crab defending a coral reef treasure trove, enormous crustacean with a barnacle-encrusted shell as wide as a wagon, one claw massive and designed for crushing while the other is sharp for cutting, multiple eye stalks swiveling independently, armored legs planted firmly in the sandy ocean floor, anemones and small creatures living on its shell in a symbiotic relationship, sunken ship treasure scattered around its territory, shafts of underwater sunlight filtering through clear tropical water",
    "상어": "A dire shark hunting in deep ocean waters, massive predator nearly the size of a whale, dark gray-blue hide scarred from battles with krakens and sea serpents, rows upon rows of serrated triangular teeth visible in a slightly open jaw, cold black calculating eyes, powerful crescent tail mid-thrust propelling it forward, remora fish clinging to its underside, darker deep ocean below and lighter surface above, scattered debris from a shipwreck drifting in the current",
    "대왕 문어": "A giant octopus lurking in a deep sea cave near a shipwreck, massive body filling the cave entrance, eight enormous tentacles each as long as a ship's mast covered in powerful suckers, two intelligent golden eyes the size of shields peering out with alien curiosity and calculation, chromatophores shifting colors from deep red to pale camouflage, one tentacle coiled around a sunken ship's mast, bioluminescent deep sea creatures illuminating the dark water, coral and barnacles growing on nearby rocks",
    "인어 전사": "A merman warrior on patrol in an underwater kingdom, muscular humanoid upper body with blue-green scaled skin and gill slits on the neck, powerful fish tail with iridescent scales and fan-like fins, wielding a coral-forged trident and a shield made from a giant turtle shell, webbed fingers, sharp angular features with large dark adapted eyes, coral armor chest piece, underwater coral palace visible in the background with other merfolk going about their lives, filtered ocean light from above",
    "심해어": "A deep sea anglerfish monster in the abyssal darkness, grotesque bulbous body with mottled dark skin covered in pressure-resistant dermal denticles, enormous gaping maw filled with long needle-like transparent teeth pointing inward, a bioluminescent lure dangling from a modified dorsal spine emitting an alluring blue-green glow, tiny malevolent eyes, vestigial fins, the absolute darkness of the deep ocean around it with only the faintest bioluminescent particles visible, crushing pressure atmosphere",
    "크라켄": "A kraken attacking a three-masted sailing ship during a violent ocean storm, colossal cephalopod of mythic proportions, tentacles as thick as the mainmast wrapping around the hull crushing timber, massive mantle rising from storm-tossed waves, one enormous eye visible above the waterline reflecting lightning, the ship listing badly as sailors scramble, enormous beak visible beneath the tentacles, waterspouts and massive waves, dark storm clouds and lightning illuminating the terrifying scene",
    "해마 기사": "A seahorse knight patrolling an underwater coral kingdom, armored rider mounted on an oversized seahorse steed twice the size of a horse, both rider and mount wearing interlocking shell and coral plate armor with pearl inlays, the knight wielding a narwhal-tusk lance with a pennant of woven kelp, underwater visibility through clear tropical water, colorful coral reef kingdom with pearl-encrusted towers in the background, schools of tropical fish parting as they pass, bubbles trailing behind",
    "바다 용": "A sea dragon erupting from the ocean depths during a violent storm, colossal serpentine dragon body with deep blue-green scales that shimmer with bioluminescence, massive finned wings that serve as both sails and swimming aids, elongated oriental-style dragon head with flowing whisker-like barbels and a crown of coral horns, water cascading from its body as it breaches the surface, eyes of deep ocean blue glowing with ancient wisdom, lightning illuminating its full magnificent form against towering waves, whirlpool forming in the waters below",
}

SUMMON_PROMPTS = {
    "떠도는 원혼": "A bound wandering soul serving as a summoned companion, translucent pale blue spectral form with visible arcane binding chains of golden light connecting it to a summoning circle, hollow ghostly face with sorrowful luminous eyes, Korean traditional mourning garb flowing ethereally, orbiting spirit motes, the binding magic keeping it anchored visible as runic symbols",
    "묘지 귀신": "A graveyard ghost summoned as a familiar, ethereal dark-green spectral form rising from disturbed grave soil, hollow face with an eerie green inner glow, Korean-style spirit with traditional burial clothes, translucent enough to see tombstones through its body, a summoning seal glowing on its forehead binding it to service, will-o-wisps orbiting, graveyard mist and moonlight",
    "구미호 영혼": "A gumiho fox spirit bound as a summoned familiar, ghostly nine-tailed fox made of swirling blue-violet ethereal energy, each tail tipped with spirit fire, fox skull visible through translucent spectral fur, intelligent glowing violet eyes, arcane binding collar of golden runes around the neck, floating gracefully, leaving trails of foxfire in the air, misty moonlit setting",
    "들쥐 소환수": "A magically enhanced summoned field mouse familiar, small but supernaturally alert brown mouse with faintly glowing eyes, a tiny arcane summoning sigil visible on its forehead, slightly larger than natural with unnaturally quick movements, sitting attentively on a spellcaster's open palm, whiskers twitching with magical sensitivity, a faint aura of protective enchantment around it",
    "야생 늑대": "A summoned dire wolf companion, magnificent silver-furred wolf larger than natural with glowing amber eyes showing supernatural intelligence, an arcane summoning collar of woven light around its muscular neck, loyal protective stance, faint magical aura visible around its form, battle scars showing veteran status, standing attentively beside its summoner, moonlit forest clearing",
    "골렘 파편": "A golem fragment summoned as a construct familiar, cluster of floating stone pieces held together by visible threads of arcane blue energy, forming a rough humanoid shape about two feet tall, ancient runes carved into each stone piece glowing with power, a core of crystallized magical energy visible between the floating pieces, orbiting its master protectively, pebbles and dust trailing behind",
    "독거미 여왕": "A summoned spider queen familiar, large dark-bodied arachnid with distinctive purple markings and eight eyes glowing with bound intelligence, a summoning sigil woven into its web patterns, spinning enchanted silk that glows faintly, venomous fangs glistening with magical venom, riding on the summoner's shoulder or spinning web nearby, smaller magical spiderlings orbiting",
    "물의 정령": "A lesser water elemental summoned as a familiar, small humanoid form of swirling crystal-clear water about eighteen inches tall, features rippling and reforming constantly, tiny aquatic plants and bubbles within, eyes of deep blue concentration, standing in a summoning circle with water runes, leaving small puddles with each step, a connection of water droplets linking it to its summoner",
    "불의 정령": "A lesser fire elemental summoned as a familiar, small humanoid form of controlled warm flame about eighteen inches tall, body shifting between orange and gentle gold, features visible in the flickering fire with eyes like tiny embers, hovering just above surfaces to avoid burning, warmth radiating outward, summoning runes visible at its base, a thin thread of fire connecting to its summoner's hand",
    "바람의 정령": "A lesser wind elemental summoned as a familiar, small translucent swirling form about eighteen inches tall visible only by the dust motes and tiny leaves caught in its perpetual gentle rotation, suggestion of a curious face in the vortex center, constantly drifting and bobbing in the air, creating a pleasant breeze, summoning glyphs visible as floating luminous symbols within",
    "해골 전사": "A summoned skeleton warrior standing at attention, animated bones reinforced with visible arcane binding energy at each joint glowing blue-purple, wielding a spectral sword and shield bearing its summoner's arcane mark, disciplined military posture, eye sockets blazing with loyal blue fire, armor pieces of magical energy protecting key joints, ready to defend its master, necromantic summoning circle fading beneath its feet",
    "리치": "A summoned lesser lich serving as a powerful familiar, skeletal mage form in dark scholarly robes, skull face with intensely glowing green eyes showing vast arcane knowledge, holding a staff of twisted dark wood topped with a soul gem, arcane binding chains of golden light keeping it in service, dark magic swirling around its skeletal hands, floating tomes and spell components orbiting, powerful but restrained by the summoning pact",
}

CHARACTER_PROMPTS = {
    "풍수사": "A Korean pungsu geomancer hero standing on a misty mountain ridge performing a divination ritual, scholarly male figure in elegant dark navy and teal traditional hanbok robes embroidered with wind and water symbols, a magical luopan compass floating above one outstretched hand emitting golden directional energy beams, the other hand directing swirling currents of wind and water chi, long black hair partially bound in a traditional scholar's topknot, intelligent piercing eyes reading the flow of earthly energy, talismanic scrolls tucked into a sash belt, mystical fog and Korean mountain peaks behind, ley lines of earth energy glowing beneath his feet",
    "무당": "A Korean mudang shaman priestess performing a powerful spirit ritual at a sacred altar, dynamic female figure in a vibrant ceremonial hanbok of layered reds whites and blues, wielding ritual spirit bells in one hand and a ceremonial fan trailing spirit energy in the other, face marked with sacred patterns, intense ecstatic expression as she channels the spirit world, multiple translucent ancestral spirits swirling around her responding to her call, traditional Korean shamanistic ritual implements on a nearby altar table with offerings, spirit ribbons and paper talismans floating in supernatural wind, sacred tree with tied prayer cloths behind",
    "승려": "A Korean Buddhist warrior monk in a powerful martial arts stance in a mountain temple courtyard at dawn, muscular disciplined male figure in deep saffron and burnt orange monk robes with one shoulder bare showing defined muscles with sutra tattoos, long prayer bead mala wrapped around one forearm, the other fist emanating golden spiritual energy, shaved head with nine monk scars, serene but fierce expression with focused eyes, staff weapon resting nearby, ancient Korean mountain temple with stone lanterns and autumn maples behind, morning mist and golden sunlight, aura of inner spiritual power visible",
}

def get_monster_prompt(m, view):
    name = m["name"]
    tier = m["tier"]
    base = MONSTER_PROMPTS.get(name, f"A fantasy monster: {name}")
    tier_q = get_tier_quality(tier)
    if view == "icon":
        return f"{STYLE_PREFIX}, portrait close-up face and upper body, {base}, {tier_q}, {STYLE_SUFFIX}"
    else:
        return f"{STYLE_PREFIX}, full body dynamic pose, {base}, {tier_q}, {STYLE_SUFFIX}"

def get_summon_prompt(s, view):
    base = SUMMON_PROMPTS.get(s["name"], f"A summoned familiar creature: {s['name']}")
    if view == "icon":
        return f"{STYLE_PREFIX}, portrait close-up, {base}, {STYLE_SUFFIX}"
    else:
        return f"{STYLE_PREFIX}, full body, {base}, {STYLE_SUFFIX}"

def get_character_prompt(c, view):
    base = CHARACTER_PROMPTS.get(c["name"], f"A Korean fantasy RPG hero: {c['name']}")
    if view == "icon":
        return f"{STYLE_PREFIX}, heroic portrait headshot, {base}, {STYLE_SUFFIX}"
    else:
        return f"{STYLE_PREFIX}, full body hero pose, {base}, {STYLE_SUFFIX}"

# ============================================================
# 메인 실행
# ============================================================
if __name__ == "__main__":
    start = time.time()
    total = len(monsters) + len(summons) + len(characters)
    img_count = 0
    done = 0

    # 1. 몬스터
    print(f"\n=== Generating {len(monsters)} monsters (D&D concept art) ===")
    for m in monsters:
        done += 1

        icon_path = f"{MONSTER_DIR}/{m['id']}_icon.png"
        print(f"[{done}/{total}] {m['name']} icon...")
        generate_image(get_monster_prompt(m, "icon"), icon_path, size=256)
        img_count += 1

        full_path = f"{MONSTER_DIR}/{m['id']}_full.png"
        print(f"[{done}/{total}] {m['name']} full...")
        generate_image(get_monster_prompt(m, "full"), full_path, size=512)
        img_count += 1

    # 2. 소환수
    print(f"\n=== Generating {len(summons)} summons (D&D concept art) ===")
    for s in summons:
        done += 1

        icon_path = f"{SUMMON_DIR}/{s['id']}_icon.png"
        print(f"[{done}/{total}] {s['name']} icon...")
        generate_image(get_summon_prompt(s, "icon"), icon_path, size=256)
        img_count += 1

        full_path = f"{SUMMON_DIR}/{s['id']}_full.png"
        print(f"[{done}/{total}] {s['name']} full...")
        generate_image(get_summon_prompt(s, "full"), full_path, size=512)
        img_count += 1

    # 3. 캐릭터
    print(f"\n=== Generating {len(characters)} characters (D&D concept art) ===")
    for c in characters:
        done += 1

        icon_path = f"{CHAR_DIR}/{c['id']}_icon.png"
        print(f"[{done}/{total}] {c['name']} icon...")
        generate_image(get_character_prompt(c, "icon"), icon_path, size=256)
        img_count += 1

        full_path = f"{CHAR_DIR}/{c['id']}_full.png"
        print(f"[{done}/{total}] {c['name']} full...")
        generate_image(get_character_prompt(c, "full"), full_path, size=512)
        img_count += 1

    elapsed = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done! Generated {img_count} images in {elapsed/60:.1f} minutes")
    print(f"Monsters: {len(monsters)*2}, Summons: {len(summons)*2}, Characters: {len(characters)*2}")
    print(f"Style: D&D Concept Art | Steps: 8 | Guidance: 2.0")
    print(f"{'='*60}")
