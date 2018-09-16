MML.GM = function GM(roll20_player_object) {
  const gm = this;
  gm.id = roll20_player_object.get('id');
  gm.name = roll20_player_object.get('name');
  gm.characters = MML.characters.pipe(
    mergeMap(character => Rx.combineLatest(character.gm)),
    filter(),
    scan(function (list, character) {
      list[character.id] = character;
      return character;
    })
  );

  const button_pressed = MML.button_pressed.pipe(filter(message => gm.name === message.who));

  const router = button_pressed.pipe(
    scan(function (path, next) {
      path.push(next);
      return path;
    }, [])
  );

  const main_menu = MML.in_combat.pipe(
    switchMap(combat => combat ? Rx.never() : router.pipe(filter(path => path.length === 0)))
  );
};

// MML.game_state = MML.players.pipe();

// MML.gm_created_effects = MML.menuIdle.pipe(
  
// );

// MML.statusEffects = Rx.merge(
//   MML.action_results,
//   MML.gm_created_effects
// );


// MML.startCombat = function startCombat(selectedIds) {
//   var gm = state.MML.GM;
//   gm.inCombat = true;
//   const allCombatants = selectedIds.map(id => MML.characters[id]);
//   _.each(MML.players, function(player) {
//     player.combatants = player.characters.filter(character => selectedIds.includes(character.id));
//   });
//   _.each(allCombatants, function(character) {
//     MML.setReady(character, false);
//     MML.setCombatVision(character);
//   });
//   const sortedCombatants = MML.setTurnOrder(allCombatants);
//   return MML.newRound(gm, 0, sortedCombatants);
// };

// Rx.merge(
//   MML.startCombat.pipe(mapTo('true')),
//   MML.endCombat.pipe(mapTo('false'))
// )
// .subscribe(show => Campaign().set('initiativepage', show));

// MML.newRound = Rx.merge(MML.startCombat).pipe(

// );

async function newRound(gm, currentRound, combatants) {
  try {
    gm.roundStarted = false;
    const updatedCombatants = await Promise.all(combatants.map(character => MML.newRoundUpdate(character)));
    const actions = await Promise.all(_.values(MML.players).map(player => MML.prepareCharacters(player)));
    return await MML.startRound(gm, currentRound, actions);
  } catch (err) {
    log(err.stack)
  }
};

MML.startRound = async function startRound(gm, currentRound, actions) {
  const {pressedButton} = await MML.displayMenu(gm.player, 'Start round when all characters are ready.', ['Start Round', 'End Combat']);
  if (pressedButton === 'Start Round') {
    if (MML.checkReady(gm.allCombatants)) {
      gm.roundStarted = true;
      _.each(gm.allCombatants, function(character) {
        character.movementAvailable = character.movementRatio;
      });
      return await MML.nextAction(gm, currentRound, actions);
    } else {
      sendChat('Error', 'Not All Characters Are Ready');
      return await MML.startRound(gm);
    }
  } else {
    return MML.endCombat(gm);
  }
};

MML.endCombat = function endCombat(gm) {
  if (gm.allCombatants.length > 0) {
    _.each(gm.allCombatants, function(character) {
      MML.setReady(character, true);
      MML.setCombatVision(character);
    });
    gm.inCombat = false;
    gm.allCombatants = [];
  }
};

MML.nextAction = async function nextAction(gm, currentRound, combatants) {
  const sortedCombatants = MML.setTurnOrder(combatants);
  if (MML.checkReady(sortedCombatants)) {
    const character = sortedCombatants[0];
    if (character.initiative > 0) {
      gm.actor = character.id;
      await MML.startAction(character.player, character, MML.validateAction(character));
      return await MML.nextAction(gm, currentRound, sortedCombatants);
    } else {
      return MML.newRound(gm);
    }
  }
};

MML.checkReady = function checkReady(combatants) {
  return _.every(combatants, function (character) {
    return character.ready;
  });
};

MML.displayThreatZones = function displayThreatZones(toggle) {
  _.each(state.MML.GM.allCombatants, function(character) {
    var token = MML.getCharacterToken(character.id);
    var radius1 = '';
    var radius2 = '';
    var color1 = '#FF0000';
    var color2 = '#FFFF00';
    if (toggle && !MML.isWieldingRangedWeapon(character) && !MML.isUnarmed(character)) {
      var weapon = MML.getEquippedWeapon(character);
      radius1 = MML.weaponRanks[weapon.rank].high;
      radius2 = MML.weaponRanks[weapon.rank + 1].high;
    }
    MML.displayAura(token, radius1, 1, color1);
    MML.displayAura(token, radius2, 2, color2);
  });
};

MML.setTurnOrder = function setTurnOrder(combatants) {
  combatants.sort((character_a, character_b) => character_b.initiative - character_a.initiative);
  const turnorder = combatants.map(function (character) {
    return {
      id: MML.getCharacterToken(character.id).id,
      pr: character.initiative,
      custom: ''
    };
  });
  Campaign().set('turnorder', JSON.stringify(turnorder));
  return combatants;
};

MML.assignNewItem = function assignNewItem(input) {
  MML.processCommand({
    type: 'character',
    who: input.target,
    callback: 'setApiCharAttributeJSON',
    input: {
      attribute: 'inventory',
      index: MML.generateRowID(),
      value: state.MML.GM.newItem
    }
  });
  MML.processCommand({
    type: 'player',
    who: MML.characters[input.target].player,
    callback: 'sendChatMenu',
    input: {}
  });
};
