MML.displayMenu = function displayMenu(player, message, buttons) {
  var toChat = '/w "' + player.name +
    '" &{template:charMenu} {{name=' + message + '}} ' +
    buttons.map(function(button) {
      return '{{' + button.replace(/\s+/g, '') + '=[' + button + '](!MML|' + button + ')}}';
    }).join(' ');

  sendChat(player.name, toChat, null, {
    noarchive: true
  });
  return player;
};

MML.setMenuButtons = function setMenuButtons(player, buttons) {
  return new Promise(function(resolve, reject) {
    player.buttonPressed = function(pressedButton, selectedIds) {
      if (_.contains(buttons, pressedButton)) {
        resolve({pressedButton, selectedIds});
      }
    };
  });
};

// IDEA-R: build an array of previous menus as an optional parameter to allow for backtracking
MML.goToMenu = function goToMenu(player, message, buttons) {
  MML.displayMenu(player, message, buttons);
  return MML.setMenuButtons(player, buttons);
};

MML.initializeMenu = async function initializeMenu(player) {
  await MML.setMenuButtons(player, ['initializeMenu']);
  if (player.name === state.MML.GM.name) {
    return await MML.menuMainGm(player);
  } else {
    return await MML.menuMainPlayer(player);
  }
};

MML.menuMainGm = async function menuMainGm(player) {
  const {pressedButton} = await MML.goToMenu(player, 'Main Menu: ', ['Combat', 'Roll Dice'])
  switch (pressedButton) {
    case 'Combat':
      return await MML.menuGmCombat(player);
    case 'Roll Dice':
      return await MML.menuselectDieSize(player);
  }
};


MML.menuGmCombat = async function menuGmCombat(player) {
  try {
    const message = 'Select tokens and begin.';
    const buttons = ['Start Combat', 'Back'];
    const {pressedButton, selectedIds} = await MML.goToMenu(player, message, buttons);
    switch (pressedButton) {
      case 'Start Combat':
        if (selectedIds.length > 0) {
          return MML.startCombat(selectedIds);
        } else {
          sendChat('', '&{template:charMenu} {{name=Error}} {{message=No tokens selected}}');
          return MML.goToMenu(player, MML.menuGmCombat(player));
        }
      case 'Back':
        return MML.menuMainGm(player);
    }
  } catch (e) {
    console.log(e);
  }
};

MML.menuChooseMeleeDefense = function menuChooseMeleeDefense(character, dodgeMods, blockMods, attackerWeapon) {
  var message = 'How will ' + character.name + ' defend?';
  var buttons = ['Dodge: ' + MML.sumModifiers(dodgeMods) + '%', 'Take it'];
  if (!MML.isUnarmed(character) || attackerWeapon.family === "Unarmed") {
    buttons.unshift('Block: ' + MML.sumModifiers(blockMods) + '%');
  }
  return {
    message: message,
    buttons: buttons
  };
};

MML.menuassignStatusEffect = function menuassignStatusEffect(player, character) {
  var message = 'Choose a Status Effect: ';
  var buttons = [];

  _.each(MML.statusEffects, function(effect, effectName) {
    buttons.push(effectName);
  });
  return {message: message, buttons: buttons};
};

MML.menuchooseSpell = function menuchooseSpell(player, character, action) {
  var message = 'Choose a spell';
  var buttons = [];
  _.each(character.spells, function(spellName) {
    if (_.isUndefined(MML.spells[spellName].requiredItem) ||
      (_.isUndefined(action.items) &&
        (character.inventory[character.rightHand._id].name === MML.spells[spellName].requiredItem || character.inventory[character.leftHand._id].name === MML.spells[spellName].requiredItem)) ||
      (!_.isUndefined(action.items) &&
        _.filter(action.items, function(item) {
          return character.inventory[item.itemId].name === MML.spells[spellName].requiredItem;
        }, character).length > 0)
    ) {
      buttons.push(spellName);
    }
  });
  return {message: message, buttons: buttons};
};

MML.menuchooseMetaMagicInitiative = function menuchooseMetaMagicInitiative(player, character, action) {
  var message = 'Choose meta magic';
  var buttons = ['Next Menu'];

  if (_.contains(action.spell.metaMagic, 'Called Shot')) {
    if (_.contains(action.modifiers, 'Called Shot')) {
      buttons.push('Remove Called Shot');
    } else {
      buttons.push('Called Shot');
    }

    if (_.contains(action.modifiers, 'Called Shot Specific')) {
      buttons.push('Remove Called Shot Specific');
    } else {
      buttons.push('Called Shot Specific');
    }
  }

  if (_.contains(action.modifiers, 'Ease Spell')) {
    buttons.push('Remove Ease Spell');
  } else {
    buttons.push('Ease Spell');
  }

  if (_.contains(action.modifiers, 'Ease Spell')) {
    buttons.push('Remove Hasten Spell');
  } else {
    buttons.push('Hasten Spell');
  }
  return {message: message, buttons: buttons};
};

MML.menuchooseMetaMagic = function menuchooseMetaMagic(action) {
  var message = 'Choose meta magic';
  var buttons = ['Cast Spell'];

  _.each(_.without(action.spell.metaMagic, 'Called Shot', 'Called Shot Specific'), function(metaMagicName) {
    if (_.contains(action.modifiers, metaMagicName)) {
      buttons.push('Remove ' + metaMagicName);
    } else {
      buttons.push(metaMagicName);
    }
  });
  return {message: message, buttons: buttons};
};

MML.menucombatMovement = function menucombatMovement(player, character) {
  var message = 'Move ' + character.name + '.';
  var buttons = ['Prone', 'Stalk', 'Crawl', 'Walk', 'Jog', 'Run', 'End Movement'];
  return {
    message: message,
    buttons: buttons
  };
};

MML.menufinalizeAction = function menufinalizeAction(player, character, action) {
  var message;
  var buttons;
  if (state.MML.GM.roundStarted === true) {
    message = 'Accept or edit action for ' + character.name;
    buttons = [
      'Accept',
      'Edit Action'
    ];
  } else if (_.has(character.statusEffects, 'Stunned')) {
    message = character.name + ' is stunned and can only move. Roll initiative';
    buttons = [
      'Roll'
    ];
  } else {
    message = 'Roll initiative or edit action for ' + character.name;
    buttons = [
      'Roll',
      'Edit Action'
    ];
  }
  return {
    message: message,
    buttons: buttons
  };
};

MML.menustartAction = function menustartAction(player, character, validAction) {
  var message;
  var buttons = ['Movement Only'];
  if (_.has(character.statusEffects, 'Stunned') || _.has(character.statusEffects, 'Dodged This Round')) {
    message = character.name + ' cannot act.';
  } else if (validAction) {
    if (character.initiative - 10 > 0) {
      message = 'Start or change ' + character.name + '\'s action';
      buttons.unshift('Change Action');
      buttons.unshift('Start Action');
    } else {
      message = 'Start ' + character.name + '\'s action';
      buttons.unshift('Start Action');
    }
  } else {
    message = character.name + '\'s action no longer valid.';
    if (character.initiative - 10 > 0) {
      buttons.unshift('Change Action');
    }
  }
  return {
    message: message,
    buttons: buttons
  };
};
