/**
 * Pokemon Data Parser
 * Converts Pokemon PBS data files into database records
 * This is a Node.js port of the Python pokemon_parser_rds.py script
 */

class PokemonParser {
    constructor(loader) {
        this.loader = loader; // FileSystemLoader or S3Loader
        this.koreanNames = {};
        this.koreanCategories = {};
        this.koreanPokedex = {};
        this.koreanFormNames = {};
        this.koreanHabitats = {};
        this.koreanTypes = {};
        this.koreanFlags = {};
        this.basePokemon = {};
        this.formPokemon = {};
        this.femaleMetrics = {};
        this.validStableIds = new Set();
    }

    /**
     * Parse all Pokemon data files
     */
    async parseAll() {
        console.log('Parsing Korean translations...');

        // Parse Korean translations
        this.koreanNames = await this.parseMultipleBilingualFiles([
            'base/info/Text_kor_core/SPECIES_NAMES.txt',
            'base/info/Text_kor_game/SPECIES_NAMES.txt'
        ]);

        this.koreanCategories = await this.parseMultipleBilingualFiles([
            'base/info/Text_kor_core/SPECIES_CATEGORIES.txt',
            'base/info/Text_kor_game/SPECIES_CATEGORIES.txt'
        ]);

        this.koreanPokedex = await this.parseMultipleBilingualFiles([
            'base/info/Text_kor_core/POKEDEX_ENTRIES.txt',
            'base/info/Text_kor_game/POKEDEX_ENTRIES.txt'
        ]);

        this.koreanFormNames = await this.parseMultipleBilingualFiles([
            'base/info/Text_kor_core/SPECIES_FORM_NAMES.txt',
            'base/info/Text_kor_game/SPECIES_FORM_NAMES.txt'
        ]);

        this.koreanHabitats = await this.parseBilingualFile('custom/info/서식지.txt');
        this.koreanFlags = await this.parseBilingualFile('custom/info/플래그.txt');

        this.koreanTypes = await this.parseMultipleBilingualFiles([
            'base/info/Text_kor_core/TYPE_NAMES.txt',
            'base/info/Text_kor_game/TYPE_NAMES.txt'
        ]);

        console.log('Parsing Pokemon data...');

        // Parse Pokemon data
        await this.parsePokemonInfo('base/info/PBS/pokemon.txt');

        console.log('Parsing Pokemon forms...');

        // Parse forms
        await this.parsePokemonForms([
            'base/info/PBS/pokemon_forms.txt',
            'base/info/PBS/pokemon_forms_pikachu_caps.txt',
            'base/info/PBS/pokemon_forms_gmax.txt',
            'external/info/포켓몬(폼)수정.txt'
        ]);

        console.log('Parsing Pokemon metrics...');
        await this.parsePokemonMetrics([
            'base/info/PBS/pokemon_metrics.txt',
            'base/info/PBS/pokemon_metrics_Gen_9_Pack.txt',
            'base/info/PBS/pokemon_metrics_female.txt',
            'base/info/PBS/pokemon_metrics_forms.txt',
            'base/info/PBS/pokemon_metrics_gmax.txt'
        ]);

        console.log('Adding Base flags...');

        // Add Base flags
        this.addBaseFlag();

        console.log('Parsing complete!');
    }

    /**
     * Parse Pokemon metrics files
     */
    async parsePokemonMetrics(filepaths) {
        let count = 0;
        for (const filepath of filepaths) {
            try {
                const content = await this.loader.loadFile(filepath);
                // Matches [ID], [ID,Form], [ID,,Female], [ID,Form,Female]
                const blocks = content.split(/\[([A-Z0-9_]+)(?:,([^,\]]*))?(?:,([^,\]]*))?\]/);

                for (let i = 1; i < blocks.length; i += 4) {
                    const name = blocks[i];
                    const formNum = blocks[i + 1] ? blocks[i + 1].trim() : null;
                    const extra = blocks[i + 2] ? blocks[i + 2].trim() : null;
                    const dataBlock = blocks[i + 3];

                    if (dataBlock) {
                        const lines = dataBlock.trim().split('\n').map(l => l.trim()).filter(Boolean);
                        let backSpeed = 2;
                        let frontSpeed = 2;
                        let hasSpeed = false;

                        for (const line of lines) {
                            if (line.startsWith('AnimationSpeed')) {
                                hasSpeed = true;
                                const value = line.split('=')[1].trim();
                                const parts = value.split(',').map(s => parseInt(s.trim()));
                                if (parts.length === 1) {
                                    backSpeed = parts[0];
                                    frontSpeed = parts[0]; // Apply to both if only one provided
                                } else if (parts.length >= 2) {
                                    backSpeed = parts[0];
                                    frontSpeed = parts[1];
                                }
                            }
                        }

                        if (hasSpeed) {
                            const isFemale = extra === 'female';
                            count++;

                            if (isFemale) {
                                const key = formNum ? `${name}_${formNum}` : name;
                                this.femaleMetrics[key] = { back: backSpeed, front: frontSpeed };
                            } else if (formNum) {
                                const formKey = `${name}_${formNum}`;
                                if (this.formPokemon[formKey]) {
                                    this.formPokemon[formKey].back_animation_speed = backSpeed;
                                    this.formPokemon[formKey].front_animation_speed = frontSpeed;
                                }
                            } else {
                                if (this.basePokemon[name]) {
                                    this.basePokemon[name].back_animation_speed = backSpeed;
                                    this.basePokemon[name].front_animation_speed = frontSpeed;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`  Skipping metrics ${filepath}:`, error.message);
            }
        }
        console.log(`  Parsed metrics for ${count} Pokemon entries`);
    }


    /**
     * Merge form data with base Pokemon data
     */
    mergeFormWithBase(formData) {
        const baseName = formData.base_name;
        if (this.basePokemon[baseName]) {
            return { ...this.basePokemon[baseName], ...formData };
        }
        return formData;
    }

    /**
     * Create Pokemon records for database insertion
     */
    async createPokemonRecords() {
        const records = [];
        this.validStableIds.clear();

        for (const [name, data] of Object.entries(this.basePokemon)) {
            // Korean translations
            const koreanName = this.koreanNames[name.capitalize()] ||
                this.koreanNames[name] ||
                this.koreanNames[name.toUpperCase()] ||
                this.koreanNames[this.normalizeName(name)] ||
                name;

            let category = this.koreanCategories[data.category] || data.category || '';
            if (category && !category.endsWith('포켓몬')) {
                category = `${category}포켓몬`;
            }

            const habitat = this.koreanHabitats[data.habitat] || data.habitat;

            // Handle special habitat cases
            let habitatKo = habitat;
            if (!habitatKo || habitatKo === data.habitat) {
                if (data.habitat === 'WatersEdge') {
                    habitatKo = this.koreanHabitats["Water's Edge"] || data.habitat;
                } else if (data.habitat === 'RoughTerrain') {
                    habitatKo = this.koreanHabitats["Rough Terrain"] || data.habitat;
                }
            }

            // Base Pokemon record
            const record = {
                name: koreanName,
                category,
                type1: this.koreanTypes[data.type1?.capitalize()] || data.type1,
                type2: data.type2 ? (this.koreanTypes[data.type2.capitalize()] || data.type2) : null,
                type1_en: data.type1?.toLowerCase() || null,
                type2_en: data.type2?.toLowerCase() || null,
                pokedex: this.koreanPokedex[data.pokedex] || data.pokedex,
                generation: data.generation,
                habitat: habitatKo,
                habitat_en: data.habitat?.toLowerCase() || null,
                height: data.height,
                weight: data.weight,
                base_hp: data.base_hp,
                base_attack: data.base_attack,
                base_defense: data.base_defense,
                base_speed: data.base_speed,
                base_sp_attack: data.base_sp_attack,
                base_sp_defense: data.base_sp_defense,
                base_stat_total: data.base_stat_total,
                image_name: name,
                form_suffix: null,
                stable_id: name,
                back_animation_speed: data.back_animation_speed !== undefined ? data.back_animation_speed : 2,
                front_animation_speed: data.front_animation_speed !== undefined ? data.front_animation_speed : 2,
                ...await this.checkAssetStatus(name, null).then(status => ({
                    asset_source: status.source,
                    has_icon: status.has_icon,
                    has_icon_shiny: status.has_icon_shiny,
                    has_front: status.has_front,
                    has_front_shiny: status.has_front_shiny,
                    has_back: status.has_back,
                    has_back_shiny: status.has_back_shiny,
                    has_cry: status.has_cry
                }))
            };

            records.push(record);
            this.validStableIds.add(record.stable_id);

            // Handle Gendered Sprites
            if (data.flags && data.flags.includes('HasGenderedSprites')) {
                const femaleMetrics = this.femaleMetrics[name] || { back: 2, front: 2 };
                const femaleRecord = {
                    ...record,
                    name: `${koreanName} (암컷)`,
                    form_suffix: '_female',
                    stable_id: `${name}_female`,
                    back_animation_speed: femaleMetrics.back,
                    front_animation_speed: femaleMetrics.front,
                    ...await this.checkAssetStatus(name, '_female').then(status => ({
                        asset_source: status.source,
                        has_icon: status.has_icon,
                        has_icon_shiny: status.has_icon_shiny,
                        has_front: status.has_front,
                        has_front_shiny: status.has_front_shiny,
                        has_back: status.has_back,
                        has_back_shiny: status.has_back_shiny,
                        has_cry: status.has_cry
                    }))
                };
                records.push(femaleRecord);
                this.validStableIds.add(femaleRecord.stable_id);
            }

            // Handle Forms
            const pokemonForms = [];
            const seenFormNames = new Set();

            for (const [formKey, formData] of Object.entries(this.formPokemon)) {
                if (formData.base_name === name) {
                    if (!formData.form_name) {
                        console.warn(`Skipping form without name: ${formKey}`);
                        continue;
                    }

                    const formNameEng = formData.form_name;
                    if (seenFormNames.has(formNameEng)) {
                        continue;
                    }
                    seenFormNames.add(formNameEng);

                    const merged = this.mergeFormWithBase(formData);
                    const formNum = formData.form_number;
                    const formNameKor = this.koreanFormNames[formNameEng] || formNameEng;

                    let formCategory = this.koreanCategories[merged.category] || merged.category || '';
                    if (formCategory && !formCategory.endsWith('포켓몬')) {
                        formCategory = `${formCategory}포켓몬`;
                    }

                    let formHabitat = this.koreanHabitats[merged.habitat] || merged.habitat;
                    if (!formHabitat || formHabitat === merged.habitat) {
                        if (merged.habitat === 'WatersEdge') {
                            formHabitat = this.koreanHabitats["Water's Edge"] || merged.habitat;
                        } else if (merged.habitat === 'RoughTerrain') {
                            formHabitat = this.koreanHabitats["Rough Terrain"] || merged.habitat;
                        }
                    }

                    const formRecord = {
                        name: `${koreanName} (${formNameKor})`,
                        category: formCategory,
                        type1: this.koreanTypes[merged.type1?.capitalize()] || merged.type1,
                        type2: merged.type2 ? (this.koreanTypes[merged.type2.capitalize()] || merged.type2) : null,
                        type1_en: merged.type1?.toLowerCase() || null,
                        type2_en: merged.type2?.toLowerCase() || null,
                        pokedex: this.koreanPokedex[merged.pokedex] || merged.pokedex,
                        generation: merged.generation,
                        habitat: formHabitat,
                        habitat_en: merged.habitat?.toLowerCase() || null,
                        height: merged.height,
                        weight: merged.weight,
                        base_hp: merged.base_hp,
                        base_attack: merged.base_attack,
                        base_defense: merged.base_defense,
                        base_speed: merged.base_speed,
                        base_sp_attack: merged.base_sp_attack,
                        base_sp_defense: merged.base_sp_defense,
                        base_stat_total: merged.base_stat_total,
                        image_name: name,
                        form_suffix: `_${formNum}`,
                        stable_id: `${name}_${formNum}`,
                        back_animation_speed: merged.back_animation_speed !== undefined ? merged.back_animation_speed : 2,
                        front_animation_speed: merged.front_animation_speed !== undefined ? merged.front_animation_speed : 2,
                        ...await this.checkAssetStatus(name, `_${formNum}`).then(status => ({
                            asset_source: status.source,
                            has_icon: status.has_icon,
                            has_icon_shiny: status.has_icon_shiny,
                            has_front: status.has_front,
                            has_front_shiny: status.has_front_shiny,
                            has_back: status.has_back,
                            has_back_shiny: status.has_back_shiny,
                            has_cry: status.has_cry
                        }))
                    };

                    pokemonForms.push({ num: parseInt(formNum), record: formRecord });
                }
            }

            // Sort forms by number and add to records
            pokemonForms.sort((a, b) => a.num - b.num);
            pokemonForms.forEach(item => {
                records.push(item.record);
                this.validStableIds.add(item.record.stable_id);
            });
        }

        return records;
    }

    /**
     * Parse a bilingual file (English/Korean alternating lines)
     */
    async parseBilingualFile(filepath) {
        try {
            const content = await this.loader.loadFile(filepath);
            const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

            const result = {};
            let i = 0;

            // Skip header section
            while (i < lines.length && (lines[i].startsWith('[') || lines[i].startsWith('#'))) {
                i++;
            }

            // Parse English/Korean pairs
            while (i < lines.length - 1) {
                if (!lines[i].startsWith('#') && !lines[i + 1].startsWith('#')) {
                    const english = lines[i];
                    const korean = lines[i + 1];
                    result[english] = korean;

                    // Also store normalized version
                    const normalized = this.normalizeName(english);
                    if (normalized !== english) {
                        result[normalized] = korean;
                    }

                    i += 2;
                } else {
                    i++;
                }
            }

            return result;
        } catch (error) {
            console.warn(`Failed to parse ${filepath}:`, error.message);
            return {};
        }
    }

    /**
     * Parse multiple bilingual files and merge results
     */
    async parseMultipleBilingualFiles(filepaths) {
        const result = {};
        for (const filepath of filepaths) {
            const parsed = await this.parseBilingualFile(filepath);
            Object.assign(result, parsed);
        }
        return result;
    }

    /**
     * Normalize a Pokemon name
     */
    normalizeName(name) {
        // Handle PBS special gender notation
        name = name.replace(/fE/g, '♀').replace(/mA/g, '♂');

        // Remove accents and special characters
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[-\s':.]/g, '')
            .toUpperCase();
    }

    /**
     * Parse Pokemon info file (pokemon.txt)
     */
    async parsePokemonInfo(filepath) {
        const content = await this.loader.loadFile(filepath);

        // Split by [POKEMON_NAME]
        const blocks = content.split(/\[([A-Z0-9_]+)\]/);

        for (let i = 1; i < blocks.length; i += 2) {
            const name = blocks[i];
            const dataBlock = blocks[i + 1];

            if (dataBlock) {
                const pokemonData = this.parsePokemonBlock(name, dataBlock.trim(), false);
                this.basePokemon[name] = pokemonData;
            }
        }

        console.log(`  Parsed ${Object.keys(this.basePokemon).length} base Pokemon`);
    }

    /**
     * Parse Pokemon forms files
     */
    async parsePokemonForms(filepaths) {
        let totalForms = 0;

        for (const filepath of filepaths) {
            try {
                const content = await this.loader.loadFile(filepath);

                // Split by [POKEMON_NAME,form_number]
                const blocks = content.split(/\[([A-Z0-9_]+),(\d+)\]/);

                for (let i = 1; i < blocks.length; i += 3) {
                    const name = blocks[i];
                    const formNum = blocks[i + 1];
                    const dataBlock = blocks[i + 2];

                    if (dataBlock) {
                        const formKey = `${name}_${formNum}`;
                        const formData = this.parsePokemonBlock(formKey, dataBlock.trim(), true);
                        formData.base_name = name;
                        formData.form_number = formNum;

                        // Merge with existing form data if present
                        if (this.formPokemon[formKey]) {
                            Object.assign(this.formPokemon[formKey], formData);
                        } else {
                            this.formPokemon[formKey] = formData;
                        }

                        totalForms++;
                    }
                }
            } catch (error) {
                console.warn(`  Skipping ${filepath}:`, error.message);
            }
        }

        console.log(`  Parsed ${totalForms} forms`);
    }

    /**
     * Parse individual Pokemon data block
     */
    parsePokemonBlock(name, block, isForm) {
        const data = { name };
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
            if (!line.includes('=')) continue;

            const [key, value] = line.split('=').map(s => s.trim());

            switch (key) {
                case 'Types':
                    const types = value.split(',');
                    data.type1 = types[0] || null;
                    data.type2 = types[1] || null;
                    break;

                case 'BaseStats':
                    const stats = value.split(',').map(s => parseInt(s.trim()));
                    if (stats.length === 6) {
                        data.base_hp = stats[0];
                        data.base_attack = stats[1];
                        data.base_defense = stats[2];
                        data.base_speed = stats[3];
                        data.base_sp_attack = stats[4];
                        data.base_sp_defense = stats[5];
                        data.base_stat_total = stats.reduce((a, b) => a + b, 0);
                    }
                    break;

                case 'Category':
                    data.category = value;
                    break;

                case 'Pokedex':
                    data.pokedex = value;
                    break;

                case 'Generation':
                    data.generation = parseInt(value) || null;
                    break;

                case 'Habitat':
                    data.habitat = value;
                    break;

                case 'Height':
                    data.height = parseFloat(value) || null;
                    break;

                case 'Weight':
                    data.weight = parseFloat(value) || null;
                    break;

                case 'FormName':
                    data.form_name = value;
                    break;

                case 'Flags':
                    const excludedFlags = new Set([
                        'CannotDynamax', 'CannotTerastallize', 'AllFormsShareGmax',
                        'InheritFormFromMother', 'InheritFormWithEverStone'
                    ]);
                    data.flags = value.split(',')
                        .map(f => f.trim())
                        .filter(f => f && !excludedFlags.has(f));
                    break;

                case 'Evolutions':
                    const parts = value.split(',').map(p => p.trim());
                    const evolutions = [];
                    const seen = new Set();

                    for (let i = 0; i < parts.length; i += 3) {
                        const toPokemon = parts[i];
                        const method = parts[i + 1];

                        if (toPokemon && method && method !== 'None' && !seen.has(toPokemon)) {
                            evolutions.push(toPokemon);
                            seen.add(toPokemon);
                        }
                    }

                    data.evolutions = evolutions;
                    break;
            }
        }

        return data;
    }

    /**
     * Add Base flag to base Pokemon (0-stage evolution, not special)
     */
    addBaseFlag() {
        const evolutionStages = this.calculateEvolutionStages();
        const specialFlags = new Set(['Legendary', 'Mythical', 'Paradox', 'UltraBeast']);

        let baseCount = 0;

        for (const [name, data] of Object.entries(this.basePokemon)) {
            if (evolutionStages[name] !== 0) continue;

            const currentFlags = new Set(data.flags || []);
            if ([...currentFlags].some(f => specialFlags.has(f))) continue;

            if (!data.flags) data.flags = [];
            if (!data.flags.includes('Base')) {
                data.flags.push('Base');
                baseCount++;
            }
        }

        console.log(`  Added 'Base' flag to ${baseCount} Pokemon`);
    }

    /**
     * Calculate evolution stages for all Pokemon
     */
    calculateEvolutionStages() {
        const fromCount = {};
        const toCount = {};

        // Count evolutions for base Pokemon
        for (const [name, data] of Object.entries(this.basePokemon)) {
            if (data.evolutions) {
                for (const to of data.evolutions) {
                    fromCount[to] = (fromCount[to] || 0) + 1;
                    toCount[name] = (toCount[name] || 0) + 1;
                }
            }
        }

        // Count evolutions for forms
        for (const [formKey, data] of Object.entries(this.formPokemon)) {
            if (data.evolutions) {
                for (const to of data.evolutions) {
                    fromCount[to] = (fromCount[to] || 0) + 1;
                    toCount[formKey] = (toCount[formKey] || 0) + 1;
                }
            }
        }

        // Determine evolution stage
        const stages = {};
        const allPokemon = [
            ...Object.keys(this.basePokemon),
            ...Object.keys(this.formPokemon)
        ];

        for (const name of allPokemon) {
            const from = fromCount[name] || 0;
            const to = toCount[name] || 0;

            if (from === 0 && to === 0) stages[name] = 0;
            else if (from === 0 && to > 0) stages[name] = 0;
            else if (from > 0 && to > 0) stages[name] = 1;
            else if (from > 0 && to === 0) stages[name] = 2;
        }
        return stages;
    }

    /**
     * Check if images and audio exist and detect source
     */
    async checkAssetStatus(imageName, formSuffix) {
        const stableId = formSuffix ? `${imageName}${formSuffix}` : imageName;
        const result = {
            source: 'base',
            has_icon: false,
            has_icon_shiny: false,
            has_front: false,
            has_front_shiny: false,
            has_back: false,
            has_back_shiny: false,
            has_cry: false
        };

        // Check Icon (prioritize external)
        if (await this.loader.fileExists(`external/img/Icons/${stableId}.png`)) {
            result.source = 'external';
            result.has_icon = true;
        } else if (await this.loader.fileExists(`base/img/Icons/${stableId}.png`)) {
            result.source = 'base';
            result.has_icon = true;
        } else {
            // If no icon found, check Front sprite to determine source
            if (await this.loader.fileExists(`external/img/Front/${stableId}.png`)) {
                result.source = 'external';
            }
        }

        const prefix = result.source === 'external' ? 'external' : 'base';

        // Check Icon Shiny
        if (await this.loader.fileExists(`${prefix}/img/Icons shiny/${stableId}.png`)) {
            result.has_icon_shiny = true;
        }

        // Check Front
        if (await this.loader.fileExists(`${prefix}/img/Front/${stableId}.png`)) {
            result.has_front = true;
        }

        // Check Front Shiny
        if (await this.loader.fileExists(`${prefix}/img/Front shiny/${stableId}.png`)) {
            result.has_front_shiny = true;
        }

        // Check Back
        if (await this.loader.fileExists(`${prefix}/img/Back/${stableId}.png`)) {
            result.has_back = true;
        }

        // Check Back Shiny
        if (await this.loader.fileExists(`${prefix}/img/Back shiny/${stableId}.png`)) {
            result.has_back_shiny = true;
        }

        // Check Cry (Always in base)
        if (await this.loader.fileExists(`base/sound/Cries/${stableId}.ogg`)) {
            result.has_cry = true;
        }

        return result;
    }

    /**
     * Create flag records
     */
    createFlagRecords() {
        const allFlags = new Set();

        for (const data of Object.values(this.basePokemon)) {
            if (data.flags) {
                data.flags.forEach(f => allFlags.add(f));
            }
        }

        for (const data of Object.values(this.formPokemon)) {
            if (data.flags) {
                data.flags.forEach(f => allFlags.add(f));
            }
        }

        return [...allFlags].sort().map(flag => ({
            name: flag,
            name_ko: this.koreanFlags[flag] || flag
        }));
    }

    /**
     * Create flag relations
     */
    createFlagRelations() {
        const relations = [];
        // Flags that should be inherited from base Pokemon to forms
        const inheritableFlags = new Set(['Legendary', 'Mythical', 'Paradox', 'UltraBeast']);

        // Base Pokemon relations
        for (const [name, data] of Object.entries(this.basePokemon)) {
            if (!this.validStableIds.has(name)) continue;

            if (data.flags) {
                for (const flag of data.flags) {
                    relations.push({
                        pokemon_stable_id: name,
                        flag_name: flag
                    });
                }
            }
        }

        // Form Pokemon relations
        for (const [formKey, data] of Object.entries(this.formPokemon)) {
            if (!data.form_name) continue;

            const baseName = data.base_name;
            const formNum = data.form_number;
            const stableId = `${baseName}_${formNum}`;

            if (!this.validStableIds.has(stableId)) continue;

            const formFlags = new Set(data.flags || []);

            // Inherit special flags from base Pokemon
            const baseData = this.basePokemon[baseName];
            if (baseData && baseData.flags) {
                for (const flag of baseData.flags) {
                    if (inheritableFlags.has(flag)) {
                        formFlags.add(flag);
                    }
                }
            }

            for (const flag of formFlags) {
                relations.push({
                    pokemon_stable_id: stableId,
                    flag_name: flag
                });
            }
        }

        return relations;
    }

    /**
     * Create evolution records
     */
    createEvolutionRecords() {
        const evolutions = [];

        // Base Pokemon evolutions
        for (const [name, data] of Object.entries(this.basePokemon)) {
            if (!this.validStableIds.has(name)) continue;

            if (data.evolutions) {
                for (const to of data.evolutions) {
                    evolutions.push({
                        from_pokemon: name,
                        to_pokemon: to
                    });
                }
            }
        }

        // Form Pokemon evolutions
        for (const [formKey, data] of Object.entries(this.formPokemon)) {
            if (!data.form_name) continue;

            if (data.evolutions) {
                const baseName = data.base_name;
                const formNum = data.form_number;
                const stableId = `${baseName}_${formNum}`;

                if (!this.validStableIds.has(stableId)) continue;

                for (const to of data.evolutions) {
                    evolutions.push({
                        from_pokemon: stableId,
                        to_pokemon: to
                    });
                }
            }
        }

        return evolutions;
    }
}

// Helper to capitalize first letter
String.prototype.capitalize = function () {
    return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
};

module.exports = PokemonParser;
