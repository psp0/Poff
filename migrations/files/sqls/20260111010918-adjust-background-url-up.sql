UPDATE habitat_backgrounds 
SET display_name = '빛바랜 험로', image_filename = 'normal.png' 
WHERE habitat_slug = 'roughterrain' AND type_slug IN ('normal', 'grass', 'bug', 'fairy', 'ghost');

UPDATE habitat_backgrounds 
SET display_name = '울타리 마을', image_filename = 'normal.png' 
WHERE habitat_slug = 'urban' AND type_slug IN ('normal', 'grass', 'fighting', 'dragon', 'fire');
