MML.displayMovement = function displayMovement(character) {
  var token = MML.getCharacterToken(character.id);
  var path = getObj('path', character.pathID);

  if (!_.isUndefined(path)) {
    path.remove();
  }
  var pathID = MML.drawCirclePath(token.get('left'), token.get('top'), MML.movementRates[race][character.movementType] * character.movementAvailable).id;
  character.pathID = pathID;
};

MML.moveDistance = function moveDistance(character, distance) {
  var remainingMovement = character.movementAvailable - (distance) / (MML.movementRates[race][character.movementType]);
  if (character.movementAvailable > 0) {
    character.movementAvailable = remainingMovement;
    MML.displayMovement(character);
  } else {
    var path = getObj('path', character.pathID);
    if (!_.isUndefined(path)) {
      path.remove();
    }
  }
};

MML.setCombatVision = function setCombatVision(character) {
  var token = MML.getCharacterToken(character.id);
  if (state.MML.GM.inCombat || !_.has(character.statusEffects, 'Observing')) {
    token.set('light_losangle', character.fov);
    token.set('light_hassight', true);
  } else {
    token.set('light_losangle', 360);
    token.set('light_hassight', true);
  }
};

MML.alterHP = async function alterHP(player, character, bodyPart, hpAmount) {
  var initialHP = character.hp[bodyPart];
  var currentHP = initialHP + hpAmount;
  var maxHP = character.hpMax[bodyPart];

  if (hpAmount < 0) { //if damage
    var duration;
    character.hp[bodyPart] = currentHP;

    //Wounds
    if (currentHP < Math.round(maxHP / 2) && currentHP >= 0) { //Major wound
      if (initialHP >= Math.round(maxHP / 2)) { //Fresh wound
        duration = Math.round(maxHP / 2) - currentHP;
      } else if (!_.has(character.statusEffects, 'Major Wound, ' + bodyPart)) {
        duration = -hpAmount;
      } else { //Add damage to duration of effect
        duration = parseInt(character.statusEffects['Major Wound, ' + bodyPart].duration) - hpAmount;
      }
      await MML.displayMenu(player, character.name + '\'s Major Wound Roll', ['Roll']);
      const result = await MML.attributeCheckRoll(player, character.willpower);
      if (result === 'Failure') {
        MML.addStatusEffect(character, 'Major Wound, ' + bodyPart, {
          duration: duration,
          startingRound: state.MML.GM.currentRound,
          bodyPart: bodyPart
        });
      }
    } else if (currentHP < 0 && currentHP > -maxHP) { //Disabling wound
      if (!_.has(character.statusEffects, 'Disabling Wound, ' + bodyPart)) { //Fresh wound
        duration = -currentHP;
      } else if (_.has(character.statusEffects, 'Stunned')) { //Add damage to duration of effect
        duration = parseInt(character.statusEffects['Stunned'].duration) - hpAmount;
      } else {
        duration = -hpAmount;
      }
      await MML.displayMenu(player, character.name + '\'s Disabling Wound Roll', ['Roll']);
      const result = await MML.attributeCheckRoll(player, character.systemStrength);
      MML.addStatusEffect(character, 'Disabling Wound, ' + bodyPart, {
        bodyPart: bodyPart
      });
      if (result === 'Failure') {
        if (_.has(character.statusEffects, 'Stunned')) {
          character.statusEffects['Stunned'].duration = duration;
        } else {
          MML.addStatusEffect(character, 'Stunned', {
            startingRound: state.MML.GM.currentRound,
            duration: duration
          });
        }
      }
    } else if (currentHP < -maxHP) { //Mortal wound
      MML.addStatusEffect(character, 'Mortal Wound, ' + bodyPart, {
        bodyPart: bodyPart
      });
    }
  } else { //if healing
    character.hp[bodyPart] += hpAmount;
    if (character.hp[bodyPart] > maxHP) {
      character.hp[bodyPart] = maxHP;
    }
  }
  await MML.setWoundFatigue(player, character);
};

MML.setWoundFatigue = async function setWoundFatigue(player, character) {
  const currentHP = character.hp;
  currentHP['Wound Fatigue'] = character.hpMax['Wound Fatigue'];

  _.each(MML.getBodyParts(character), function (bodyPart) {
    if (currentHP[bodyPart] >= Math.round(character.hpMax[bodyPart] / 2)) { //Only minor wounds apply
      currentHP['Wound Fatigue'] -= character.hpMax[bodyPart] - currentHP[bodyPart];
    } else {
      currentHP['Wound Fatigue'] -= character.hpMax[bodyPart] - Math.round(character.hpMax[bodyPart] / 2);
    }
  });

  if (currentHP['Wound Fatigue'] < 0 && !_.has(character.statusEffects, 'Wound Fatigue')) {
    await MML.displayMenu(player, character.name + '\'s Wound Fatigue Roll', ['Roll']);
    const result = await MML.attributeCheckRoll(player, character.systemStrength);
    if (result === 'Failure') {
      MML.addStatusEffect(character, 'Wound Fatigue', {});
    }
  }
};

MML.knockdownCheck = async function knockdownCheck(player, character, damage) {
  character.knockdown += damage;
  if (character.movementType !== 'Prone' && character.knockdown < 1) {
    await MML.displayMenu(player, character.name + '\'s Knockdown Roll', ['Roll']);
    const result = await MML.attributeCheckRoll(player, character.systemStrength, [_.has(character.statusEffects, 'Stumbling') ? -5 : 0])
    if (result === 'Failure') {
      character.movementType = 'Prone';
    } else {
      MML.addStatusEffect(character, 'Stumbling', {
        startingRound: state.MML.GM.currentRound
      });
    }
  }
};

MML.sensitiveAreaCheck = async function sensitiveAreaCheck(player, character, hitPosition) {
  if (MML.sensitiveAreas[character.bodyType].includes(hitPosition)) {
    await MML.displayMenu(player, character.name + '\'s Sensitive Area Roll', ['Roll']);
    const result = await MML.attributeCheckRoll(player, character.willpower);
    if (result === 'Failure') {
      MML.addStatusEffect(character, 'Sensitive Area', {
        startingRound: state.MML.GM.currentRound
      });
    }
  }
};

MML.damageCharacter = async function damageCharacter(player, character, damage, type, hitPosition) {
  const reducedDamage = await MML.armorDamageReduction(player, character, hitPosition.name, damage, type);
  await MML.alterHP(player, character, hitPosition.bodyPart, reducedDamage);
  await MML.sensitiveAreaCheck(player, character, hitPosition.name);
  await MML.knockdownCheck(player, character, damage);
};

MML.alterEP = async function alterEP(player, character, epAmount) {
  character.ep += epAmount;
  if (character.ep < Math.round(0.25 * character.epMax)) {
    await MML.fatigueCheck(player, character);
  }
};

MML.armorDamageReduction = async function armorDamageReduction(player, character, position, damage, type) {
  const positionApvs = character.armorProtectionValues[position];
  const baseApvs = positionApvs[type];
  const impactApvs = positionApvs['Impact'];
  var apvBase;
  var apvImpact;
  if (baseApvs.length > 1) {
    await MML.displayMenu(player, 'Armor Coverage Roll', ['Roll']);
    const coverageRoll = await genericRoll(player, '1d100');
    apvBase = _.find(positionApvs[type], function (apv) {
      return coverageRoll <= apv.coverage;
    }).value;
    apvImpact = _.find(positionApvs.Impact, function (apv) {
      return coverageRoll <= apv.coverage;
    }).value;
  } else {
    apvBase = baseApvs[0];
    apvImpact = impactApvs[0];
  }
  const baseDamage = damage + apvBase;
  if (baseDamage > 0 && !['Impact', 'Flanged'].includes(type)) {
    const impactDamage = ['Surface', 'Cut', 'Pierce'].includes(type) ? Math.ceil(damage / 2) : Math.ceil(damage * 0.75);
    if (impactDamage + apvImpact < 0) {
      return impactDamage + apvImpact;
    }
  }
  return 0;
};

MML.equipmentFailure = function equipmentFailure(character) {
  log('equipmentFailure');
};

MML.applyStatusEffects = function applyStatusEffects(character) {
  const dependents = [
    'situationalInitBonus',
    'situationalMod',
    'missileDefenseMod',
    'meleeDefenseMod',
    'missileAttackMod',
    'meleeAttackMod',
    'castingMod',
    'perceptionCheckMod'
  ];
  _.each(dependents, function (dependent) {
    character[dependent] = 0;
  }, character);
  _.each(character.statusEffects, function (effect, index) {
    if (index.indexOf('Major Wound') !== -1) {
      MML.statusEffects['Major Wound'].apply(character, [effect, index]);
    } else if (index.indexOf('Disabling Wound') !== -1) {
      MML.statusEffects['Disabling Wound'].apply(character, [effect, index]);
    } else if (index.indexOf('Mortal Wound') !== -1) {
      MML.statusEffects['Mortal Wound'].apply(character, [effect, index]);
    } else {
      MML.statusEffects[index].apply(character, [effect, index]);
    }
    MML.setCurrentAttribute(character.id, 'repeating_statuseffects_' + effect.id + '_statusEffectName', index);
    MML.setCurrentAttribute(character.id, 'repeating_statuseffects_' + effect.id + '_statusEffectDescription', (effect.description ? effect.description : ''));
  });

  const regex = new RegExp('^repeating_statuseffects_.*?_.*?$');
  const statusEffectIDs = _.pluck(character.statusEffects, 'id');
  const statusEffects = filterObjs(function (obj) {
    if (obj.get('type') !== 'attribute' || obj.get('characterid') !== character.id) {
      return false;
    } else {
      return regex.test(obj.get('name'));
    }
  });
  _.each(statusEffects, function (attribute) {
    const name = attribute.get('name', 'current');
    if (_.isString(name) && !statusEffectIDs.some(id => name.includes(id))) {
      attribute.remove();
    }
  });
};

MML.addStatusEffect = function addStatusEffect(character, index, effect) {
  effect.id = MML.generateRowID();
  effect.name = index;
  character.statusEffects[index] = effect;
  MML.applyStatusEffects(character);
};

MML.removeStatusEffect = function removeStatusEffect(character, index) {
  if (!_.isUndefined(character.statusEffects[index])) {
    delete character.statusEffects[index];
    MML.applyStatusEffects(character);
  }
};

MML.updateInventory = function updateInventory(character) {
  const items = _.omit(character.inventory, 'emptyHand');
  _.each(items, function (item, _id) {
    MML.setCurrentAttribute(character.id, 'repeating_items_' + _id + '_itemName', item.name);
    MML.setCurrentAttribute(character.id, 'repeating_items_' + _id + '_itemId', _id);
  }, character);
  items.emptyHand = {
    type: 'empty',
    weight: 0
  };
  character.inventory = items;
};

MML.isSensitiveArea = function isSensitiveArea(position) {
  return [2, 6, 33].includes(position);
};

MML.equipItem = function equipItem(character, itemId, grip) {
  if (grip === 'Left Hand') {
    character.leftHand._id = itemId;
    if (character.inventory[itemId].type === 'weapon') {
      character.leftHand.grip = 'One Hand';
    } else {
      character.leftHand.grip = 'unarmed';
    }
  } else if (grip === 'Right Hand') {
    character.rightHand._id = itemId;
    if (character.inventory[itemId].type === 'weapon') {
      character.rightHand.grip = 'One Hand';
    } else {
      character.rightHand.grip = 'unarmed';
    }
  } else {
    character.leftHand._id = itemId;
    character.leftHand.grip = grip;
    character.rightHand._id = itemId;
    character.rightHand.grip = grip;
  }
};

MML.hasStatusEffects = function hasStatusEffects(character, effects) {
  return !_.isEmpty(_.intersection(_.keys(character.statusEffects), effects));
};

MML.getHitPosition = function getHitPosition(character, rollValue) {
  if (isNaN(rollValue)) {
    return 'Error: Value is not a number';
  } else if (rollValue < 1 || rollValue > 100) {
    return 'Error: Value out of range';
  } else {
    return MML.hitPositions[character.bodyType][MML.hitTables[character.bodyType][character.hitTable][rollValue - 1]];
  }
};

MML.getHitTable = function getHitTable(bodyType, inventory, leftHand, rightHand) {
  switch (character.bodyType) {
    case 'humanoid':
      if (character.inventory[character.rightHand._id].type === 'shield' || character.inventory[character.leftHand._id].type === 'shield') {
        return 'C';
      } else if (MML.isWieldingRangedWeapon(character) || MML.isUnarmed(character) || !(character.inventory[character.leftHand._id].type === 'weapon' && character.inventory[character.rightHand._id].type === 'weapon')) {
        return 'A';
      } else {
        return 'B';
      }
    default:
      log('Error: Body type not found');
      return 'Error: Body type not found';
  }
};

MML.getHitPositionNames = function getHitPositionNames(character) {
  if (_.isUndefined(MML.hitPositions[character.bodyType])) {
    return 'Error: Body type not found';
  } else {
    return _.pluck(MML.hitPositions[character.bodyType], 'name');
  }
};

MML.getBodyParts = function getBodyParts(character) {
  if (_.isUndefined(MML.hitPositions[character.bodyType])) {
    return 'Error: Body type not found';
  } else {
    return _.chain(MML.hitPositions[character.bodyType])
      .pluck('bodyPart')
      .uniq()
      .value();
  }
};

MML.getBodyPart = function getBodyPart(character, hitPosition) {
  if (_.isUndefined(MML.hitPositions[character.bodyType])) {
    return 'Error: Body type not found';
  } else {
    return _.findWhere(MML.hitPositions[character.bodyType], {
      name: hitPosition
    });
  }
};

MML.getAvailableHitPositions = function getAvailableHitPositions(character, bodyPart) {
  const availableHitPositions = _.where(MML.hitPositions[character.bodyType], {
    bodyPart: bodyPart
  });

  if (availableHitPositions.length < 1) {
    return 'Error: No hit positions found';
  } else {
    return availableHitPositions;
  }
};

MML.getCalledShotHitPosition = function getCalledShotHitPosition(character, rollValue, bodyPart) {
  const availableHitPositions = MML.getAvailableHitPositions(character, bodyPart);
  if (isNaN(rollValue)) {
    return 'Error: Value is not a number';
  } else if (availableHitPositions === 'Error: No hit positions found') {
    return availableHitPositions;
  } else if (rollValue < 1 || rollValue > availableHitPositions.length) {
    return 'Error: Value out of range';
  } else {
    return availableHitPositions[rollValue - 1];
  }
};

MML.buildHpAttribute = function buildHpAttribute(race, stature, strength, health, willpower) {
  switch (character.bodyType) {
    case 'humanoid':
      return {
        'Wound Fatigue': Math.round((health + stature + willpower) / 2),
        'Head': MML.HPTables[race][Math.round(health + stature / 3)],
        'Chest': MML.HPTables[race][Math.round(health + stature + strength)],
        'Abdomen': MML.HPTables[race][Math.round(health + stature)],
        'Left Arm': MML.HPTables[race][Math.round(health + stature)],
        'Right Arm': MML.HPTables[race][Math.round(health + stature)],
        'Left Leg': MML.HPTables[race][Math.round(health + stature)],
        'Right Leg': MML.HPTables[race][Math.round(health + stature)],
      };
    default:
      log('Oh No!');
  }
};

MML.getDistanceBetweenCharacters = function getDistanceBetweenCharacters(character, target) {
  return MML.pixelsToFeet(MML.getDistanceBetweenTokens(MML.getCharacterToken(character.id), MML.getCharacterToken(target.id)));
};

MML.getAoESpellTargets = function getAoESpellTargets(spellMarker) {
  switch (spellMarker.get('name')) {
    case 'spellMarkerCircle':
      return MML.getCharactersWithinRadius(spellMarker.get('left'), spellMarker.get('top'), spellMarker.get('width') / 2);
    case 'spellMarkerRectangle':
      return MML.getCharactersWithinRectangle(spellMarker.get('left'), spellMarker.get('top'), spellMarker.get('width'), spellMarker.get('height'), spellMarker.get('rotation'));
    case 'spellMarkerTriangle':
      return MML.getCharactersWithinTriangle(spellMarker.get('left'), spellMarker.get('top'), spellMarker.get('width'), spellMarker.get('height'), spellMarker.get('rotation'));
    default:
  }
};

MML.getCharactersWithinRadius = function getCharactersWithinRadius(left, top, radius) {
  return _.filter(MML.characters, function (character) {
    const charToken = MML.getCharacterToken(character.id);
    return !_.isUndefined(charToken) && MML.getDistanceFeet(charToken.get('left'), left, charToken.get('top'), top) < MML.raceSizes[character.race].radius + MML.pixelsToFeet(radius);
  });
};

MML.getCharactersWithinRectangle = function getCharactersWithinRectangle(leftOriginal, topOriginal, width, height, rotation) {
  return _.filter(MML.characters, function (character) {
    const charToken = MML.getCharacterToken(character.id);
    const tokenCoordinates = MML.rotateAxes(charToken.get('left') - leftOriginal, charToken.get('top') - topOriginal, rotation);
    const tokenRadius = MML.feetToPixels(MML.raceSizes[character.race].radius);

    return !_.isUndefined(charToken) &&
      tokenCoordinates[0] + tokenRadius > width / -2 &&
      tokenCoordinates[0] - tokenRadius < width / 2 &&
      tokenCoordinates[1] - tokenRadius < height / 2 &&
      tokenCoordinates[1] + tokenRadius > height / -2
  });
};

MML.getCharactersWithinTriangle = function getCharactersWithinTriangle(leftOriginal, topOriginal, width, height, rotation) {
  return _.filter(MML.characters, function (character) {
    const charToken = MML.getCharacterToken(character.id);
    const tokenCoordinates = MML.rotateAxes(charToken.get('left') - leftOriginal, charToken.get('top') - topOriginal, rotation);
    const tokenRadius = MML.feetToPixels(MML.raceSizes[character.race].radius);
    const ax = (-width * (tokenCoordinates[1] - (height / 2))) / (2 * height);
    const ay = tokenCoordinates[1];
    const bx = tokenCoordinates[0];
    const by = ((-2 * height * tokenCoordinates[0]) / width) + (height / 2);
    const cx = (width * (tokenCoordinates[1] - (height / 2))) / (2 * height);
    const cy = tokenCoordinates[1];
    const dx = tokenCoordinates[0];
    const dy = ((2 * height * tokenCoordinates[0]) / width) + (height / 2);

    return !_.isUndefined(charToken) &&
      tokenCoordinates[1] - tokenRadius < height / 2 &&
      tokenCoordinates[1] + tokenRadius > height / -2 &&
      ((MML.getDistance(ax, tokenCoordinates[0], ay, tokenCoordinates[1]) * MML.getDistance(bx, tokenCoordinates[0], by, tokenCoordinates[1])) / MML.getDistance(ax, bx, ay, by) < tokenRadius ||
        (MML.getDistance(cx, tokenCoordinates[0], cy, tokenCoordinates[1]) * MML.getDistance(dx, tokenCoordinates[0], dy, tokenCoordinates[1])) / MML.getDistance(cx, dx, cy, dy) < tokenRadius ||
        (tokenCoordinates[0] < ax && tokenCoordinates[0] > cx));
  });
};

MML.getSkill = function getSkill(character, skill) {
  return _.isUndefined(character.skills[skill]) ? 0 : character.skills[skill].level;
};

MML.getMagicSkill = function getMagicSkill(character, spell) {
  const family = spell.family;
  if (['Fire', 'Earth', 'Water', 'Air', 'Life'].includes(spell.family)) {
    const wizardry_skill = MML.getSkill(character, 'Wizardry') - (MML.getSkill(character, 'Lore: Element of ' + family) > 19 ? 10 : 20);
    const elementalism_skill = MML.getSkill(character, family + ' Elementalism');
    if (wizardry_skill > elementalism_skill) {
      return {
        name: 'Wizardry',
        level: wizardry_skill
      };
    } else {
      return {
        name: family + ' Elementalism',
        level: elementalism_skill
      };
    }
  } else if (spell.family === 'Symbolism') {
    return {
      name: 'Symbolism',
      level: MML.getSkill(character, 'Symbolism')
    };
  } else {
    return {
      name: 'Wizardry',
      level: MML.getSkill(character, 'Wizardry')
    };
  }
};

MML.getElementalSkill = function getElementalSkill(character, element) {

};

MML.getEpCost = function getEpCost(skillName, skillLevel, ep) {
  skillName = skillName.replace(/(Earth|Air|Fire|Water|Life)\s/, '');
  if (skillLevel < 6) {
    return MML.epModifiers[skillName][ep][0];
  } else if (skillLevel < 11) {
    return MML.epModifiers[skillName][ep][1];
  } else if (skillLevel < 16) {
    return MML.epModifiers[skillName][ep][2];
  } else if (skillLevel < 21) {
    return MML.epModifiers[skillName][ep][3];
  } else if (skillLevel < 26) {
    return MML.epModifiers[skillName][ep][4];
  } else if (skillLevel < 31) {
    return MML.epModifiers[skillName][ep][5];
  } else if (skillLevel < 36) {
    return MML.epModifiers[skillName][ep][6];
  } else if (skillLevel < 41) {
    return MML.epModifiers[skillName][ep][7];
  } else if (skillLevel < 46) {
    return MML.epModifiers[skillName][ep][8];
  } else if (skillLevel < 51) {
    return MML.epModifiers[skillName][ep][9];
  } else if (skillLevel < 60) {
    return MML.epModifiers[skillName][ep][10];
  } else if (skillLevel < 70) {
    return MML.epModifiers[skillName][ep][11];
  } else {
    return MML.epModifiers[skillName][ep][12];
  }
};

MML.getModifiedCastingChance = function getModifiedCastingChance(character, action) {
  return [
    action.casterSkill,
    action.spell.task,
    character.situationalMod,
    character.castingMod,
    character.attributeCastingMod,
    _.reduce(_.pluck(action.metaMagic, 'castingMod'), (sum, num) => sum + num)
  ];
};

MML.getModifiedEpCost = function getModifiedEpCost(metaMagic, epCost) {
  return _.reduce(_.pluck(metaMagic, 'epMod'), (sum, num) => sum + num, 1) * epCost;
};

MML.getAoESpellModifier = function getAoESpellModifier(spellMarker, spell) {
  var area;
  var areaModified;
  var castingMod;

  if (typeof spell.target === 'string' && spell.target.indexOf('\' Radius')) {
    const base_radius = parseInt(spell.target.replace('\' Radius', ''));
    const modified_radius = MML.pixelsToFeet(spellMarker.get('width') / 2);
    area = Math.pow(base_radius, 2);
    areaModified = Math.pow(modified_radius, 2);
    castingMod = Math.round(Math.log2(modified_radius / base_radius) * 20);
  } else {
    const height = spellMarker.get('height');
    const width = spellMarker.get('width');
    area = spell.target[0] * spell.target[1];
    areaModified = width * height;
    castingMod = Math.round(Math.log2(width / spell.target[0]) * 10 + Math.log2(height / spell.target[1]) * 10);
  }

  return {
    epMod: areaModified > area ? Math.pow(areaModified / area, 2) : 0,
    castingMod: castingMod > 0 ? 0 : castingMod
  };
};

MML.getRangeCastingModifier = function getRangeCastingModifier(caster, targets, spell) {
  if (['Caster', 'Touch', 'Single'].includes(spell.target)) {
    return target.reduce(function (mod, target) {
      const distance = MML.getDistanceBetweenCharacters(caster, target);
      if (spell.range === 'Caster' || spell.range === 'Touch') {
        const self_range_mod = spell.range === 'Caster' && target.id !== caster.id ? -10 : 0;
        if (distance > MML.weaponRanks[1].high) {
          return mod + MML.weaponRanks[1].high - distance + self_range_mod;
        }
      } else {
        if (distance > spell.range) {
          return mod + Math.round(((spell.range - distance) / distance) * 10);
        }
      }
    });
  } else {
    const distance = MML.getDistanceBetweenTokens(MML.getCharacterToken(caster.id), MML.getSpellMarkerToken(spell.name));
    return distance > spell.range ? Math.round(((spell.range - distance) / distance) * 10) : 0;
  }
};

MML.removeAimAndObserving = function removeAimAndObserving(character) {
  if (_.has(character.statusEffects, 'Taking Aim')) {
    MML.removeStatusEffect(character, 'Taking Aim');
  }
  if (_.has(character.statusEffects, 'Observing')) {
    MML.removeStatusEffect(character, 'Observing');
  }
};

MML.validateAction = function validateAction(character) {
  var valid = true;

  switch (character.action.name) {
    case 'Attack':
      switch (character.action.attackType) {
        case 'Grapple':
          if (_.has(character.statusEffects, 'Grappled') &&
            _.has(character.statusEffects, 'Held') &&
            _.has(character.statusEffects, 'Taken Down') &&
            _.has(character.statusEffects, 'Pinned') &&
            _.has(character.statusEffects, 'Overborne')
          ) {
            valid = false;
          }
          break;
        case 'Regain Feet':
          if (!((_.has(character.statusEffects, 'Grappled') || _.has(character.statusEffects, 'Held') || _.has(character.statusEffects, 'Holding')) &&
              character.movementType === 'Prone') ||
            (!(_.has(character.statusEffects, 'Taken Down') || _.has(character.statusEffects, 'Overborne')) || _.has(character.statusEffects, 'Pinned'))
          ) {
            valid = false;
          }
          break;
        case 'Place a Hold':
          if (_.has(character.statusEffects, 'Holding') &&
            _.has(character.statusEffects, 'Held') &&
            _.has(character.statusEffects, 'Pinned') &&
            (_.has(character.statusEffects, 'Grappled') && character.statusEffects['Grappled'].targets.length > 1)
          ) {
            valid = false;
          }
          break;
        case 'Break a Hold':
          if (!_.has(character.statusEffects, 'Held') && !_.has(character.statusEffects, 'Pinned')) {
            valid = false;
          }
          break;
        case 'Break Grapple':
          if (!_.has(character.statusEffects, 'Grappled')) {
            valid = false;
          }
          break;
        case 'Takedown':
          if (((!_.has(character.statusEffects, 'Holding') &&
              (!_.has(character.statusEffects, 'Grappled') || character.statusEffects['Grappled'].targets.length > 1) &&
              (!_.has(character.statusEffects, 'Held') || character.statusEffects['Held'].targets.length > 1))) ||
            (_.has(character.statusEffects, 'Grappled') && _.has(character.statusEffects, 'Held')) ||
            character.movementType === 'Prone'
          ) {
            valid = false;
          }
          break;
        case 'Head Butt':
        case 'Bite':
          if (!_.has(character.statusEffects, 'Held') &&
            !_.has(character.statusEffects, 'Grappled') &&
            !_.has(character.statusEffects, 'Holding') &&
            !_.has(character.statusEffects, 'Taken Down') &&
            !_.has(character.statusEffects, 'Pinned') &&
            !_.has(character.statusEffects, 'Overborne')
          ) {
            valid = false;
          }
          break;
        default:
      }
      break;
    default:
  }

  return valid;
};

MML.buildApvMatrix = function buildApvMatrix(inventory, bodyType) {
  const armor = inventory.values()
    .filter(item => item.type === 'armor')
    .reduce();

  var apvMatrix = {};
  // Initialize APV Matrix
  _.each(MML.hitPositions[bodyType], function (position) {
    apvMatrix[position.name] = {
      Surface: [{
        value: 0,
        coverage: 100
      }],
      Cut: [{
        value: 0,
        coverage: 100
      }],
      Chop: [{
        value: 0,
        coverage: 100
      }],
      Pierce: [{
        value: 0,
        coverage: 100
      }],
      Thrust: [{
        value: 0,
        coverage: 100
      }],
      Impact: [{
        value: 0,
        coverage: 100
      }],
      Flanged: [{
        value: 0,
        coverage: 100
      }]
    };
  });
  //Creates raw matrix of individual pieces of armor (no layering or partial coverage)

  _.each(armor, function (piece) {
    var material = MML.APVList[piece.material];

    _.each(piece.protection, function (protection) {
      var position = MML.hitPositions[bodyType][protection.position].name;
      var coverage = protection.coverage;
      apvMatrix[position].Surface.push({
        value: material.surface,
        coverage: coverage
      });
      apvMatrix[position].Cut.push({
        value: material.cut,
        coverage: coverage
      });
      apvMatrix[position].Chop.push({
        value: material.chop,
        coverage: coverage
      });
      apvMatrix[position].Pierce.push({
        value: material.pierce,
        coverage: coverage
      });
      apvMatrix[position].Thrust.push({
        value: material.thrust,
        coverage: coverage
      });
      apvMatrix[position].Impact.push({
        value: material.impact,
        coverage: coverage
      });
      apvMatrix[position].Flanged.push({
        value: material.flanged,
        coverage: coverage
      });
    });
  });

  //This loop accounts for layered armor and partial coverage and outputs final APVs
  _.each(apvMatrix, function (position, positionName) {
    _.each(position, function (rawAPVArray, type) {
      var apvFinalArray = [];
      var coverageArray = [];

      //Creates an array of armor coverage in ascending order.
      _.each(rawAPVArray, function (armorProtectionValues) {
        if (coverageArray.indexOf(armorProtectionValues.coverage) === -1) {
          coverageArray.push(armorProtectionValues.coverage);
        }
      });
      coverageArray = coverageArray.sort((a, b) => a - b);

      //Creates APV array per damage type per position
      _.each(coverageArray, function (apvCoverage) {
        var apvToLayerArray = [];
        var apvValue = 0;

        //Builds an array of APVs that meet or exceed the coverage value
        _.each(rawAPVArray, function (armorProtectionValues) {
          if (armorProtectionValues.coverage >= apvCoverage) {
            apvToLayerArray.push(armorProtectionValues.value);
          }
        });
        apvToLayerArray = apvToLayerArray.sort(function (a, b) {
          return b - a;
        });

        //Adds the values at coverage value with diminishing returns on layered armor
        _.each(apvToLayerArray, function (value, index) {
          apvValue += value * Math.pow(2, -index);
          apvValue = Math.round(apvValue);
        });
        //Puts final APV and associated Coverage into final APV array for that damage type.
        apvFinalArray.push({
          value: apvValue,
          coverage: apvCoverage
        });
      });
      apvMatrix[positionName][type] = apvFinalArray;
    });
  });
  return apvMatrix;
};

// Rx operators
MML.rollAttributeChanged = function rollAttributeChanged(name) {
  return function (source) {
    return source.pipe(
      filter(attribute => attribute.get('name') === name),
      map(function (attribute) {
        const roll = parseFloat(attribute.get('current'));
        if (isNaN(roll) || roll < 6) {
          MML.setCurrentAttribute(attribute.get('_characterid'), name, 6);
          return 6;
        } else if (roll > 20) {
          MML.setCurrentAttribute(attribute.get('_characterid'), name, 20);
          return 20;
        } else {
          return roll;
        }
      })
    );
  };
};

MML.inputAttributeChanged = function inputAttributeChanged(name) {
  return function (source) {
    return source.pipe(
      filter(attribute => attribute.get('name') === name),
      map(attribute => attribute.get('current'))
    );
  };
};

MML.repeating_attribute_added = on('add:attribute', function (attribute) {
  var id = attribute.get('_characterid');
  var attrName = attribute.get('name');

  if (attrName.includes('repeating_skills') || attrName.includes('repeating_weaponskills')) {
    MML.updateCharacterSheet(characters[id]);
  }
});

MML.derivedAttribute = function derivedAttribute(name, compute, ...attributes) {
  const user_changed = MML.change_attribute_current.pipe(
    filter(attribute => attribute.get('name') === name),
    startWith(MML.getCurrentAttribute(attribute.get('_characterid'), name))
  );
  return Rx.combineLatest(attributes.concat(user_changed)).pipe(map((attributes) => compute(...attributes)));
};

// Character Creation
MML.createCharacter = function (r20_character) {
  const id = r20_character.get('id');
  const character = {
    id
  };

  const attribute_changed = Rx.change_attribute_current.pipe(
    filter(attribute => attribute.get('_characterid') === id)
  );

  const game_state = MML.game_state.pipe(filter(effect => effect.object_id === id));
  // Rx.add_attribute
  // Rx.change_attribute_current

  // Object.defineProperty(character, 'player', {
  //   get: function () {
  //     return MML.players[MML.getCurrentAttribute(character.id, 'player')];
  //   },

  // const epMax = evocation;

  // const ep = _.isUndefined(getAttrByName(character.id, 'ep', 'current')) ? character.evocation : MML.getCurrentAttributeAsFloat(character.id, 'ep');

  // const fatigueMax = fitness;
  // const fatigue = isNaN(parseFloat(MML.getCurrentAttribute(character.id, 'fatigue'))) ? character.fitness : MML.getCurrentAttributeAsFloat(character.id, 'fatigue');
  // const knockdown = isNaN(parseFloat(MML.getCurrentAttribute(character.id, 'knockdown'))) ? character.knockdownMax : MML.getCurrentAttributeAsFloat(character.id, 'knockdown');

  // #region Input Attributes
  const name = Rx.change_character_name.pipe(
    filter(changed_character => changed_character.get('id') === id),
    map(changed_character => changed_character.get('name')),
    startWith()
  );

  const stature_roll = attribute_changed.pipe(MML.rollAttributeChanged('stature_roll'));
  const strength_roll = attribute_changed.pipe(MML.rollAttributeChanged('strength_roll'));
  const coordination_roll = attribute_changed.pipe(MML.rollAttributeChanged('coordination_roll'));
  const health_roll = attribute_changed.pipe(MML.rollAttributeChanged('health_roll'));
  const beauty_roll = attribute_changed.pipe(MML.rollAttributeChanged('beauty_roll'));
  const intellect_roll = attribute_changed.pipe(MML.rollAttributeChanged('intellect_roll'));
  const reason_roll = attribute_changed.pipe(MML.rollAttributeChanged('reason_roll'));
  const creativity_roll = attribute_changed.pipe(MML.rollAttributeChanged('creativity_roll'));
  const presence_roll = attribute_changed.pipe(MML.rollAttributeChanged('presence_roll'));
  const race = attribute_changed.pipe(MML.inputAttributeChanged('race'));
  const gender = attribute_changed.pipe(MML.inputAttributeChanged('gender'));
  const handedness = attribute_changed.pipe(MML.inputAttributeChanged('handedness'));

  // const inventory = MML.getCurrentAttributeObject(character.id, 'inventory').pipe(startWith({
  //   emptyHand: {
  //     type: 'empty',
  //     weight: 0
  //   }));
  // const leftHand = _.isEmpty(MML.getCurrentAttributeObject(character.id, 'leftHand')) ? JSON.stringify({
  //   _id: 'emptyHand',
  //   grip: 'unarmed'
  // }) : MML.getCurrentAttributeObject(character.id, 'leftHand');

  // const rightHand = _.isEmpty(MML.getCurrentAttributeObject(character.id, 'rightHand')) ? JSON.stringify({
  //   _id: 'emptyHand',
  //   grip: 'unarmed'
  // }) : MML.getCurrentAttributeObject(character.id, 'rightHand');
  // const spells = MML.getCurrentAttributeAsArray(character.id, 'spells');
  // #endregion

  // #region Derived Attributes
  const bodyType = MML.derivedAttribute('bodyType', race => MML.bodyTypes[race], race);
  const height = MML.derivedAttribute('height', (race, gender, stature_roll) => MML.statureTables[race][gender][stature_roll].height, race, gender, stature_roll);
  const weight = MML.derivedAttribute('weight', (race, gender, stature_roll) => MML.statureTables[race][gender][stature_roll].weight, race, gender, stature_roll);
  const stature = MML.derivedAttribute('stature', (race, gender, stature_roll) => MML.statureTables[race][gender][stature_roll].stature, race, gender, stature_roll);
  const strength = MML.derivedAttribute('strength', (race, strength_roll) => MML.racialAttributeBonuses[race].strength + strength_roll, race, strength_roll);
  const coordination = MML.derivedAttribute('coordination', (race, coordination_roll) => MML.racialAttributeBonuses[race].coordination + coordination_roll, race, coordination_roll);
  const health = MML.derivedAttribute('health', (race, health_roll) => MML.racialAttributeBonuses[race].health + health_roll, race, health_roll);
  const beauty = MML.derivedAttribute('beauty', (race, beauty_roll) => MML.racialAttributeBonuses[race].beauty + beauty_roll, race, beauty_roll);
  const intellect = MML.derivedAttribute('intellect', (race, intellect_roll) => MML.racialAttributeBonuses[race].intellect + intellect_roll, race, intellect_roll);
  const reason = MML.derivedAttribute('reason', (race, reason_roll) => MML.racialAttributeBonuses[race].reason + reason_roll, race, reason_roll);
  const creativity = MML.derivedAttribute('creativity', (race, creativity_roll) => MML.racialAttributeBonuses[race].creativity + creativity_roll, race, creativity_roll);
  const presence = MML.derivedAttribute('presence', (race, presence_roll) => MML.racialAttributeBonuses[race].presence + presence_roll, race, presence_roll);
  const willpower = MML.derivedAttribute('willpower', (presence, health) => Math.round((2 * presence + health) / 3), presence, health);
  const perception = MML.derivedAttribute('perception', (race, intellect, reason, creativity) => Math.round((intellect + reason + creativity) / 3) + MML.racialAttributeBonuses[race].perception, race, intellect, reason, creativity);
  const systemStrength = MML.derivedAttribute('systemStrength', (presence, health) => Math.round((presence + 2 * health) / 3), presence, health);
  const fitness = MML.derivedAttribute('fitness', (race, health, strength) => Math.round((health + strength) / 2) + MML.racialAttributeBonuses[race].fitness, race, health, strength);
  const fitnessMod = MML.derivedAttribute('fitnessMod', fitness => MML.fitnessModLookup[fitness], fitness);
  const load = MML.derivedAttribute('load', (race, stature, fitnessMod) => Math.round(stature * fitnessMod) + MML.racialAttributeBonuses[race].load, race, stature, fitnessMod);
  const overhead = MML.derivedAttribute('overhead', (load) => load * 2, load);
  const deadLift = MML.derivedAttribute('deadLift', (load) => load * 4, load);
  const hpMax = MML.derivedAttribute('hpMax', MML.buildHpAttribute, race, stature, strength, health, willpower);
  const hpRecovery = MML.derivedAttribute('hpRecovery', health => MML.recoveryMods[health].hp, health);
  const evocation = MML.derivedAttribute('evocation', (race, intellect, reason, creativity, health, willpower) => intellect + reason + creativity + health + willpower + MML.racialAttributeBonuses[race].evocation,
    race,
    intellect,
    reason,
    creativity,
    health,
    willpower
  );
  const epRecovery = MML.derivedAttribute('epRecovery', health => MML.recoveryMods[health].ep, health);
  const totalWeightCarried = MML.derivedAttribute('totalWeightCarried', inventory => _.reduce(_.pluck(inventory, 'weight'), (sum, num) => sum + num, 0), inventory);
  const knockdownMax = MML.derivedAttribute('knockdownMax', Math.round(stature + (totalWeightCarried / 10)), stature, totalWeightCarried);
  const armorProtectionValues = ML.derivedAttribute(MML.buildApvMatrix, bodyType, inventory);
  const movementRatio = MML.derivedAttribute('movementRatio', function (load, totalWeightCarried) {
    const movementRatio = totalWeightCarried === 0 ? Math.round(10 * load) / 10 : Math.round(10 * load / totalWeightCarried) / 10;
    return movementRatio > 4.0 ? 4.0 : movementRatio;
  }, load, totalWeightCarried);

  const attributeDefenseMod = MML.derivedAttribute('attributeDefenseMod', (strength, coordination) => MML.attributeMods.strength[strength] + MML.attributeMods.coordination[coordination], strength, coordination);
  const attributeMeleeAttackMod = MML.derivedAttribute('attributeMeleeAttackMod', (strength, coordination) => MML.attributeMods.strength[strength] + MML.attributeMods.coordination[coordination], strength, coordination);
  const attributeMissileAttackMod = MML.derivedAttribute('attributeMissileAttackMod', (strength, coordination, perception) => MML.attributeMods.perception[perception] + MML.attributeMods.coordination[coordination] + MML.attributeMods.strength[strength], strength, coordination, perception);
  const meleeDamageMod = MML.derivedAttribute('meleeDamageMod', _.find(MML.meleeDamageMods, ({
    high,
    low
  }) => load >= low && load <= high).value, load);
  const spellLearningMod = MML.derivedAttribute('spellLearningMod', intellect => MML.attributeMods.intellect[intellect], intellect);

  // const hitTable = MML.getHitTable(character);
  // #endregion

  // #region Variable Attributes
  const movementAvailable = MML.getCurrentAttributeAsFloat(character.id, 'movementAvailable');
  const movementType = MML.getCurrentAttribute(character.id, 'movementType');
  const pathID = MML.getCurrentAttribute(character.id, 'pathID');
  const situationalMod = MML.getCurrentAttributeAsFloat(character.id, 'situationalMod');
  const meleeDefenseMod = MML.getCurrentAttributeAsFloat(character.id, 'meleeDefenseMod');
  const missileDefenseMod = MML.getCurrentAttributeAsFloat(character.id, 'missileDefenseMod');
  const meleeAttackMod = MML.getCurrentAttributeAsFloat(character.id, 'meleeAttackMod');
  const missileAttackMod = MML.getCurrentAttributeAsFloat(character.id, 'missileAttackMod');
  const castingMod = MML.getCurrentAttributeAsFloat(character.id, 'castingMod');
  const statureCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'statureCheckMod');
  const strengthCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'strengthCheckMod');
  const coordinationCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'coordinationCheckMod');
  const healthCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'healthCheckMod');
  const beautyCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'beautyCheckMod');
  const intellectCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'intellectCheckMod');
  const reasonCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'reasonCheckMod');
  const creativityCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'creativityCheckMod');
  const presenceCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'presenceCheckMod');
  const willpowerCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'willpowerCheckMod');
  const evocationCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'evocationCheckMod');
  const perceptionCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'perceptionCheckMod');
  const systemStrengthCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'systemStrengthCheckMod');
  const fitnessCheckMod = MML.getCurrentAttributeAsFloat(character.id, 'fitnessCheckMod');
  const statusEffects = MML.getCurrentAttributeObject(character.id, 'statusEffects');
  const initiativeRollValue = MML.getCurrentAttributeAsFloat(character.id, 'initiativeRollValue');
  const situationalInitBonus = MML.getCurrentAttributeAsFloat(character.id, 'situationalInitBonus');
  const actionInitCostMod = MML.getCurrentAttributeAsFloat(character.id, 'actionInitCostMod');
  const hp = game_state.pipe(
      filter(effect => effect.attribute === 'hp'), 
      scan(function (current, effect) {
        current[effect.body_part] += effect.change;
        return current;
      }, _.isUndefined(getAttrByName(character.id, 'hp', 'current')) ? MML.buildHpAttribute(character) : MML.getCurrentAttributeObject(id, 'hp')),
      startWith()
    );
  // #endregion

  // #region Saves
  const major_wound_save = Rx.combineLatest(hpMax, hp.pipe(pairwise())).pipe(
    filter(function ([max, [previous, current]]) {
      return Object.keys(max).reduce(function (save_needed, body_part) {
        const half_max = Math.round(max[body_part] / 2);
        const current_hp = current[body_part];
        if (current_hp < half_max && current_hp >= 0) { //Major wound
          if (initialHP >= half_max) { //Fresh wound
            duration = half_max - current_hp;
          } else if (!_.has(character.statusEffects, 'Major Wound, ' + bodyPart)) {
            duration = -hpAmount;
          } else { //Add damage to duration of effect
            duration = parseInt(character.statusEffects['Major Wound, ' + bodyPart].duration) - hpAmount;
          }
          await MML.displayMenu(player, character.name + '\'s Major Wound Roll', ['Roll']);
          const result = await MML.attributeCheckRoll(player, character.willpower);
          if (result === 'Failure') {
            MML.addStatusEffect(character, 'Major Wound, ' + bodyPart, {
              duration: duration,
              startingRound: state.MML.GM.currentRound,
              bodyPart: bodyPart
            });
          }
        }
        return save_needed;
      }, false)
    }),
    concatMap(MML.attributeCheckRoll)
  )
  // #endregion

  // #region Initaitive Attributes
  const attributeInitBonus = MML.derivedAttribute('attributeInitBonus', function (strength, coordination, reason, perception) {
    const rankingAttribute = [strength, coordination, reason, perception].sort((a, b) => a - b)[0];

    if (rankingAttribute < 10) {
      return -1;
    } else if (rankingAttribute === 10 || rankingAttribute === 11) {
      return 0;
    } else if (rankingAttribute === 12 || rankingAttribute === 13) {
      return 1;
    } else if (rankingAttribute === 14 || rankingAttribute === 15) {
      return 2;
    } else if (rankingAttribute === 16 || rankingAttribute === 17) {
      return 3;
    } else if (rankingAttribute === 18 || rankingAttribute === 19) {
      return 4;
    } else {
      return 5;
    }
  }, strength, coordination, reason, perception);

  const movementRatioInitBonus = MML.derivedAttribute('movementRatioInitBonus', function (movementRatio) {
    if (movementRatio < 0.6) {
      return 'No Combat';
    } else if (movementRatio === 0.6) {
      return -4;
    } else if (movementRatio < 0.7 && movementRatio <= 0.8) {
      return -3;
    } else if (movementRatio > 0.8 && movementRatio <= 1.0) {
      return -2;
    } else if (movementRatio > 1.0 && movementRatio <= 1.2) {
      return -1;
    } else if (movementRatio > 1.2 && movementRatio <= 1.4) {
      return 0;
    } else if (movementRatio > 1.4 && movementRatio <= 1.7) {
      return 1;
    } else if (movementRatio > 1.7 && movementRatio <= 2.0) {
      return 2;
    } else if (movementRatio > 2.0 && movementRatio <= 2.5) {
      return 3;
    } else if (movementRatio > 2.5 && movementRatio <= 3.2) {
      return 4;
    } else(movementRatio > 3.2) {
      return 5;
    }
  }, movementRatio);

  const initiative = MML.derivedAttribute('initiative', function (initiativeRollValue, situationalInitBonus, movementRatioInitBonus, attributeInitBonus, senseInitBonus, fomInitBonus, firstActionInitBonus, spentInitiative) {
    if ([situationalInitBonus, movementRatioInitBonus].includes('No Combat')) {
      return 0;
    }

    const initiative = initiativeRollValue +
      situationalInitBonus +
      movementRatioInitBonus +
      attributeInitBonus +
      senseInitBonus +
      fomInitBonus +
      firstActionInitBonus +
      spentInitiative;

    return initiative < 0 || state.MML.GM.roundStarted === false ? 0 : initiative;
  }, initiativeRollValue, situationalInitBonus, movementRatioInitBonus, attributeInitBonus, senseInitBonus, fomInitBonus, firstActionInitBonus, spentInitiative);

  const senseInitBonus = MML.derivedAttribute('senseInitBonus', function (inventory) {
    var bitsOfHelm = [
      'Barbute Helm',
      'Bascinet Helm',
      'Camail',
      'Camail-Conical',
      'Cap',
      'Cheeks',
      'Conical Helm',
      'Duerne Helm',
      'Dwarven War Hood',
      'Face Plate',
      'Great Helm',
      'Half-Face Plate',
      'Hood',
      'Nose Guard',
      'Pot Helm',
      'Sallet Helm',
      'Throat Guard',
      'War Hat'
    ];
    var senseArray = _.filter(inventory, item => item.type === 'armor' && bitsOfHelm.includes(item.name));

    if (senseArray.length === 0) {
      //nothing on head
      return 4;
    } else {
      if (senseArray.includes('Great Helm') || (senseArray.includes('Sallet Helm') && senseArray.includes('Throat Guard'))) {
        //Head fully encased in metal
        return -2;
      } else if (_.intersection(senseArray, ['Barbute Helm',
          'Sallet Helm',
          'Bascinet Helm', 'Duerne Helm', 'Cap', 'Pot Helm', 'Conical Helm', 'War Hat'
        ]).length > 0) {
        //wearing a helm
        if (senseArray.includes('Face Plate')) {
          //Has faceplate
          if (_.intersection(senseArray, ['Barbute Helm', 'Bascinet Helm', 'Duerne Helm']).length > 0) {
            //Enclosed Sides
            return -2;
          } else {
            return -1;
          }
        } else if (_.intersection(senseArray, ['Barbute Helm', 'Sallet Helm', 'Bascinet Helm', 'Duerne Helm', 'Half-Face Plate']).length > 0) {
          //These types of helms or half face plate
          return 0;
        } else if (_.intersection(senseArray, ['Camail', 'Camail-Conical', 'Cheeks']).length > 0) {
          //has camail or cheeks
          return 1;
        } else if (_.intersection(senseArray, ['Dwarven War Hood', 'Hood']).length > 0) {
          //Wearing a hood
          return senseArray.reduce(function (min, piece) {
            if ((piece.name === 'Dwarven War Hood' || piece.name === 'Hood') && piece.family !== 'Cloth') {
              return 1;
            }
            return min;
          }, 2);
        } else if (senseArray.includes('Nose Guard')) {
          //has nose guard
          return 2;
        } else {
          // just a cap
          return 3;
        }
      } else if (_.intersection(senseArray, ['Dwarven War Hood', 'Hood']).length > 0) {
        //Wearing a hood
        return senseArray.reduce(function (min, piece) {
          if ((piece.name === 'Dwarven War Hood' || piece.name === 'Hood') && piece.family !== 'Cloth') {
            return 1;
          }
          return min;
        }, 2);
      }
    }
  });

  const fomInitBonus = MML.getCurrentAttributeAsFloat(character.id, 'fomInitBonus');
  const firstActionInitBonus = MML.getCurrentAttributeAsFloat(character.id, 'firstActionInitBonus');
  const spentInitiative = MML.getCurrentAttributeAsFloat(character.id, 'spentInitiative');

  // #endregion

  const actionTempo = action.pipe(
    withLatestFrom(isDualWielding),
    map(function ([action, isDualWielding]) {
      var tempo;

      if (_.isUndefined(action.skill) || action.skill < 30) {
        tempo = 0;
      } else if (action.skill < 40) {
        tempo = 1;
      } else if (action.skill < 50) {
        tempo = 2;
      } else if (action.skill < 60) {
        tempo = 3;
      } else if (action.skill < 70) {
        tempo = 4;
      } else {
        tempo = 5;
      }

      // If Dual Wielding
      if (action.name === 'Attack' && isDualWielding) {
        var twfSkill = weaponskills['Two Weapon Fighting'].level;
        if (twfSkill > 19 && twfSkill) {
          tempo += 1;
        } else if (twfSkill >= 40 && twfSkill < 60) {
          tempo += 2;
        } else if (twfSkill >= 60) {
          tempo += 3;
        }
        // If Dual Wielding identical weapons
        if (inventory[leftHand._id].name === inventory[rightHand._id].name) {
          tempo += 1;
        }
      }
      return MML.attackTempoTable[tempo];
    }));

  const newRoundUpdate = MML.newRound.pipe(map(function (character) {
    if (_.has(character.statusEffects, 'Melee This Round')) {
      var fatigueRate = 1;
      if (_.has(character.statusEffects, 'Pinned')) {
        fatigueRate = 2;
      }
      character.roundsExertion += fatigueRate;
      character.roundsRest = 0;

      if (!_.has(character.statusEffects, 'Fatigue')) {
        if (character.roundsExertion > character.fitness) {
          await MML.fatigueCheck(player, character);
        }
      } else {
        if (character.roundsExertion > Math.round(character.fitness / 2)) {
          await MML.fatigueCheck(player, character);
        }
      }
    } else if (_.has(character.statusEffects, 'Fatigue') || character.roundsExertion > 0) {
      character.roundsRest++;
      if (character.roundsRest > 5) {
        await MML.fatigueRecovery(player, character);
      }
    }

    // Reset knockdown number
    character.knockdown = character.knockdownMax;
    character.spentInitiative = 0;

    character.action = {
      ts: _.isUndefined(character.previousAction) ? Date.now() : character.previousAction.ts,
      modifiers: [],
      weapon: MML.getEquippedWeapon(character)
    };
    if (_.has(character.statusEffects, 'Observing')) {
      MML.addStatusEffect(character, 'Observed', {
        startingRound: state.MML.GM.currentRound
      });
    }
    return character;
  }));

  const character_moved = MML.character_moved.pipe(filter(character => character.id === id));

  const character_movement_blocked = character_moved.pipe(

  );

  MML.combat_movement = MML.token_moved.pipe(map(function (obj, prev) {
    const character = MML.characters[MML.getCharacterIdFromToken(obj)];
    const left1 = prev['left'];
    const left2 = obj.get('left');
    const top1 = prev['top'];
    const top2 = obj.get('top');
    const distance = MML.getDistanceFeet(left1, left2, top1, top2);
    const distanceAvailable = MML.movementRates[character.race][character.movementType] * character.movementAvailable;

    if (state.MML.GM.actor === charName && distanceAvailable > 0) {
      // If they move too far, move the maxium distance in the same direction
      if (distance > distanceAvailable) {
        const left3 = Math.floor(((left2 - left1) / distance) * distanceAvailable + left1 + 0.5);
        const top3 = Math.floor(((top2 - top1) / distance) * distanceAvailable + top1 + 0.5);
        obj.set('left', left3);
        obj.set('top', top3);
        character.movementAvailable(0);
      }
      character.moveDistance(distance);
    } else {
      obj.set('left', prev['left']);
      obj.set('top', prev['top']);
    }
  }));

  const ready = Rx.merge(
      MML.new_round.pipe(mapTo(false)),
      action.pipe(mapTo(true)),
      MML.end_combat
    )
    .pipe(
      tap(function (is_ready) {
        const token = MML.getCharacterToken(id);
        if (!_.isUndefined(token)) {
          token.set('tint_color', is_ready ? 'transparent' : 'FF0000');
        }
      })
    );

  const action = function setAction(character, action) {
    var initBonus = 10;
    if (action.name === 'Attack' || action.name === 'Aim') {
      if (MML.isUnarmedAction(action) || action.weapon === 'unarmed') {
        if (!_.isUndefined(character.weaponSkills['Brawling']) && character.weaponSkills['Brawling'].level > character.weaponSkills['Default Martial'].level) {
          action.skill = character.weaponSkills['Brawling'].level;
        } else {
          action.skill = character.weaponSkills['Default Martial'].level;
        }
        // } else if (leftHand !== 'unarmed' && rightHand !== 'unarmed') {
        //   var weaponInits = [character.inventory[character.leftHand._id].grips[character.leftHand.grip].initiative,
        //     character.inventory[character.rightHand._id].grips[character.rightHand.grip].initiative
        //   ];
        //   initBonus = _.min(weaponInits);
        // action.skill = character.weaponSkills.[character.inventory[character.leftHand._id].name].level or character.weaponSkills['Default Martial Skill'].level;
        //Dual Wielding
      } else {
        initBonus = action.weapon.initiative;
        action.skill = MML.getWeaponSkill(character, action.weapon);
      }
    } else if (action.name === 'Cast') {
      var skillInfo = MML.getMagicSkill(character, action.spell);
      action.skill = skillInfo.level;
      action.skillName = skillInfo.name;
    }
    if (state.MML.GM.roundStarted === false) {
      character.firstActionInitBonus = initBonus;
    }

    if (_.isUndefined(character.previousAction) || character.previousAction.ts !== action.ts) {
      _.each(action.modifiers, function (modifier) {
        MML.addStatusEffect(character, modifier, {
          ts: action.ts,
          startingRound: state.MML.GM.currentRound
        });
      });
    }
    character.action = action;
  };
  const previousAction = MML.getCurrentAttributeObject(character.id, 'previousAction');
  const roundsRest = MML.getCurrentAttributeAsFloat(character.id, 'roundsRest');
  const roundsExertion = MML.getCurrentAttributeAsFloat(character.id, 'roundsExertion');

  const attributeCastingMod = MML.derivedAttribute('attributeCastingMod', function (reason, fomInitBonus, senseInitBonus) {
    var attributeCastingMod = MML.attributeMods.reason[reason];

    if (senseInitBonus < 2 && senseInitBonus > 0) {
      attributeCastingMod -= 10;
    } else if (senseInitBonus > -2) {
      attributeCastingMod -= 20;
    } else {
      attributeCastingMod -= 30;
    }

    if (fomInitBonus === 3 || fomInitBonus === 2) {
      attributeCastingMod -= 5;
    } else if (fomInitBonus === 1) {
      attributeCastingMod -= 10;
    } else if (fomInitBonus === 0) {
      attributeCastingMod -= 15;
    } else if (fomInitBonus === -1) {
      attributeCastingMod -= 20;
    } else if (fomInitBonus === -2) {
      attributeCastingMod -= 30;
    }
    return attributeCastingMod;
  }, reason, fomInitBonus, senseInitBonus);

  const add_attribute = Rx.add_attribute.pipe(filter(attribute => attribute.get('_characterid') === id))
  const skills = add_attribute.pipe(filter(attribute => attribute.get('name').includes('repeating_skills')));
  const weapon_skills = add_attribute.pipe(filter(attribute => attribute.get('name').includes('repeating_weaponskills')));
  const skills =
    function () {
      var characterSkills = MML.getSkillAttributes(character.id, 'skills');
      _.each(
        characterSkills,
        function (characterSkill, skillName) {
          var level = characterSkill.input;
          var attribute = MML.skills[skillName].attribute;

          level += MML.attributeMods[attribute][character[attribute]];

          if (_.isUndefined(MML.skillMods[race]) === false && _.isUndefined(MML.skillMods[race][skillName]) === false) {
            level += MML.skillMods[race][skillName];
          }
          if (_.isUndefined(MML.skillMods[character.gender]) === false && _.isUndefined(MML.skillMods[character.gender][skillName]) === false) {
            level += MML.skillMods[character.gender][skillName];
          }
          characterSkill.level = level;
          MML.setCurrentAttribute(character.id, 'repeating_skills_' + characterSkill._id + '_name', skillName);
          MML.setCurrentAttribute(character.id, 'repeating_skills_' + characterSkill._id + '_input', characterSkill.input);
          MML.setCurrentAttribute(character.id, 'repeating_skills_' + characterSkill._id + '_level', level);
        },
        character
      );

      return characterSkills;
    },

    const weaponSkills =
      function () {
        var characterSkills = MML.getSkillAttributes(character.id, "weaponskills");
        var highestSkill;

        _.each(
          characterSkills,
          function (characterSkill, skillName) {
            var level = characterSkill.input;

            // This may need to include other modifiers
            if (_.isUndefined(MML.weaponSkillMods[race]) === false && _.isUndefined(MML.weaponSkillMods[race][skillName]) === false) {
              level += MML.weaponSkillMods[race][skillName];
            }
            characterSkill.level = level;
          },
          character
        );

        highestSkill = _.max(characterSkills, skill => skill.level).level;
        if (isNaN(highestSkill)) {
          highestSkill = 0;
        }

        if (_.isUndefined(characterSkills["Default Martial"])) {
          characterSkills["Default Martial"] = {
            input: 0,
            level: 0,
            _id: MML.generateRowID()
          };
        }

        if (highestSkill < 20) {
          characterSkills["Default Martial"].level = 1;
        } else {
          characterSkills["Default Martial"].level = Math.round(highestSkill / 2);
        }

        _.each(
          characterSkills,
          function (characterSkill, skillName) {
            MML.setCurrentAttribute(character.id, "repeating_weaponskills_" + characterSkill._id + "_name", skillName);
            MML.setCurrentAttribute(character.id, "repeating_weaponskills_" + characterSkill._id + "_input", characterSkill.input);
            MML.setCurrentAttribute(character.id, "repeating_weaponskills_" + characterSkill._id + "_level", characterSkill.level);
          },
          character
        );
        return characterSkills;
      },

      const fov = MML.derivedAttribute('fov', function (senseInitBonus) {
        switch (senseInitBonus) {
          case 4:
            return 180;
          case 3:
            return 170;
          case 2:
            return 160;
          case 1:
            return 150;
          case 0:
            return 140;
          case -1:
            return 130;
          case -2:
            return 120;
          default:
            return 180;
        }
      }, senseInitBonus);

  const getShieldDefenseBonus(character) {
    const rightHand = character.inventory[character.rightHand._id];
    const leftHand = character.inventory[character.leftHand._id];

    if (!_.isUndefined(rightHand) && rightHand.type === 'shield') {
      return rightHand.defenseMod;
    } else if (!_.isUndefined(leftHand) && leftHand.type === 'shield' && leftHand.defenseMod > rightHand.defenseMod) {
      return leftHand.defenseMod;
    } else {
      return 0;
    }
  };

  const getWeaponGrip(character) {
    if (character['rightHand'].grip !== 'unarmed') {
      return character['rightHand'].grip;
    } else if (character['leftHand'].grip !== 'unarmed') {
      return character['leftHand'].grip;
    } else {
      return 'unarmed';
    }
  };

  const getEquippedWeapon(character) {
    const grip = MML.getWeaponGrip(character);
    var weapon;
    var item;
    var itemId;

    if (MML.isUnarmed(character)) {
      return 'unarmed';
    } else if (character['rightHand'].grip !== 'unarmed') {
      itemId = character.rightHand._id;
      item = character.inventory[itemId];
    } else {
      itemId = character.leftHand._id;
      item = character.inventory[itemId];
    }
    return MML.buildWeaponObject(item, grip);
  };

  const buildWeaponObject(item, grip) {
    var weapon = {
      _id: item._id,
      name: item.name,
      type: 'weapon',
      weight: item.weight,
      family: item.grips[grip].family,
      hands: item.grips[grip].hands
    };

    if (['MWD', 'MWM', 'TWH', 'TWK', 'TWS', 'SLI'].includes(weapon.family)) {
      _.extend(weapon, item.grips[grip]);
      if (weapon.family === 'MWM') {
        weapon.loaded = item.loaded;
      }
    } else {
      _.extend(weapon, {
        defense: item.grips[grip].defense,
        initiative: item.grips[grip].initiative,
        rank: item.grips[grip].rank,
        primaryType: item.grips[grip].primaryType,
        primaryTask: item.grips[grip].primaryTask,
        primaryDamage: item.grips[grip].primaryDamage,
        secondaryType: item.grips[grip].secondaryType,
        secondaryTask: item.grips[grip].secondaryTask,
        secondaryDamage: item.grips[grip].secondaryDamage
      });
    }
    return weapon;
  };

  const getWeaponAndSkill(character) {
    var itemId;
    var grip;

    if (MML.getWeaponFamily(character, 'rightHand') !== 'unarmed') {
      itemId = character.rightHand._id;
      grip = character.rightHand.grip;
    } else {
      itemId = character.leftHand._id;
      grip = character.leftHand.grip;
    }
    var item = character.inventory[itemId];
    var characterWeapon = MML.buildWeaponObject(item, grip);

    if (!MML.isRangedWeapon(characterWeapon)) {
      if (character.action.attackType === 'secondary') {
        characterWeapon.damageType = item.grips[grip].secondaryType;
        characterWeapon.task = item.grips[grip].secondaryTask;
        characterWeapon.damage = item.grips[grip].secondaryDamage;
      } else {
        characterWeapon.damageType = item.grips[grip].primaryType;
        characterWeapon.task = item.grips[grip].primaryTask;
        characterWeapon.damage = item.grips[grip].primaryDamage;
      }
    }

    return {
      characterWeapon: characterWeapon,
      skill: MML.getWeaponSkill(character, item)
    };
  };

  const getWeaponSkill(character, weapon) {
    var item = weapon;
    var skill;

    if (item.type !== 'weapon') {
      log('Not a weapon');
      MML.error();
    }

    const grip = MML.getWeaponGrip(character);
    const skillName = item.name + ['War Spear', 'Boar Spear', 'Military Fork', 'Bastard Sword'].includes(item.name) ? ', ' + grip : '';

    if (_.has(character.weaponSkills, skillName)) {
      return character.weaponSkills[skillName].level;
    } else {
      var relatedSkills = [];
      _.each(character.weaponSkills, function (relatedSkill, skillName) {
        if (skillName !== 'Default Martial') {
          _.each(MML.items[skillName.replace(', ' + grip, '')].grips, function (skillFamily) {
            if (skillFamily.family === item.grips[grip].family) {
              relatedSkills.push(relatedSkill);
            }
          });
        }
      }, character);

      if (relatedSkills.length === 0) {
        return character.weaponSkills['Default Martial'].level;
      } else {
        return _.max(relatedSkills, function (skill) {
          return skill.level;
        }).level - 10;
      }
    }
  };

  const graspers = bodyType.pipe(map(function (type) {
    switch (type) {
      case 'humanoid':
        return ['Left', 'Right'];
      default:
        return [];
    }
  }));

  const wielded_weapon_families = function isWieldingWeaponFamily(character, families) {
    return families.includes(getWeaponFamily(character, 'rightHand')) || rangedFamilies.includes(getWeaponFamily(character, 'leftHand'));
  };

  const getWeaponFamily(character, hand) {
    const item = character.inventory[character[hand]._id];
    if (!_.isUndefined(item) && item.type === 'weapon') {
      return item.grips[character[hand].grip].family;
    } else {
      return 'unarmed';
    }
  };

  const isWieldingRangedWeapon = function isWieldingRangedWeapon(character) {
    return isWieldingMissileWeapon(character) || isWieldingThrowingWeapon(character);
  };

  const isWieldingMissileWeapon = function isWieldingMissileWeapon(character) {
    return isWieldingWeaponFamily(character, ['MWD', 'MWM']);
  };

  const isWieldingThrowingWeapon = function isWieldingThrowingWeapon(character) {
    return isWieldingWeaponFamily(character, ['TWH', 'TWK', 'TWS', 'SLI']);
  };

  const isRangedWeapon = function isRangedWeapon(weapon) {
    return ['MWD', 'MWM', 'TWH', 'TWK', 'TWS', 'SLI'].includes(weapon.family);
  };

  const isUnarmed = function isUnarmed(character) {
    return getWeaponFamily(character, 'leftHand') === 'unarmed' && getWeaponFamily(character, 'rightHand') === 'unarmed';
  };

  const isDualWielding = Rx.zip(left_hand, right_hand).pipe(map(function (character) {
    const leftHand = getWeaponFamily(character, 'leftHand');
    const rightHand = getWeaponFamily(character, 'rightHand');
    return character.leftHand._id !== character.rightHand._id && leftHand !== 'unarmed' && rightHand !== 'unarmed';
  }));

  return character;
};
