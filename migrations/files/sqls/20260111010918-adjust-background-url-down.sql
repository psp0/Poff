UPDATE habitat_backgrounds 
SET display_name = '평범한 구릉', image_filename = 'grass.png' 
WHERE habitat_slug = 'roughterrain' AND type_slug IN ('normal', 'grass', 'bug', 'fairy', 'ghost');

UPDATE habitat_backgrounds 
SET display_name = '일상의 마을', image_filename = 'grass.png' 
WHERE habitat_slug = 'urban' AND type_slug IN ('normal', 'grass', 'fighting', 'dragon', 'fire');
