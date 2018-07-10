MML.init = function () {
  state.MML = {};
  state.MML.GM = {
    player: new MML.Player('Robot', true),
    name: 'Robot',
    currentAction: {},
    inCombat: false,
    currentRound: 0,
    roundStarted: false
  };
  const playerObjects = findObjs({ _type: 'player', online: true });
  MML.players = {};
  MML.players[state.MML.GM.name] = state.MML.GM.player;

  _.each(playerObjects, function (player) {
    if (player.get('displayname') !== state.MML.GM.name) {
      MML.players[player.get('displayname')] = new MML.Player(player.get('displayname'), false);
    }
  });

  const characterObjects = findObjs({_type: 'character', archived: false});

  MML.characters = characterObjects.reduce(function (characters, characterObject) {
    const id = characterObject.id;
    const character = MML.createCharacter(id);
    MML.setPlayer(character);
    characters[id] = character;
    return characters;
  }, {});

  MML.initializeMenu(state.MML.GM.player);

  MML.newCharacter = Rx.create(function (observer) {

  });

  on('add:character', function (character) {
    const id = character.get('id');
    const name = character.get('name');

    MML.createAttribute('id', id, '', character);
    MML.createAttribute('player', state.MML.GM.player.name, '', character);
    MML.createAttribute('name', name, '', character);
    MML.createAttribute('race', 'Human', '', character);
    MML.createAttribute('gender', 'Male', '', character);
    MML.createAttribute('statureRoll', 6, '', character);
    MML.createAttribute('strengthRoll', 6, '', character);
    MML.createAttribute('coordinationRoll', 6, '', character);
    MML.createAttribute('healthRoll', 6, '', character);
    MML.createAttribute('beautyRoll', 6, '', character);
    MML.createAttribute('intellectRoll', 6, '', character);
    MML.createAttribute('reasonRoll', 6, '', character);
    MML.createAttribute('creativityRoll', 6, '', character);
    MML.createAttribute('presenceRoll', 6, '', character);
    MML.createAttribute('fomInitBonus', 6, '', character);
    MML.createAttribute('rightHand', JSON.stringify({
      _id: 'emptyHand'
    }), '', character);
    MML.createAttribute('leftHand', JSON.stringify({
      _id: 'emptyHand'
    }), '', character);

    setTimeout(function () {
      MML.characters[id] = MML.createCharacter(character.id);
      MML.updateCharacterSheet(characters[id]);
    }, 2000);
  });

  on('add:attribute', function (attribute) {
    var id = attribute.get('_characterid');
    var attrName = attribute.get('name');

    if (attrName.includes('repeating_skills') || attrName.includes('repeating_weaponskills')) {
      MML.updateCharacterSheet(characters[id]);
    }
  });

  on('change:character:name', function (changedCharacter) {
    const character = MML.characters[changedCharacter.get('id')];
    character.name = changedCharacter.get('name');
    MML.updateCharacterSheet(character);
  });

  on('change:attribute:current', function (attribute) {
    var character = MML.characters[attribute.get('_characterid')];
    var attrName = attribute.get('name');
    var roll;
    var rollAttributes = [
      'statureRoll',
      'strengthRoll',
      'coordinationRoll',
      'healthRoll',
      'beautyRoll',
      'intellectRoll',
      'reasonRoll',
      'creativityRoll',
      'presenceRoll'
    ];

    if (rollAttributes.includes(attrName)) {
      roll = parseFloat(attribute.get('current'));
      if (isNaN(roll) || roll < 6) {
        roll = 6;
      } else if (roll > 20) {
        roll = 20;
      }
      MML.setCurrentAttribute(character.id, attrName, roll);
      MML.updateCharacterSheet(character);
    } else if (attrName === 'player') {
      character.setPlayer();
    } else if (attrName != 'tab') {
      MML.updateCharacterSheet(character);
    }
  });
};

token_changed.pipe(map(function (obj, prev) {
  if (obj.get('name').indexOf('spellMarker') === -1 && obj.get('left') !== prev['left'] && obj.get('top') !== prev['top'] && state.MML.GM.inCombat === true) {
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
  }
}));

token_changed.pipe(
  filter((obj, prev) => obj.get('name').includes('spellMarker')),
  map(function (obj, prev) {
    var targets = MML.getAoESpellTargets(obj);
    _.each(MML.characters, function (character) {
      var token = MML.getCharacterToken(character.id);
      if (!_.isUndefined(token)) {
        if (targets.includes(character.id)) {
          token.set('tint_color', '#00FF00');
        } else {
          token.set('tint_color', 'transparent');
        }
      }
    });
    state.MML.GM.currentAction.parameters.metaMagic['Modified AoE'] = MML.getAoESpellModifier(obj, state.MML.GM.currentAction.parameters.spell);
    sendChat('GM',
      'EP Cost: ' + MML.getModifiedEpCost() + '\n' +
      'Chance to Cast: ' + MML.getModifiedCastingChance()
    );
    toBack(obj);
  })
);

MML.buttonPressed = chat.pipe(
  filter(({ type, content }) => type === 'api' && content.includes('!MML|')),
  map(function (message) {
    message.who = message.who.replace(' (GM)', '');
    message.content = message.content.replace('!MML|', '');
    message.selected = MML.getSelectedIds(message.selected);
    return message;
  }),
  share(),
  tap(() => log('button'))
);
